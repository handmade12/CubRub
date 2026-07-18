const publicRoot = new URL("./dist/", import.meta.url);

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

const PERMISSIONS_POLICY =
  "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

const HASHED_ASSET = /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|eot|svg|png|webp|ico|json|map)$/i;

const DEFAULT_HOSTNAME = "127.0.0.1";
const DEFAULT_PORT = 8000;
const SOLVE_API_PATH = "/api/solve";
export const SOLVE_API_MAX_BODY_BYTES = 64 * 1024;
export const SOLVE_API_TIMEOUT_MS = 5_000;

class SolveApiInputError extends Error {}
class SolveApiCubeError extends Error {}
class SolveApiProviderError extends Error {}
class SolveApiTimeoutError extends Error {}
class SolveApiSizeError extends Error {}

export interface SolveApiOptions {
  readonly timeoutMs?: number;
  readonly solveSerialized?: (serialized: string) => Promise<string>;
}

export function isHashedAsset(pathname: string): boolean {
  return HASHED_ASSET.test(pathname);
}

export function contentType(pathname: string): string {
  const dot = pathname.lastIndexOf(".");
  return dot === -1
    ? "application/octet-stream"
    : contentTypes[pathname.slice(dot)] ?? "application/octet-stream";
}

export function cacheControlFor(pathname: string): string {
  if (pathname === "/" || pathname.endsWith("/index.html")) {
    return "no-cache, no-store, must-revalidate";
  }
  if (isHashedAsset(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=3600, must-revalidate";
}

export function securityHeaders(pathname: string, contentTypeValue: string): Headers {
  return new Headers({
    "content-type": contentTypeValue,
    "content-security-policy": CONTENT_SECURITY_POLICY,
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "permissions-policy": PERMISSIONS_POLICY,
    "cache-control": cacheControlFor(pathname),
  });
}

export function sanitizePath(pathname: string): string | undefined {
  if (pathname.includes("\0")) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  for (const segment of decoded.split("/")) {
    if (segment === ".." || segment.includes("\0") || segment.includes("\\")) return undefined;
  }
  return pathname;
}

export async function openFile(publicRoot: URL, pathname: string): Promise<Response | undefined> {
  const safePath = sanitizePath(pathname);
  if (safePath === undefined) return undefined;
  const target = new URL(`.${safePath}`, publicRoot);
  if (!target.href.startsWith(publicRoot.href)) return undefined;
  try {
    const file = await Deno.open(target, { read: true });
    return new Response(file.readable, {
      headers: securityHeaders(safePath, contentType(safePath)),
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

export function plainResponse(pathname: string, status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: securityHeaders(pathname, "text/plain; charset=utf-8"),
  });
}

export function notFoundResponse(): Response {
  return plainResponse("/__not_found__", 404, "Not found");
}

export function badRequestResponse(): Response {
  return plainResponse("/__bad_request__", 400, "Bad request");
}

function solveApiResponse(status: number, body: Readonly<Record<string, string>>): Response {
  const headers = securityHeaders(SOLVE_API_PATH, "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

async function readSolveBody(request: Request): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) throw new SolveApiInputError();
    if (Number(declaredLength) > SOLVE_API_MAX_BODY_BYTES) throw new SolveApiSizeError();
  }
  if (request.body === null) throw new SolveApiInputError();

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let serialized = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > SOLVE_API_MAX_BODY_BYTES) {
        await reader.cancel();
        throw new SolveApiSizeError();
      }
      serialized += decoder.decode(value, { stream: true });
    }
    serialized += decoder.decode();
  } catch (error) {
    if (error instanceof SolveApiSizeError) throw error;
    throw new SolveApiInputError();
  } finally {
    reader.releaseLock();
  }
  if (serialized.length === 0) throw new SolveApiInputError();
  return serialized;
}

async function solveSerializedCube(serialized: string): Promise<string> {
  let core: typeof import("@cuberub/cube-core");
  try {
    core = await import("@cuberub/cube-core");
  } catch {
    throw new SolveApiProviderError();
  }

  let cube;
  try {
    cube = core.deserializeCube(serialized);
  } catch {
    throw new SolveApiInputError();
  }

  let solver: typeof import("@cuberub/cube-solver");
  try {
    solver = await import("@cuberub/cube-solver");
  } catch {
    throw new SolveApiProviderError();
  }

  try {
    return (await solver.solveCube(cube)).notation;
  } catch (error) {
    if (
      error instanceof solver.CubeSolveError &&
      error.code === solver.CubeSolveErrorCode.InvalidState
    ) {
      throw new SolveApiCubeError();
    }
    throw new SolveApiProviderError();
  }
}

