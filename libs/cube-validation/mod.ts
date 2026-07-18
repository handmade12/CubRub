import {
  countColors,
  type CubeState,
  Face,
  FACE_ORDER,
  STICKER_COLORS,
  StickerColor,
} from "@cuberub/cube-core";

export enum ValidationIssueCode {
  CenterColorsNotUnique = 1,
  UnknownCorner = 2,
  DuplicateCorner = 3,
  CornerOrientation = 4,
  UnknownEdge = 5,
  DuplicateEdge = 6,
  EdgeOrientation = 7,
  PermutationParity = 8,
  ColorCountMismatch = 9,
}

export interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly messageKey: string;
  readonly position?: number;
}

export interface PieceOrbit {
  readonly permutation: readonly number[];
  readonly orientation: readonly number[];
}

export interface CubiePattern {
  readonly corners: PieceOrbit;
  readonly edges?: PieceOrbit;
  readonly colorToFace: Readonly<Record<StickerColor, Face>>;
}

export interface ValidationReport {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly pattern?: CubiePattern;
}

interface Vector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface PieceSlot {
  readonly position: Vector;
  readonly faces: readonly Face[];
}

const CORNER_SLOTS: readonly PieceSlot[] = Object.freeze([
  Object.freeze({ position: { x: 1, y: 1, z: 1 }, faces: Object.freeze([Face.U, Face.R, Face.F]) }),
  Object.freeze({
    position: { x: -1, y: 1, z: 1 },
    faces: Object.freeze([Face.U, Face.F, Face.L]),
  }),
  Object.freeze({
    position: { x: -1, y: 1, z: -1 },
    faces: Object.freeze([Face.U, Face.L, Face.B]),
  }),
  Object.freeze({
    position: { x: 1, y: 1, z: -1 },
    faces: Object.freeze([Face.U, Face.B, Face.R]),
  }),
  Object.freeze({
    position: { x: 1, y: -1, z: 1 },
    faces: Object.freeze([Face.D, Face.F, Face.R]),
  }),
  Object.freeze({
    position: { x: -1, y: -1, z: 1 },
    faces: Object.freeze([Face.D, Face.L, Face.F]),
  }),
  Object.freeze({
    position: { x: -1, y: -1, z: -1 },
    faces: Object.freeze([Face.D, Face.B, Face.L]),
  }),
  Object.freeze({
    position: { x: 1, y: -1, z: -1 },
    faces: Object.freeze([Face.D, Face.R, Face.B]),
  }),
]);

const EDGE_SLOTS: readonly PieceSlot[] = Object.freeze([
  Object.freeze({ position: { x: 1, y: 1, z: 0 }, faces: Object.freeze([Face.U, Face.R]) }),
  Object.freeze({ position: { x: 0, y: 1, z: 1 }, faces: Object.freeze([Face.U, Face.F]) }),
  Object.freeze({ position: { x: -1, y: 1, z: 0 }, faces: Object.freeze([Face.U, Face.L]) }),
  Object.freeze({ position: { x: 0, y: 1, z: -1 }, faces: Object.freeze([Face.U, Face.B]) }),
  Object.freeze({ position: { x: 1, y: -1, z: 0 }, faces: Object.freeze([Face.D, Face.R]) }),
  Object.freeze({ position: { x: 0, y: -1, z: 1 }, faces: Object.freeze([Face.D, Face.F]) }),
  Object.freeze({ position: { x: -1, y: -1, z: 0 }, faces: Object.freeze([Face.D, Face.L]) }),
  Object.freeze({ position: { x: 0, y: -1, z: -1 }, faces: Object.freeze([Face.D, Face.B]) }),
  Object.freeze({ position: { x: 1, y: 0, z: 1 }, faces: Object.freeze([Face.F, Face.R]) }),
  Object.freeze({ position: { x: -1, y: 0, z: 1 }, faces: Object.freeze([Face.F, Face.L]) }),
  Object.freeze({ position: { x: -1, y: 0, z: -1 }, faces: Object.freeze([Face.B, Face.L]) }),
  Object.freeze({ position: { x: 1, y: 0, z: -1 }, faces: Object.freeze([Face.B, Face.R]) }),
]);

