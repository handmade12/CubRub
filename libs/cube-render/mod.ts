import { type CubeSize, type CubeState, Face, StickerColor } from "@cuberub/cube-core";

export type ColorClass =
  | "white"
  | "yellow"
  | "red"
  | "orange"
  | "blue"
  | "green"
  | "gray";

const COLOR_CLASS: Readonly<Record<StickerColor, ColorClass>> = Object.freeze({
  [StickerColor.White]: "white",
  [StickerColor.Yellow]: "yellow",
  [StickerColor.Red]: "red",
  [StickerColor.Orange]: "orange",
  [StickerColor.Blue]: "blue",
  [StickerColor.Green]: "green",
});

export function colorClassFor(color: StickerColor | null | undefined): ColorClass {
  if (color === null || color === undefined) return "gray";
  return COLOR_CLASS[color] ?? "gray";
}

export function stickerLabelFor(color: StickerColor | null | undefined): string {
  if (color === null || color === undefined) return "—";
  return StickerColor[color];
}

export interface CubeSvgOptions {
  readonly size: CubeSize;
  readonly state: CubeState;
  readonly title?: string;
  readonly ariaLabel?: string;
}

const PROJECTION_X = Math.cos(Math.PI / 6);
const PROJECTION_Y = Math.sin(Math.PI / 6);

interface V2 {
  readonly x: number;
  readonly y: number;
}

interface V3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function project(v: V3): V2 {
  return {
    x: (v.x - v.z) * PROJECTION_X,
    y: -v.y + (v.x + v.z) * PROJECTION_Y,
  };
}

function cellCenter(size: CubeSize, index: number): number {
  return (2 * index + 1 - size) / size;
}

function cellHalfWidth(size: CubeSize): number {
  return 1 / size;
}

function faceBasis(face: Face): {
  readonly normal: readonly [number, number, number];
  readonly u: readonly [number, number, number];
  readonly v: readonly [number, number, number];
} {
  switch (face) {
    case Face.U:
      return { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] };
    case Face.F:
      return { normal: [0, 0, 1], u: [1, 0, 0], v: [0, -1, 0] };
    case Face.R:
      return { normal: [1, 0, 0], u: [0, 0, -1], v: [0, -1, 0] };
    case Face.D:
      return { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] };
    case Face.L:
      return { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] };
    case Face.B:
      return { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, -1, 0] };
  }
}

function stickerCenter3D(
  face: Face,
  size: CubeSize,
  row: number,
  col: number,
): V3 {
  const last = size - 1;
  switch (face) {
    case Face.U:
      return { x: cellCenter(size, col), y: 1, z: cellCenter(size, row) };
    case Face.F:
      return {
        x: cellCenter(size, col),
        y: cellCenter(size, last - row),
        z: 1,
      };
    case Face.R:
      return {
        x: 1,
        y: cellCenter(size, last - row),
        z: cellCenter(size, last - col),
      };
    case Face.D:
      return {
        x: cellCenter(size, col),
        y: -1,
        z: cellCenter(size, last - row),
      };
    case Face.L:
      return {
        x: -1,
        y: cellCenter(size, last - row),
        z: cellCenter(size, col),
      };
    case Face.B:
      return {
        x: cellCenter(size, last - col),
        y: cellCenter(size, last - row),
        z: -1,
      };
  }
}

const VISIBLE_FACES: readonly Face[] = Object.freeze([Face.U, Face.F, Face.R]);

interface ProjectionConfig {
  readonly scale: number;
  readonly pad: number;
}

function projectionConfig(size: CubeSize): ProjectionConfig {
  const scale = size === 2 ? 70 : 60;
  const pad = 14;
  return { scale, pad };
}

interface AxisLayout {
  readonly width: number;
  readonly height: number;
}

function axisLayout(config: ProjectionConfig): AxisLayout {
  const width = config.scale * (2 * PROJECTION_X * 2) + config.pad * 2;
  const height = config.scale * 4 + config.pad * 2;
  return { width, height };
}

