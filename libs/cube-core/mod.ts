export type CubeSize = 2 | 3;

export enum StickerColor {
  White = 1,
  Yellow = 2,
  Red = 3,
  Orange = 4,
  Blue = 5,
  Green = 6,
}

export enum Face {
  U = 1,
  R = 2,
  F = 3,
  D = 4,
  L = 5,
  B = 6,
}

export type MoveAmount = 1 | -1 | 2;

export interface Move {
  readonly face: Face;
  readonly amount: MoveAmount;
}

export interface CubeState {
  readonly size: CubeSize;
  readonly faces: Readonly<Record<Face, readonly StickerColor[]>>;
}

export const FACE_ORDER = Object.freeze(
  [
    Face.U,
    Face.R,
    Face.F,
    Face.D,
    Face.L,
    Face.B,
  ] as const,
);

export const STICKER_COLORS = Object.freeze(
  [
    StickerColor.White,
    StickerColor.Yellow,
    StickerColor.Red,
    StickerColor.Orange,
    StickerColor.Blue,
    StickerColor.Green,
  ] as const,
);

const SOLVED_COLORS: Readonly<Record<Face, StickerColor>> = Object.freeze({
  [Face.U]: StickerColor.White,
  [Face.R]: StickerColor.Red,
  [Face.F]: StickerColor.Green,
  [Face.D]: StickerColor.Yellow,
  [Face.L]: StickerColor.Orange,
  [Face.B]: StickerColor.Blue,
});

interface Vector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Sticker {
  readonly color: StickerColor;
  readonly normal: Vector;
  readonly position: Vector;
}