const STANDARD_COLOR_TO_FACE: Readonly<Record<StickerColor, Face>> = Object.freeze({
  [StickerColor.White]: Face.U,
  [StickerColor.Yellow]: Face.D,
  [StickerColor.Red]: Face.R,
  [StickerColor.Orange]: Face.L,
  [StickerColor.Blue]: Face.B,
  [StickerColor.Green]: Face.F,
});

const FACE_NORMAL: Readonly<Record<Face, Vector>> = Object.freeze({
  [Face.U]: Object.freeze({ x: 0, y: 1, z: 0 }),
  [Face.D]: Object.freeze({ x: 0, y: -1, z: 0 }),
  [Face.R]: Object.freeze({ x: 1, y: 0, z: 0 }),
  [Face.L]: Object.freeze({ x: -1, y: 0, z: 0 }),
  [Face.F]: Object.freeze({ x: 0, y: 0, z: 1 }),
  [Face.B]: Object.freeze({ x: 0, y: 0, z: -1 }),
});

const OPPOSITE_FACE: Readonly<Record<Face, Face>> = Object.freeze({
  [Face.U]: Face.D,
  [Face.D]: Face.U,
  [Face.R]: Face.L,
  [Face.L]: Face.R,
  [Face.F]: Face.B,
  [Face.B]: Face.F,
});

const ADJACENT_FACES: Readonly<Record<Face, readonly Face[]>> = Object.freeze({
  [Face.U]: Object.freeze([Face.R, Face.F, Face.L, Face.B]),
  [Face.D]: Object.freeze([Face.F, Face.R, Face.B, Face.L]),
  [Face.R]: Object.freeze([Face.F, Face.U, Face.B, Face.D]),
  [Face.L]: Object.freeze([Face.B, Face.U, Face.F, Face.D]),
  [Face.F]: Object.freeze([Face.R, Face.U, Face.L, Face.D]),
  [Face.B]: Object.freeze([Face.L, Face.U, Face.R, Face.D]),
});

function crossFace(a: Face, b: Face): Face | undefined {
  const va = FACE_NORMAL[a];
  const vb = FACE_NORMAL[b];
  const x = va.y * vb.z - va.z * vb.y;
  const y = va.z * vb.x - va.x * vb.z;
  const z = va.x * vb.y - va.y * vb.x;
  if (x === 1 && y === 0 && z === 0) return Face.R;
  if (x === -1 && y === 0 && z === 0) return Face.L;
  if (x === 0 && y === 1 && z === 0) return Face.U;
  if (x === 0 && y === -1 && z === 0) return Face.D;
  if (x === 0 && y === 0 && z === 1) return Face.F;
  if (x === 0 && y === 0 && z === -1) return Face.B;
  return undefined;
}

function buildColorToFace(
  up: Face,
  right: Face,
  front: Face,
): Readonly<Record<StickerColor, Face>> {
  return Object.freeze({
    [StickerColor.White]: up,
    [StickerColor.Yellow]: OPPOSITE_FACE[up],
    [StickerColor.Red]: right,
    [StickerColor.Orange]: OPPOSITE_FACE[right],
    [StickerColor.Green]: front,
    [StickerColor.Blue]: OPPOSITE_FACE[front],
  });
}

const ORIENTATION_MAPS: readonly (Readonly<Record<StickerColor, Face>>)[] = Object.freeze(
  (() => {
    const list: Readonly<Record<StickerColor, Face>>[] = [];
    for (const up of FACE_ORDER) {
      for (const front of ADJACENT_FACES[up]) {
        const right = crossFace(up, front);
        if (right === undefined) continue;
        list.push(buildColorToFace(up, right, front));
      }
    }
    return list;
  })(),
);

export function getOrientationMaps(): readonly (Readonly<Record<StickerColor, Face>>)[] {
  return ORIENTATION_MAPS;
}

function issue(code: ValidationIssueCode, position?: number): ValidationIssue {
  return Object.freeze({
    code,
    messageKey: `validation.${ValidationIssueCode[code]}`,
    ...(position === undefined ? {} : { position }),
  });
}