function toScreen(
  v: V2,
  config: ProjectionConfig,
  layout: AxisLayout,
): { x: number; y: number } {
  return {
    x: v.x * config.scale + layout.width / 2,
    y: v.y * config.scale + layout.height / 2,
  };
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Readonly<Record<string, string>> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function formatPoint(point: { x: number; y: number }): string {
  return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
}

function renderSticker(
  size: CubeSize,
  state: CubeState,
  face: Face,
  row: number,
  col: number,
  config: ProjectionConfig,
  layout: AxisLayout,
): string {
  const center = stickerCenter3D(face, size, row, col);
  const { u, v } = faceBasis(face);
  const halfWidth = cellHalfWidth(size);
  const stickerGap = Math.max(0.04, halfWidth * 0.08);
  const du = halfWidth - stickerGap;
  const dv = halfWidth - stickerGap;

  const corners3D: V3[] = [
    {
      x: center.x - u[0] * du - v[0] * dv,
      y: center.y - u[1] * du - v[1] * dv,
      z: center.z - u[2] * du - v[2] * dv,
    },
    {
      x: center.x + u[0] * du - v[0] * dv,
      y: center.y + u[1] * du - v[1] * dv,
      z: center.z + u[2] * du - v[2] * dv,
    },
    {
      x: center.x + u[0] * du + v[0] * dv,
      y: center.y + u[1] * du + v[1] * dv,
      z: center.z + u[2] * du + v[2] * dv,
    },
    {
      x: center.x - u[0] * du + v[0] * dv,
      y: center.y - u[1] * du + v[1] * dv,
      z: center.z - u[2] * du + v[2] * dv,
    },
  ];

  const points = corners3D
    .map((corner) => toScreen(project(corner), config, layout))
    .map(formatPoint)
    .join(" ");

  const klass = colorClassFor(state.faces[face][row * size + col]);
  return `<polygon class="cuberub-sticker cuberub-sticker--${klass}" points="${points}" />`;
}

function renderFace(
  size: CubeSize,
  state: CubeState,
  face: Face,
  config: ProjectionConfig,
  layout: AxisLayout,
): string {
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      parts.push(renderSticker(size, state, face, row, col, config, layout));
    }
  }
  return parts.join("");
}

function renderCubeFrame(config: ProjectionConfig, layout: AxisLayout): string {
  const cubeVertices: V3[] = [
    { x: -1, y: 1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: -1, z: 1 },
    { x: -1, y: -1, z: 1 },
    { x: -1, y: 1, z: 1 },
  ];
  const hexagon = cubeVertices
    .map((vertex) => toScreen(project(vertex), config, layout))
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  const center = toScreen(project({ x: 1, y: 1, z: 1 }), config, layout);
  const seamTargets: V3[] = [
    { x: 1, y: 1, z: -1 },
    { x: 1, y: -1, z: 1 },
    { x: -1, y: 1, z: 1 },
  ];
  const seams = seamTargets
    .map((target) => {
      const endpoint = toScreen(project(target), config, layout);
      return `<line x1="${center.x.toFixed(2)}" y1="${center.y.toFixed(2)}" x2="${
        endpoint.x.toFixed(2)
      }" y2="${endpoint.y.toFixed(2)}" />`;
    })
    .join("");

  return `<polygon class="cuberub-cube__silhouette" points="${hexagon}" /><g class="cuberub-cube__seams">${seams}</g>`;
}

export function renderCubeSvg(options: CubeSvgOptions): string {
  const { size, state } = options;
  const config = projectionConfig(size);
  const layout = axisLayout(config);
  const title = escapeXml(options.title ?? options.ariaLabel ?? "Cube");
  const aria = escapeXml(options.ariaLabel ?? "Cube");

  const visibleParts = VISIBLE_FACES
    .map((face) => renderFace(size, state, face, config, layout))
    .join("");
  const frame = renderCubeFrame(config, layout);

  return [
    `<svg class="cuberub-cube cuberub-cube--${size}" viewBox="0 0 ${layout.width.toFixed(2)} ${
      layout.height.toFixed(2)
    }" role="img" aria-label="${aria}">`,
    `<title>${title}</title>`,
    visibleParts,
    frame,
    `</svg>`,
  ].join("");
}
