import { colorClassFor, renderCubeSvg, stickerLabelFor } from "./mod.ts";
import { createSolvedCube, type CubeState, Face, StickerColor } from "@cuberub/cube-core";
import { assert, assertEquals, assertStringIncludes } from "@cuberub/test-utils";

Deno.test("colorClassFor maps every StickerColor and treats null as gray", () => {
  assertEquals(colorClassFor(StickerColor.White), "white");
  assertEquals(colorClassFor(StickerColor.Yellow), "yellow");
  assertEquals(colorClassFor(StickerColor.Red), "red");
  assertEquals(colorClassFor(StickerColor.Orange), "orange");
  assertEquals(colorClassFor(StickerColor.Blue), "blue");
  assertEquals(colorClassFor(StickerColor.Green), "green");
  assertEquals(colorClassFor(null), "gray");
  assertEquals(colorClassFor(undefined), "gray");
});

Deno.test("stickerLabelFor returns StickerColor names", () => {
  assertEquals(stickerLabelFor(StickerColor.White), "White");
  assertEquals(stickerLabelFor(null), "—");
});

Deno.test("renderCubeSvg returns a self-contained closed isometric svg with three visible faces", () => {
  const state = createSolvedCube(3);
  const svg = renderCubeSvg({ size: 3, state, ariaLabel: "Test cube" });
  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, 'aria-label="Test cube"');
  assertStringIncludes(svg, 'viewBox="0 0');
  assert(svg.includes('class="cuberub-cube cuberub-cube--3"'));
  const polygons = svg.match(/<polygon class="cuberub-sticker /g) ?? [];
  assertEquals(polygons.length, 3 * 9);
  assertStringIncludes(svg, "cuberub-cube__silhouette");
  assertStringIncludes(svg, "cuberub-cube__seams");
  const visibleLabels = [
    "cuberub-sticker--white",
    "cuberub-sticker--red",
    "cuberub-sticker--green",
  ];
  for (const klass of visibleLabels) {
    assertStringIncludes(svg, klass);
  }
});

Deno.test("renderCubeSvg renders exactly three faces for 2x2 with no six-face net", () => {
  const faces: Record<Face, StickerColor[]> = {
    [Face.U]: Array<StickerColor>(4).fill(StickerColor.White),
    [Face.D]: Array<StickerColor>(4).fill(StickerColor.White),
    [Face.F]: Array<StickerColor>(4).fill(StickerColor.White),
    [Face.B]: Array<StickerColor>(4).fill(StickerColor.White),
    [Face.L]: Array<StickerColor>(4).fill(StickerColor.White),
    [Face.R]: Array<StickerColor>(4).fill(StickerColor.White),
  };
  const state: CubeState = { size: 2, faces };
  const svg = renderCubeSvg({ size: 2, state });
  assertStringIncludes(svg, "cuberub-sticker--white");
  const polygons = svg.match(/<polygon class="cuberub-sticker /g) ?? [];
  assertEquals(polygons.length, 3 * 4);
  assert(svg.includes('class="cuberub-cube cuberub-cube--2"'));
});

Deno.test("renderCubeSvg is size-aware", () => {
  const state = createSolvedCube(2);
  const svg = renderCubeSvg({ size: 2, state });
  assert(svg.length > 0);
  assertStringIncludes(svg, "cuberub-cube");
});

Deno.test("renderCubeSvg shares seamless seams at the inner Y of the isometric view", () => {
  const state = createSolvedCube(3);
  const svg = renderCubeSvg({ size: 3, state });
  const seams = svg.match(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g) ?? [];
  assertEquals(seams.length, 3);
});

Deno.test("renderCubeSvg escapes every emitted DOM string attribute", () => {
  const state = createSolvedCube(3);
  const svg = renderCubeSvg({ size: 3, state, title: 'evil"x>&', ariaLabel: 'evil"x>&' });
  const lower = svg.toLowerCase();
  assert(!lower.includes("<script"));
  assertStringIncludes(svg, "&amp;");
  assertStringIncludes(svg, "&quot;");
  assert(!svg.includes('aria-label="evil"'));
});

Deno.test("renderCubeSvg face labels reflect visible faces only", () => {
  const state = createSolvedCube(3);
  const svg = renderCubeSvg({ size: 3, state });
  const segment = svg.split("cuberub-cube__silhouette")[0] ?? "";
  assert(segment.includes("cuberub-sticker--white"));
  assert(segment.includes("cuberub-sticker--red"));
  assert(segment.includes("cuberub-sticker--green"));
  assert(!segment.includes("cuberub-sticker--yellow"));
  assert(!segment.includes("cuberub-sticker--orange"));
  assert(!segment.includes("cuberub-sticker--blue"));
});

Deno.test("renderCubeSvg escapes injection attempts in title", () => {
  const state = createSolvedCube(3);
  const malicious = `</title><script>alert('xss')</script><title>`;
  const svg = renderCubeSvg({ size: 3, state, title: malicious });
  const lower = svg.toLowerCase();
  assert(!lower.includes("<script>"));
  assertEquals((lower.match(/<\/title>/g) ?? []).length, 1);
  assertStringIncludes(svg, "&lt;/title&gt;&lt;script&gt;");
  assertStringIncludes(svg, "&lt;title&gt;");
});

Deno.test("renderCubeSvg escapes quote-break attempts in ariaLabel", () => {
  const state = createSolvedCube(3);
  const malicious = `" onclick="alert(1)`;
  const svg = renderCubeSvg({ size: 3, state, ariaLabel: malicious });
  assertStringIncludes(svg, 'aria-label="&quot;');
  assert(!svg.includes('aria-label="" onclick="alert(1)"'));
  assert(!svg.includes(`onclick="alert(1)"`));
  assert(!svg.includes(`onclick="`));
});

Deno.test("renderCubeSvg escapes entity and quote references in title and ariaLabel", () => {
  const state = createSolvedCube(3);
  const dirty = `a&b<c>d"e'f`;
  const svg = renderCubeSvg({ size: 3, state, title: dirty, ariaLabel: dirty });
  assertStringIncludes(svg, "a&amp;b&lt;c&gt;d&quot;e&apos;f");
  assert(!svg.includes(`a&b<c>d"e'f`));
});