function coordinateIndex(size: 2 | 3, value: number): number {
  if (!Number.isInteger(value) || value < -1 || value > 1) {
    throw new Error("Sticker coordinate must be -1, 0 or 1");
  }
  if (size === 2) {
    if (value === 0) throw new Error("A 2x2 sticker cannot use a middle coordinate");
    return value === -1 ? 0 : 1;
  }
  return value + 1;
}

function stickerIndex(state: CubeState, face: Face, position: Vector): number {
  const last = state.size - 1;
  const x = coordinateIndex(state.size, position.x);
  const y = coordinateIndex(state.size, position.y);
  const z = coordinateIndex(state.size, position.z);
  let row: number;
  let column: number;

  switch (face) {
    case Face.U:
      row = z;
      column = x;
      break;
    case Face.R:
      row = last - y;
      column = last - z;
      break;
    case Face.F:
      row = last - y;
      column = x;
      break;
    case Face.D:
      row = last - z;
      column = x;
      break;
    case Face.L:
      row = last - y;
      column = z;
      break;
    case Face.B:
      row = last - y;
      column = last - x;
      break;
  }

  return row * state.size + column;
}

function colorsAtSlot(
  state: CubeState,
  slot: PieceSlot,
  colorToFace: Readonly<Record<StickerColor, Face>>,
): Face[] {
  return slot.faces.map((face) =>
    colorToFace[state.faces[face][stickerIndex(state, face, slot.position)]]
  );
}

function decodeCorners(
  state: CubeState,
  colorToFace: Readonly<Record<StickerColor, Face>>,
  issues: ValidationIssue[],
): PieceOrbit | undefined {
  const permutation: number[] = [];
  const orientation: number[] = [];

  CORNER_SLOTS.forEach((slot, position) => {
    const colors = colorsAtSlot(state, slot, colorToFace);
    const twist = colors.findIndex((color) => color === Face.U || color === Face.D);
    if (twist === -1) {
      issues.push(issue(ValidationIssueCode.UnknownCorner, position));
      return;
    }

    const sideOne = colors[(twist + 1) % 3];
    const sideTwo = colors[(twist + 2) % 3];
    const cubie = CORNER_SLOTS.findIndex((candidate) =>
      candidate.faces[0] === colors[twist] &&
      candidate.faces[1] === sideOne &&
      candidate.faces[2] === sideTwo
    );
    if (cubie === -1) {
      issues.push(issue(ValidationIssueCode.UnknownCorner, position));
      return;
    }

    permutation[position] = cubie;
    orientation[position] = twist;
  });

  if (permutation.length !== CORNER_SLOTS.length) return undefined;
  if (new Set(permutation).size !== CORNER_SLOTS.length) {
    issues.push(issue(ValidationIssueCode.DuplicateCorner));
  }
  if (orientation.reduce((sum, value) => sum + value, 0) % 3 !== 0) {
    issues.push(issue(ValidationIssueCode.CornerOrientation));
  }

  return Object.freeze({
    permutation: Object.freeze(permutation),
    orientation: Object.freeze(orientation),
  });
}

function decodeEdges(
  state: CubeState,
  colorToFace: Readonly<Record<StickerColor, Face>>,
  issues: ValidationIssue[],
): PieceOrbit | undefined {
  const permutation: number[] = [];
  const orientation: number[] = [];

  EDGE_SLOTS.forEach((slot, position) => {
    const colors = colorsAtSlot(state, slot, colorToFace);
    const cubie = EDGE_SLOTS.findIndex((candidate) =>
      candidate.faces[0] === colors[0] && candidate.faces[1] === colors[1]
    );
    if (cubie !== -1) {
      permutation[position] = cubie;
      orientation[position] = 0;
      return;
    }

    const flippedCubie = EDGE_SLOTS.findIndex((candidate) =>
      candidate.faces[0] === colors[1] && candidate.faces[1] === colors[0]
    );
    if (flippedCubie === -1) {
      issues.push(issue(ValidationIssueCode.UnknownEdge, position));
      return;
    }
    permutation[position] = flippedCubie;
    orientation[position] = 1;
  });

  if (permutation.length !== EDGE_SLOTS.length) return undefined;
  if (new Set(permutation).size !== EDGE_SLOTS.length) {
    issues.push(issue(ValidationIssueCode.DuplicateEdge));
  }
  if (orientation.reduce((sum, value) => sum + value, 0) % 2 !== 0) {
    issues.push(issue(ValidationIssueCode.EdgeOrientation));
  }

  return Object.freeze({
    permutation: Object.freeze(permutation),
    orientation: Object.freeze(orientation),
  });
}