function solveWithTimeout(
  solve: () => Promise<string>,
  timeoutMs: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      settled = true;
      reject(new SolveApiTimeoutError());
    }, Math.max(0, timeoutMs));
    void Promise.resolve().then(solve).then(
      (notation) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(notation);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function handleSolveRequest(
  request: Request,
  options: SolveApiOptions = {},
): Promise<Response> {
  if (request.method !== "POST") {
    const response = solveApiResponse(405, { error: "method_not_allowed" });
    response.headers.set("allow", "POST");
    return response;
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== requestUrl.origin) {
    return solveApiResponse(400, { error: "invalid_request" });
  }

  let serialized: string;
  try {
    serialized = await readSolveBody(request);
  } catch (error) {
    return error instanceof SolveApiSizeError
      ? solveApiResponse(413, { error: "request_too_large" })
      : solveApiResponse(400, { error: "invalid_request" });
  }

  try {
    const solve = options.solveSerialized ?? solveSerializedCube;
    const notation = await solveWithTimeout(
      () => solve(serialized),
      options.timeoutMs ?? SOLVE_API_TIMEOUT_MS,
    );
    return solveApiResponse(200, { notation });
  } catch (error) {
    if (error instanceof SolveApiInputError) {
      return solveApiResponse(400, { error: "invalid_request" });
    }
    if (error instanceof SolveApiTimeoutError) {
      return solveApiResponse(504, { error: "timeout" });
    }
    if (error instanceof SolveApiCubeError) {
      return solveApiResponse(422, { error: "invalid_cube" });
    }
    return solveApiResponse(422, { error: "unable_to_solve" });
  }
}

export async function handleRequest(publicRoot: URL, request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const safePath = sanitizePath(pathname);
  if (safePath === undefined) return badRequestResponse();
  if (pathname === SOLVE_API_PATH) return handleSolveRequest(request);

  const asset = pathname === "/" ? "/index.html" : safePath;
  const file = await openFile(publicRoot, asset);
  if (file) return file;

  if (!pathname.includes(".")) {
    const spa = await openFile(publicRoot, "/index.html");
    if (spa) return spa;
  }

  return notFoundResponse();
}

export interface ServeOptions {
  readonly hostname: string;
  readonly port: number;
}

export function defaultServeOptions(): ServeOptions {
  return { hostname: DEFAULT_HOSTNAME, port: DEFAULT_PORT };
}

interface MutableServeOptions {
  hostname: string;
  port: number;
}

export function parseServeArgs(argv: readonly string[]): ServeOptions {
  const options: MutableServeOptions = {
    hostname: DEFAULT_HOSTNAME,
    port: DEFAULT_PORT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === "--host" || arg === "-h") && next !== undefined) {
      const value = next.trim();
      if (value) options.hostname = value;
      i += 1;
    } else if (arg.startsWith("--host=")) {
      const value = arg.slice("--host=".length).trim();
      if (value) options.hostname = value;
    } else if ((arg === "--port" || arg === "-p") && next !== undefined) {
      const value = Number(next);
      if (Number.isInteger(value) && value > 0 && value <= 65535) {
        options.port = value;
      }
      i += 1;
    } else if (arg.startsWith("--port=")) {
      const value = Number(arg.slice("--port=".length));
      if (Number.isInteger(value) && value > 0 && value <= 65535) {
        options.port = value;
      }
    }
  }
  return options;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
}

if (import.meta.main) {
  const { hostname, port } = parseServeArgs(Deno.args);
  if (!isLoopbackHostname(hostname)) {
    console.warn(
      `[cuberub] binding to non-loopback hostname '${hostname}'; expose only behind TLS/HTTPS and a trusted proxy.`,
    );
  }
  Deno.serve({ hostname, port }, (request: Request) => handleRequest(publicRoot, request));
}
