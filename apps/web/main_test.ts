import {
  badRequestResponse,
  cacheControlFor,
  contentType,
  handleRequest,
  handleSolveRequest,
  isHashedAsset,
  notFoundResponse,
  parseServeArgs,
  sanitizePath,
  securityHeaders,
  SOLVE_API_MAX_BODY_BYTES,
} from "./main.ts";
import { assert, assertEquals, assertMatch, assertStringIncludes } from "@cuberub/test-utils";
import {
  applyMoves,
  createCubeState,
  createSolvedCube,
  type CubeState,
  Face,
  FACE_ORDER,
  parseAlgorithm,
  serializeCube,
  StickerColor,
} from "@cuberub/cube-core";
import { isVisuallySolved } from "@cuberub/cube-solver";

const EXPECTED_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

const distDir = new URL("./dist/", import.meta.url);
const assetsDir = new URL("./dist/assets/", import.meta.url);

async function findHashedAsset(): Promise<string | undefined> {
  try {
    for await (const entry of Deno.readDir(assetsDir)) {
      if (entry.isFile && isHashedAsset(`/assets/${entry.name}`)) {
        return entry.name;
      }
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return undefined;
}

function twistOneCorner(state: CubeState): CubeState {
  const faces = {} as Record<Face, StickerColor[]>;
  for (const face of FACE_ORDER) faces[face] = [...state.faces[face]];
  const u = faces[Face.U][state.size * state.size - 1];
  const r = faces[Face.R][0];
  const f = faces[Face.F][state.size - 1];
  faces[Face.U][state.size * state.size - 1] = r;
  faces[Face.R][0] = f;
  faces[Face.F][state.size - 1] = u;
  return createCubeState(state.size, faces);
}

function solveRequest(body: string): Request {
  return new Request("http://localhost/api/solve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body,
  });
}

Deno.test("securityHeaders covers CSP, nosniff, referrer, permissions, frame deny", () => {
  const headers = securityHeaders("/index.html", "text/html; charset=utf-8");
  assertEquals(headers.get("content-security-policy"), EXPECTED_CSP);
  const scriptSource =
    EXPECTED_CSP.split("; ").find((directive) => directive.startsWith("script-src "))?.split(" ") ??
      [];
  assert(scriptSource.includes("'wasm-unsafe-eval'"));
  assert(!scriptSource.includes("'unsafe-eval'"));
  assertEquals(headers.get("x-content-type-options"), "nosniff");
  assertEquals(headers.get("x-frame-options"), "DENY");
  assertEquals(headers.get("referrer-policy"), "no-referrer");
  const permissions = headers.get("permissions-policy") ?? "";
  assertStringIncludes(permissions, "camera=()");
  assertStringIncludes(permissions, "microphone=()");
  assertStringIncludes(permissions, "geolocation=()");
});

Deno.test("cacheControlFor treats index.html as no-cache", () => {
  assertEquals(cacheControlFor("/"), "no-cache, no-store, must-revalidate");
  assertEquals(cacheControlFor("/index.html"), "no-cache, no-store, must-revalidate");
  assertEquals(cacheControlFor("/some/route/index.html"), "no-cache, no-store, must-revalidate");
});

Deno.test("cacheControlFor treats detectable hashed assets as immutable", () => {
  assertMatch(
    cacheControlFor("/assets/index-DsKeuPfT.js"),
    /^public, max-age=31536000, immutable$/,
  );
  assertMatch(
    cacheControlFor("/assets/index-DsKeuPfT.css"),
    /^public, max-age=31536000, immutable$/,
  );
});

Deno.test("cacheControlFor falls back to a short max-age for unknown assets", () => {
  assertEquals(cacheControlFor("/favicon.svg"), "public, max-age=3600, must-revalidate");
});

Deno.test("isHashedAsset matches Vite-style hashed filenames only", () => {
  assert(isHashedAsset("/assets/index-DsKeuPfT.js"));
  assert(isHashedAsset("/assets/index-DsKeuPfT.css"));
  assert(isHashedAsset("/assets/preload-helper-BXl3LOEh.js"));
  assert(!isHashedAsset("/favicon.svg"));
  assert(!isHashedAsset("/index.html"));
  assert(!isHashedAsset("/assets/foo-bar.json"));
  assert(!isHashedAsset("/assets/manifest.json"));
});

Deno.test("contentType maps known extensions and falls back to octet-stream", () => {
  assertEquals(contentType("/page.html"), "text/html; charset=utf-8");
  assertEquals(contentType("/page.js"), "text/javascript; charset=utf-8");
  assertEquals(contentType("/page.css"), "text/css; charset=utf-8");
  assertEquals(contentType("/image.svg"), "image/svg+xml");
  assertEquals(contentType("/image.webp"), "image/webp");
  assertEquals(contentType("/binary"), "application/octet-stream");
});

Deno.test("sanitizePath accepts clean paths", () => {
  assertEquals(sanitizePath("/"), "/");
  assertEquals(sanitizePath("/index.html"), "/index.html");
  assertEquals(sanitizePath("/assets/index-DsKeuPfT.js"), "/assets/index-DsKeuPfT.js");
});

Deno.test("sanitizePath rejects encoded traversal segments and null/backslashes", () => {
  for (
    const path of [
      "/..%2fbar",
      "/foo/..%2fbar",
      "/foo/..%2Fbar",
      "/foo%2f..%2fbar",
      "/foo%2f%2e%2e%2fbar",
      "/foo%5c..%5cbar",
      "/foo/%00bar",
      "/../etc/passwd",
      "/foo/../bar",
      "/foo/..\\bar",
      "/%2e%2e/etc/passwd",
      "/foo/.%2e/bar",
    ]
  ) {
    assertEquals(sanitizePath(path), undefined, `should reject: ${path}`);
  }
});

Deno.test("sanitizePath rejects null bytes and malformed percent-encoding", () => {
  assertEquals(sanitizePath("/foo\0bar"), undefined);
  assertEquals(sanitizePath("/foo%xx"), undefined);
  assertEquals(sanitizePath("/foo%E0%A4%A"), undefined);
});

Deno.test("parseServeArgs applies defaults", () => {
  assertEquals(parseServeArgs([]), { hostname: "127.0.0.1", port: 8000 });
});

Deno.test("parseServeArgs honours --host and --port (space form)", () => {
  assertEquals(parseServeArgs(["--host", "0.0.0.0", "--port", "9000"]), {
    hostname: "0.0.0.0",
    port: 9000,
  });
  assertEquals(parseServeArgs(["-h", "::1", "-p", "3000"]), { hostname: "::1", port: 3000 });
});

Deno.test("parseServeArgs honours --host= and --port= (equals form)", () => {
  assertEquals(parseServeArgs(["--host=10.0.0.1", "--port=4242"]), {
    hostname: "10.0.0.1",
    port: 4242,
  });
});

Deno.test("parseServeArgs ignores invalid port values silently", () => {
  assertEquals(parseServeArgs(["--port", "not-a-number"]), { hostname: "127.0.0.1", port: 8000 });
  assertEquals(parseServeArgs(["--port", "-1"]), { hostname: "127.0.0.1", port: 8000 });
  assertEquals(parseServeArgs(["--port=99999999"]), { hostname: "127.0.0.1", port: 8000 });
  assertEquals(parseServeArgs(["--port="]), { hostname: "127.0.0.1", port: 8000 });
});

Deno.test("notFoundResponse carries security headers", () => {
  const response = notFoundResponse();
  assertEquals(response.status, 404);
  assertEquals(response.headers.get("content-security-policy"), EXPECTED_CSP);
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
});

Deno.test("badRequestResponse carries security headers and a 400 status", () => {
  const response = badRequestResponse();
  assertEquals(response.status, 400);
  assertEquals(response.headers.get("content-security-policy"), EXPECTED_CSP);
});

Deno.test("solve API only accepts same-origin POST requests", async () => {
  const methodResponse = await handleRequest(
    distDir,
    new Request("http://localhost/api/solve", { method: "GET" }),
  );
  assertEquals(methodResponse.status, 405);
  assertEquals(methodResponse.headers.get("allow"), "POST");
  assertEquals(methodResponse.headers.get("cache-control"), "no-store");
  assertEquals(methodResponse.headers.get("access-control-allow-origin"), null);

  const originResponse = await handleSolveRequest(
    new Request("http://localhost/api/solve", {
      method: "POST",
      headers: { origin: "https://example.com" },
      body: serializeCube(createSolvedCube(2)),
    }),
  );
  assertEquals(originResponse.status, 400);
  assertEquals(await originResponse.json(), { error: "invalid_request" });
});

Deno.test("solve API rejects malformed, non-strict, and oversized bodies", async () => {
  const malformed = await handleSolveRequest(solveRequest("{"));
  assertEquals(malformed.status, 400);
  assertEquals(await malformed.json(), { error: "invalid_request" });

  const extra = JSON.parse(serializeCube(createSolvedCube(2)));
  extra.unexpected = true;
  const nonStrict = await handleSolveRequest(solveRequest(JSON.stringify(extra)));
  assertEquals(nonStrict.status, 400);
  assertEquals(await nonStrict.json(), { error: "invalid_request" });

  const oversized = await handleSolveRequest(
    solveRequest("x".repeat(SOLVE_API_MAX_BODY_BYTES + 1)),
  );
  assertEquals(oversized.status, 413);
  assertEquals(await oversized.json(), { error: "request_too_large" });
});

Deno.test("solve API returns minimal notation for a solved cube", async () => {
  const response = await handleRequest(
    distDir,
    solveRequest(serializeCube(createSolvedCube(3))),
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { notation: "" });
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertStringIncludes(response.headers.get("content-type") ?? "", "application/json");
  assertEquals(response.headers.get("content-security-policy"), EXPECTED_CSP);
});

Deno.test("solve API notation solves a legal scramble", async () => {
  const scrambled = applyMoves(createSolvedCube(3), parseAlgorithm("R U R' U' F2"));
  const response = await handleSolveRequest(solveRequest(serializeCube(scrambled)));
  assertEquals(response.status, 200);
  const payload = await response.json();
  assertEquals(Object.keys(payload), ["notation"]);
  assert(typeof payload.notation === "string");
  assert(isVisuallySolved(applyMoves(scrambled, parseAlgorithm(payload.notation))));
});

Deno.test("solve API returns safe impossible, provider, and timeout errors", async () => {
  const impossible = await handleSolveRequest(
    solveRequest(serializeCube(twistOneCorner(createSolvedCube(3)))),
  );
  assertEquals(impossible.status, 422);
  const impossibleText = await impossible.text();
  assertEquals(JSON.parse(impossibleText), { error: "invalid_cube" });
  assert(!impossibleText.includes("stack"));
  assert(!impossibleText.includes("cause"));

  const provider = await handleSolveRequest(solveRequest(serializeCube(createSolvedCube(2))), {
    solveSerialized: () => Promise.reject(new Error("private provider detail")),
  });
  assertEquals(provider.status, 422);
  const providerText = await provider.text();
  assertEquals(JSON.parse(providerText), { error: "unable_to_solve" });
  assert(!providerText.includes("private provider detail"));

  const timeout = await handleSolveRequest(solveRequest(serializeCube(createSolvedCube(2))), {
    timeoutMs: 1,
    solveSerialized: () => new Promise<string>(() => {}),
  });
  assertEquals(timeout.status, 504);
  assertEquals(await timeout.json(), { error: "timeout" });
});

Deno.test("handleRequest serves index.html at root with full security headers and no-cache", async () => {
  const request = new Request("http://localhost/");
  const response = await handleRequest(distDir, request);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-security-policy"), EXPECTED_CSP);
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
  assertEquals(response.headers.get("x-frame-options"), "DENY");
  assertEquals(response.headers.get("referrer-policy"), "no-referrer");
  assertEquals(
    response.headers.get("cache-control"),
    "no-cache, no-store, must-revalidate",
  );
  assertStringIncludes(response.headers.get("content-type") ?? "", "text/html");
});

Deno.test("handleRequest serves a hashed asset with immutable cache-control", async () => {
  const name = await findHashedAsset();
  assert(name !== undefined, "expected at least one hashed asset in dist/assets");
  const request = new Request(`http://localhost/assets/${name}`);
  const response = await handleRequest(distDir, request);
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
  assertEquals(
    response.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
  );
});

Deno.test("handleRequest falls back to index.html for SPA routes without a dot", async () => {
  const request = new Request("http://localhost/some/spa/route");
  const response = await handleRequest(distDir, request);
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("cache-control"),
    "no-cache, no-store, must-revalidate",
  );
  assertStringIncludes(response.headers.get("content-type") ?? "", "text/html");
});