function permutationParity(permutation: readonly number[]): 0 | 1 {
  let inversions = 0;
  for (let left = 0; left < permutation.length; left += 1) {
    for (let right = left + 1; right < permutation.length; right += 1) {
      if (permutation[left] > permutation[right]) inversions += 1;
    }
  }
  return inversions % 2 as 0 | 1;
}

function isCornerOrbitValid(corners: PieceOrbit): boolean {
  return new Set(corners.permutation).size === CORNER_SLOTS.length &&
    corners.orientation.reduce((sum, value) => sum + value, 0) % 3 === 0;
}

function readCentersColorToFace(
  state: CubeState,
  issues: ValidationIssue[],
): Readonly<Record<StickerColor, Face>> | undefined {
  const colorToFace = {} as Record<StickerColor, Face>;
  const centerIndex = 4;
  for (const face of FACE_ORDER) {
    const color = state.faces[face][centerIndex];
    if (colorToFace[color] !== undefined) {
      issues.push(issue(ValidationIssueCode.CenterColorsNotUnique));
      return undefined;
    }
    colorToFace[color] = face;
  }
  if (STICKER_COLORS.some((color) => colorToFace[color] === undefined)) {
    issues.push(issue(ValidationIssueCode.CenterColorsNotUnique));
    return undefined;
  }
  return Object.freeze(colorToFace);
}

function findColorToFaceFor2x2(
  state: CubeState,
  issues: ValidationIssue[],
): Readonly<Record<StickerColor, Face>> | undefined {
  const standardTrial: ValidationIssue[] = [];
  const standardCorners = decodeCorners(state, STANDARD_COLOR_TO_FACE, standardTrial);
  if (standardCorners && isCornerOrbitValid(standardCorners)) {
    return STANDARD_COLOR_TO_FACE;
  }
  for (const candidate of ORIENTATION_MAPS) {
    if (candidate === STANDARD_COLOR_TO_FACE) continue;
    const trial: ValidationIssue[] = [];
    const corners = decodeCorners(state, candidate, trial);
    if (corners && isCornerOrbitValid(corners)) {
      return candidate;
    }
  }
  decodeCorners(state, STANDARD_COLOR_TO_FACE, issues);
  return undefined;
}

export function validateCube(state: CubeState): ValidationReport {
  const issues: ValidationIssue[] = [];

  const counts = countColors(state);
  const expected = state.size * state.size;
  for (const color of STICKER_COLORS) {
    if (counts[color] !== expected) {
      issues.push(issue(ValidationIssueCode.ColorCountMismatch));
      return Object.freeze({ valid: false, issues: Object.freeze(issues) });
    }
  }

  const colorToFace = state.size === 3
    ? readCentersColorToFace(state, issues)
    : findColorToFaceFor2x2(state, issues);
  if (!colorToFace) return Object.freeze({ valid: false, issues: Object.freeze(issues) });

  const corners = decodeCorners(state, colorToFace, issues);
  const edges = state.size === 3 ? decodeEdges(state, colorToFace, issues) : undefined;

  if (
    state.size === 3 &&
    corners &&
    edges &&
    new Set(corners.permutation).size === CORNER_SLOTS.length &&
    new Set(edges.permutation).size === EDGE_SLOTS.length &&
    permutationParity(corners.permutation) !== permutationParity(edges.permutation)
  ) {
    issues.push(issue(ValidationIssueCode.PermutationParity));
  }

  const valid = issues.length === 0 && corners !== undefined &&
    (state.size === 2 || edges !== undefined);
  const pattern = valid
    ? Object.freeze({
      corners,
      ...(edges ? { edges } : {}),
      colorToFace,
    }) as CubiePattern
    : undefined;

  return Object.freeze({
    valid,
    issues: Object.freeze(issues),
    ...(pattern ? { pattern } : {}),
  });
}