interface SerializedCube {
  readonly version: 1;
  readonly size: CubeSize;
  readonly facelets: readonly (readonly StickerColor[])[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isCubeSize(value: unknown): value is CubeSize {
  return value === 2 || value === 3;
}

export function isStickerColor(value: unknown): value is StickerColor {
  return typeof value === "number" && STICKER_COLORS.includes(value as StickerColor);
}

export function isFace(value: unknown): value is Face {
  return typeof value === "number" && FACE_ORDER.includes(value as Face);
}

function freezeFaces(faces: Record<Face, StickerColor[]>): CubeState["faces"] {
  for (const face of FACE_ORDER) Object.freeze(faces[face]);
  return Object.freeze(faces);
}

export function countColors(state: CubeState): Readonly<Record<StickerColor, number>> {
  const counts = {
    [StickerColor.White]: 0,
    [StickerColor.Yellow]: 0,
    [StickerColor.Red]: 0,
    [StickerColor.Orange]: 0,
    [StickerColor.Blue]: 0,
    [StickerColor.Green]: 0,
  };

  for (const face of FACE_ORDER) {
    for (const color of state.faces[face]) counts[color] += 1;
  }

  return Object.freeze(counts);
}

export function createCubeState(
  size: CubeSize,
  source: Readonly<Record<Face, readonly StickerColor[]>>,
): CubeState {
  if (!isCubeSize(size)) throw new TypeError("Cube size must be 2 or 3");

  const faceletCount = size * size;
  const faces = {} as Record<Face, StickerColor[]>;

  for (const face of FACE_ORDER) {
    const stickers = source?.[face];
    if (!Array.isArray(stickers) || stickers.length !== faceletCount) {
      throw new TypeError(`Face ${Face[face]} must contain ${faceletCount} stickers`);
    }
    if (!stickers.every(isStickerColor)) {
      throw new TypeError(`Face ${Face[face]} contains an unknown color`);
    }
    faces[face] = [...stickers];
  }

  const state: CubeState = Object.freeze({ size, faces: freezeFaces(faces) });
  const expected = faceletCount;
  const counts = countColors(state);
  for (const color of STICKER_COLORS) {
    if (counts[color] !== expected) {
      throw new TypeError(`Color ${StickerColor[color]} must occur ${expected} times`);
    }
  }

  return state;
}

export function createSolvedCube(size: CubeSize): CubeState {
  const faces = {} as Record<Face, StickerColor[]>;
  for (const face of FACE_ORDER) {
    faces[face] = Array<StickerColor>(size * size).fill(SOLVED_COLORS[face]);
  }
  return createCubeState(size, faces);
}

export function cloneCube(state: CubeState): CubeState {
  return createCubeState(state.size, state.faces);
}

export function cubeEquals(left: CubeState, right: CubeState): boolean {
  if (left.size !== right.size) return false;
  return FACE_ORDER.every((face) =>
    left.faces[face].every((color, index) => color === right.faces[face][index])
  );
}

function levels(size: CubeSize): readonly number[] {
  return size === 2 ? [-1, 1] : [-1, 0, 1];
}

function coordinate(size: CubeSize, index: number): number {
  return levels(size)[index];
}

function coordinateIndex(size: CubeSize, value: number): number {
  const index = levels(size).indexOf(value);
  if (index === -1) throw new Error(`Coordinate ${value} is outside a ${size}x${size} cube`);
  return index;
}

function stickerFromFace(
  size: CubeSize,
  face: Face,
  row: number,
  column: number,
  color: StickerColor,
): Sticker {
  const last = size - 1;
  const low = -1;
  const high = 1;

  switch (face) {
    case Face.U:
      return {
        color,
        normal: { x: 0, y: 1, z: 0 },
        position: { x: coordinate(size, column), y: high, z: coordinate(size, row) },
      };
    case Face.R:
      return {
        color,
        normal: { x: 1, y: 0, z: 0 },
        position: {
          x: high,
          y: coordinate(size, last - row),
          z: coordinate(size, last - column),
        },
      };
    case Face.F:
      return {
        color,
        normal: { x: 0, y: 0, z: 1 },
        position: { x: coordinate(size, column), y: coordinate(size, last - row), z: high },
      };
    case Face.D:
      return {
        color,
        normal: { x: 0, y: -1, z: 0 },
        position: { x: coordinate(size, column), y: low, z: coordinate(size, last - row) },
      };
    case Face.L:
      return {
        color,
        normal: { x: -1, y: 0, z: 0 },
        position: { x: low, y: coordinate(size, last - row), z: coordinate(size, column) },
      };
    case Face.B:
      return {
        color,
        normal: { x: 0, y: 0, z: -1 },
        position: {
          x: coordinate(size, last - column),
          y: coordinate(size, last - row),
          z: low,
        },
      };
  }
}

function faceCellFromSticker(size: CubeSize, sticker: Sticker): readonly [Face, number, number] {
  const { normal, position } = sticker;
  const last = size - 1;

  if (normal.y === 1) {
    return [Face.U, coordinateIndex(size, position.z), coordinateIndex(size, position.x)];
  }
  if (normal.x === 1) {
    return [
      Face.R,
      last - coordinateIndex(size, position.y),
      last - coordinateIndex(size, position.z),
    ];
  }
  if (normal.z === 1) {
    return [Face.F, last - coordinateIndex(size, position.y), coordinateIndex(size, position.x)];
  }
  if (normal.y === -1) {
    return [
      Face.D,
      last - coordinateIndex(size, position.z),
      coordinateIndex(size, position.x),
    ];
  }
  if (normal.x === -1) {
    return [Face.L, last - coordinateIndex(size, position.y), coordinateIndex(size, position.z)];
  }
  if (normal.z === -1) {
    return [
      Face.B,
      last - coordinateIndex(size, position.y),
      last - coordinateIndex(size, position.x),
    ];
  }

  throw new Error("Sticker normal does not point to a cube face");
}

function rotateVector(vector: Vector, axis: "x" | "y" | "z", direction: 1 | -1): Vector {
  const { x, y, z } = vector;
  if (axis === "x") {
    return direction === 1 ? { x, y: -z, z: y } : { x, y: z, z: -y };
  }
  if (axis === "y") {
    return direction === 1 ? { x: z, y, z: -x } : { x: -z, y, z: x };
  }
  return direction === 1 ? { x: -y, y: x, z } : { x: y, y: -x, z };
}

function moveGeometry(face: Face): readonly ["x" | "y" | "z", number, 1 | -1] {
  switch (face) {
    case Face.U:
      return ["y", 1, -1];
    case Face.R:
      return ["x", 1, -1];
    case Face.F:
      return ["z", 1, -1];
    case Face.D:
      return ["y", -1, 1];
    case Face.L:
      return ["x", -1, 1];
    case Face.B:
      return ["z", -1, 1];
  }
}

function toStickers(state: CubeState): Sticker[] {
  const stickers: Sticker[] = [];
  for (const face of FACE_ORDER) {
    state.faces[face].forEach((color, index) => {
      stickers.push(
        stickerFromFace(
          state.size,
          face,
          Math.floor(index / state.size),
          index % state.size,
          color,
        ),
      );
    });
  }
  return stickers;
}

function fromStickers(size: CubeSize, stickers: readonly Sticker[]): CubeState {
  const faces = {} as Record<Face, StickerColor[]>;
  for (const face of FACE_ORDER) faces[face] = Array<StickerColor>(size * size);

  for (const sticker of stickers) {
    const [face, row, column] = faceCellFromSticker(size, sticker);
    faces[face][row * size + column] = sticker.color;
  }

  return createCubeState(size, faces);
}

function applyQuarterTurn(state: CubeState, face: Face, inverse: boolean): CubeState {
  const [axis, layer, clockwise] = moveGeometry(face);
  const direction = inverse ? (clockwise * -1) as 1 | -1 : clockwise;
  const stickers = toStickers(state).map((sticker): Sticker => {
    if (sticker.position[axis] !== layer) return sticker;
    return {
      color: sticker.color,
      normal: rotateVector(sticker.normal, axis, direction),
      position: rotateVector(sticker.position, axis, direction),
    };
  });
  return fromStickers(state.size, stickers);
}

export function applyMove(state: CubeState, move: Move): CubeState {
  if (!isFace(move.face)) throw new TypeError("Unknown move face");
  if (move.amount !== 1 && move.amount !== -1 && move.amount !== 2) {
    throw new TypeError("Move amount must be 1, -1 or 2");
  }

  if (move.amount === 2) {
    return applyQuarterTurn(applyQuarterTurn(state, move.face, false), move.face, false);
  }
  return applyQuarterTurn(state, move.face, move.amount === -1);
}

export function applyMoves(state: CubeState, moves: readonly Move[]): CubeState {
  return moves.reduce(applyMove, state);
}

export function invertMove(move: Move): Move {
  return Object.freeze({
    face: move.face,
    amount: move.amount === 2 ? 2 : move.amount === 1 ? -1 : 1,
  });
}

export function invertMoves(moves: readonly Move[]): readonly Move[] {
  return Object.freeze([...moves].reverse().map(invertMove));
}

const FACE_BY_NOTATION: Readonly<Record<string, Face>> = Object.freeze({
  U: Face.U,
  R: Face.R,
  F: Face.F,
  D: Face.D,
  L: Face.L,
  B: Face.B,
});

export function parseMove(notation: string): Move {
  const match = /^([URFDLB])([2']?)$/.exec(notation.trim());
  if (!match) throw new TypeError(`Invalid move notation: ${notation}`);
  return Object.freeze({
    face: FACE_BY_NOTATION[match[1]],
    amount: match[2] === "2" ? 2 : match[2] === "'" ? -1 : 1,
  });
}

export function parseAlgorithm(notation: string): readonly Move[] {
  const value = notation.trim();
  return Object.freeze(value === "" ? [] : value.split(/\s+/).map(parseMove));
}

export function formatMove(move: Move): string {
  if (!isFace(move.face)) throw new TypeError("Unknown move face");
  const suffix = move.amount === 2
    ? "2"
    : move.amount === -1
    ? "'"
    : move.amount === 1
    ? ""
    : undefined;
  if (suffix === undefined) throw new TypeError("Move amount must be 1, -1 or 2");
  return `${Face[move.face]}${suffix}`;
}

export function formatAlgorithm(moves: readonly Move[]): string {
  return moves.map(formatMove).join(" ");
}

export function serializeCube(state: CubeState): string {
  const payload: SerializedCube = {
    version: 1,
    size: state.size,
    facelets: FACE_ORDER.map((face) => [...state.faces[face]]),
  };
  return JSON.stringify(payload);
}

export function deserializeCube(serialized: string): CubeState {
  let payload: unknown;
  try {
    payload = JSON.parse(serialized);
  } catch {
    throw new TypeError("Cube snapshot is not valid JSON");
  }

  if (!isRecord(payload) || !hasExactKeys(payload, ["version", "size", "facelets"])) {
    throw new TypeError("Cube snapshot has an invalid shape");
  }
  if (payload.version !== 1 || !isCubeSize(payload.size) || !Array.isArray(payload.facelets)) {
    throw new TypeError("Cube snapshot has an unsupported version or size");
  }
  const size = payload.size;
  const facelets = payload.facelets;
  if (facelets.length !== FACE_ORDER.length) {
    throw new TypeError("Cube snapshot must contain six faces");
  }

  const faces = {} as Record<Face, StickerColor[]>;
  FACE_ORDER.forEach((face, index) => {
    const stickers = facelets[index];
    if (!Array.isArray(stickers)) throw new TypeError("Cube facelets must be arrays");
    faces[face] = [...stickers] as StickerColor[];
  });
  return createCubeState(size, faces);
}