Deno.test("handleRequest returns 404 with security headers for a missing asset", async () => {
  const request = new Request("http://localhost/missing.css");
  const response = await handleRequest(distDir, request);
  assertEquals(response.status, 404);
  assertEquals(response.headers.get("content-security-policy"), EXPECTED_CSP);
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
});

Deno.test("handleRequest blocks percent-encoded traversal and null-byte attempts", async () => {
  for (
    const path of [
      "/..%2findex.html",
      "/foo/..%2findex.html",
      "/foo%2f..%2findex.html",
      "/foo%2f%2e%2e%2findex.html",
      "/foo%5c..%5cindex.html",
      "/foo%00bar",
      "/foo/%00bar",
    ]
  ) {
    const response = await handleRequest(distDir, new Request(`http://localhost${path}`));
    assertEquals(response.status, 400, `${path} should be rejected with 400`);
    assertEquals(response.headers.get("content-security-policy"), EXPECTED_CSP);
  }
});

Deno.test("handleRequest lets URL parser normalize bare %2e%2e paths to a safe SPA fallback", async () => {
  for (
    const path of [
      "/%2e%2e/etc/passwd",
      "/foo/%2e%2e/index.html",
      "/foo/%2E%2E/index.html",
    ]
  ) {
    const response = await handleRequest(distDir, new Request(`http://localhost${path}`));
    assert(response.status < 500, `${path} should respond without 5xx`);
    assertEquals(response.headers.get("content-security-policy"), EXPECTED_CSP);
  }
});
