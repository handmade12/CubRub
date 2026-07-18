import {
  applyMoves,
  createCubeState,
  createSolvedCube,
  type CubeSize,
  type CubeState,
  Face,
  FACE_ORDER,
  parseAlgorithm,
  StickerColor,
} from "@cuberub/cube-core";
import { getOrientationMaps, validateCube, ValidationIssueCode } from "./mod.ts";

interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}

function hasIssue(state: CubeState, code: ValidationIssueCode): boolean {
  return validateCube(state).issues.some((issue) => issue.code === code);
}

function mutate(
  state: CubeState,
  changes: readonly [Face, number, StickerColor][],
): CubeState {
  const faces = {} as Record<Face, StickerColor[]>;
  for (const face of FACE_ORDER) faces[face] = [...state.faces[face]];
  for (const [face, index, color] of changes) faces[face][index] = color;
  return createCubeState(state.size, faces);
}

function swapStickers(
  state: CubeState,
  left: readonly [Face, number],
  right: readonly [Face, number],
): CubeState {
  const leftColor = state.faces[left[0]][left[1]];
  const rightColor = state.faces[right[0]][right[1]];
  return mutate(state, [
    [left[0], left[1], rightColor],
    [right[0], right[1], leftColor],
  ]);
}

function forceState(faces: Record<Face, StickerColor[]>, size: CubeSize): CubeState {
  for (const face of FACE_ORDER) Object.freeze(faces[face]);
  return Object.freeze({
    size,
    faces: Object.freeze(faces) as Readonly<Record<Face, readonly StickerColor[]>>,
  }) as unknown as CubeState;
}

const FACE_NORMAL: Readonly<Record<Face, Vec3>> = Object.freeze({
  [Face.U]: Object.freeze({ x: 0, y: 1, z: 0 }),
  [Face.D]: Object.freeze({ x: 0, y: -1, z: 0 }),
  [Face.R]: Object.freeze({ x: 1, y: 0, z: 0 }),
  [Face.L]: Object.freeze({ x: -1, y: 0, z: 0 }),
  [Face.F]: Object.freeze({ x: 0, y: 0, z: 1 }),
  [Face.B]: Object.freeze({ x: 0, y: 0, z: -1 }),
});

const NORMAL_TO_FACE = new Map<string, Face>();
for (const face of FACE_ORDER) {
  const n = FACE_NORMAL[face];
  NORMAL_TO_FACE.set(`${n.x},${n.y},${n.z}`, face);
}

function levels(size: CubeSize): readonly number[] {
  return size === 2 ? [-1, 1] : [-1, 0, 1];
}

function coord(size: CubeSize, index: number): number {
  return levels(size)[index];
}

function coordIndex(size: CubeSize, value: number): number {
  const idx = levels(size).indexOf(value);
  if (idx === -1) throw new Error(`bad coord ${value}`);
  return idx;
}

function stickerPosition(state: CubeState, face: Face, row: number, column: number): Vec3 {
  const last = state.size - 1;
  switch (face) {
    case Face.U:
      return { x: coord(state.size, column), y: 1, z: coord(state.size, row) };
    case Face.D:
      return { x: coord(state.size, column), y: -1, z: coord(state.size, last - row) };
    case Face.R:
      return { x: 1, y: coord(state.size, last - row), z: coord(state.size, last - column) };
    case Face.L:
      return { x: -1, y: coord(state.size, last - row), z: coord(state.size, column) };
    case Face.F:
      return { x: coord(state.size, column), y: coord(state.size, last - row), z: 1 };
    case Face.B:
      return { x: coord(state.size, last - column), y: coord(state.size, last - row), z: -1 };
  }
}

function rotateCube(state: CubeState, up: Face, front: Face): CubeState {
  const nUp = FACE_NORMAL[up];
  const nFront = FACE_NORMAL[front];
  const nRight: Vec3 = {
    x: nUp.y * nFront.z - nUp.z * nFront.y,
    y: nUp.z * nFront.x - nUp.x * nFront.z,
    z: nUp.x * nFront.y - nUp.y * nFront.x,
  };
  function apply(v: Vec3): Vec3 {
    return {
      x: v.x * nRight.x + v.y * nUp.x + v.z * nFront.x,
      y: v.x * nRight.y + v.y * nUp.y + v.z * nFront.y,
      z: v.x * nRight.z + v.y * nUp.z + v.z * nFront.z,
    };
  }
  const faces = {} as Record<Face, StickerColor[]>;
  for (const face of FACE_ORDER) {
    faces[face] = Array<StickerColor>(state.size * state.size).fill(StickerColor.White);
  }
  for (const face of FACE_ORDER) {
    for (let index = 0; index < state.size * state.size; index += 1) {
      const row = Math.floor(index / state.size);
      const column = index % state.size;
      const np = apply(stickerPosition(state, face, row, column));
      const nn = apply(FACE_NORMAL[face]);
      const newFace = NORMAL_TO_FACE.get(`${nn.x},${nn.y},${nn.z}`);
      if (!newFace) throw new Error(`bad face ${nn.x},${nn.y},${nn.z}`);
      const last = state.size - 1;
      let newRow = 0;
      let newColumn = 0;
      switch (newFace) {
        case Face.U:
          newRow = coordIndex(state.size, np.z);
          newColumn = coordIndex(state.size, np.x);
          break;
        case Face.D:
          newRow = last - coordIndex(state.size, np.z);
          newColumn = coordIndex(state.size, np.x);
          break;
        case Face.R:
          newRow = last - coordIndex(state.size, np.y);
          newColumn = last - coordIndex(state.size, np.z);
          break;
        case Face.L:
          newRow = last - coordIndex(state.size, np.y);
          newColumn = coordIndex(state.size, np.z);
          break;
        case Face.F:
          newRow = last - coordIndex(state.size, np.y);
          newColumn = coordIndex(state.size, np.x);
          break;
        case Face.B:
          newRow = last - coordIndex(state.size, np.y);
          newColumn = last - coordIndex(state.size, np.x);
          break;
      }
      faces[newFace][newRow * state.size + newColumn] = state.faces[face][index];
    }
  }
  return createCubeState(state.size, faces);
}

function enumerateRotations(): readonly { readonly up: Face; readonly front: Face }[] {
  const opposite = {
    [Face.U]: Face.D,
    [Face.D]: Face.U,
    [Face.R]: Face.L,
    [Face.L]: Face.R,
    [Face.F]: Face.B,
    [Face.B]: Face.F,
  } as const;
  const seen = new Set<string>();
  const out: { up: Face; front: Face }[] = [];
  for (const up of FACE_ORDER) {
    for (const front of FACE_ORDER) {
      if (front === up || front === opposite[up]) continue;
      const key = `${up},${front}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ up, front });
    }
  }
  return Object.freeze(out);
}

Deno.test("solved 2x2 and 3x3 cubes are physically valid", () => {
  for (const size of [2, 3] as const) {
    const report = validateCube(createSolvedCube(size));
    assert(report.valid);
    assert(report.pattern);
    assert(report.pattern.corners.permutation.every((piece, index) => piece === index));
  }
});

Deno.test("deterministic legal scrambles stay valid", () => {
  const algorithms = [
    "R U R' U'",
    "F2 L D' B R2 U",
    "R U2 F' L2 D B' U R2",
    "B L2 U' F R D2 L'",
  ];
  for (const size of [2, 3] as const) {
    for (const algorithm of algorithms) {
      const state = applyMoves(createSolvedCube(size), parseAlgorithm(algorithm));
      const report = validateCube(state);
      assert(report.valid, `${size}x${size} rejected ${algorithm}`);
    }
  }
});

Deno.test("a single twisted corner is rejected", () => {
  const solved = createSolvedCube(3);
  const u = solved.faces[Face.U][8];
  const r = solved.faces[Face.R][0];
  const f = solved.faces[Face.F][2];
  const twisted = mutate(solved, [
    [Face.U, 8, r],
    [Face.R, 0, f],
    [Face.F, 2, u],
  ]);
  assert(hasIssue(twisted, ValidationIssueCode.CornerOrientation));
});

Deno.test("a single flipped edge is rejected", () => {
  const flipped = swapStickers(createSolvedCube(3), [Face.U, 7], [Face.F, 1]);
  assert(hasIssue(flipped, ValidationIssueCode.EdgeOrientation));
});

Deno.test("a two-corner swap is rejected on 3x3 by parity", () => {
  let state = createSolvedCube(3);
  const first = [[Face.U, 8], [Face.R, 0], [Face.F, 2]] as const;
  const second = [[Face.U, 6], [Face.F, 0], [Face.L, 2]] as const;
  for (let index = 0; index < 3; index += 1) {
    state = swapStickers(state, first[index], second[index]);
  }
  assert(hasIssue(state, ValidationIssueCode.PermutationParity));
});

Deno.test("2x2 accepts odd corner permutations", () => {
  let state = createSolvedCube(2);
  const first = [[Face.U, 3], [Face.R, 0], [Face.F, 1]] as const;
  const second = [[Face.U, 2], [Face.F, 0], [Face.L, 1]] as const;
  for (let index = 0; index < 3; index += 1) {
    state = swapStickers(state, first[index], second[index]);
  }
  assert(validateCube(state).valid);
});

Deno.test("duplicate 3x3 centers are rejected", () => {
  const solved = createSolvedCube(3);
  const invalid = mutate(solved, [
    [Face.R, 4, StickerColor.Green],
    [Face.F, 0, StickerColor.Red],
  ]);
  assert(hasIssue(invalid, ValidationIssueCode.CenterColorsNotUnique));
});

Deno.test("mirrored corner stickers are rejected", () => {
  const mirrored = swapStickers(createSolvedCube(3), [Face.R, 0], [Face.F, 2]);
  assert(hasIssue(mirrored, ValidationIssueCode.UnknownCorner));
});

Deno.test("validation report is immutable", () => {
  const report = validateCube(createSolvedCube(3));
  assert(Object.isFrozen(report));
  assert(Object.isFrozen(report.issues));
  assert(report.pattern && Object.isFrozen(report.pattern));
});

Deno.test("exactly 24 whole-cube rotations are enumerated", () => {
  equal(getOrientationMaps().length, 24);
  const seen = new Set(
    getOrientationMaps().map((map) =>
      `${map[StickerColor.White]},${map[StickerColor.Yellow]},${map[StickerColor.Red]},${
        map[StickerColor.Orange]
      },${map[StickerColor.Green]},${map[StickerColor.Blue]}`
    ),
  );
  equal(seen.size, 24);
});

Deno.test("all 24 whole-cube orientations of a solved cube are accepted", () => {
  const rotations = enumerateRotations();
  for (const size of [2, 3] as const) {
    const solved = createSolvedCube(size);
    for (const rotation of rotations) {
      const rotated = rotateCube(solved, rotation.up, rotation.front);
      const report = validateCube(rotated);
      assert(
        report.valid,
        `${size}x${size} rejected rotation with U=${Face[rotation.up]}`,
      );
    }
  }
});

Deno.test("all 24 whole-cube orientations of a scrambled cube are accepted", () => {
  const rotations = enumerateRotations();
  for (const size of [2, 3] as const) {
    const scrambled = applyMoves(createSolvedCube(size), parseAlgorithm("R U R' U' F2"));
    for (const rotation of rotations) {
      const rotated = rotateCube(scrambled, rotation.up, rotation.front);
      const report = validateCube(rotated);
      assert(
        report.valid,
        `${size}x${size} rejected scrambled rotation with U=${Face[rotation.up]}`,
      );
    }
  }
});

Deno.test("overall rotated color schemes are accepted", () => {
  const schemes = [
    Object.freeze({
      [Face.U]: StickerColor.Orange,
      [Face.R]: StickerColor.White,
      [Face.F]: StickerColor.Green,
      [Face.D]: StickerColor.Red,
      [Face.L]: StickerColor.Yellow,
      [Face.B]: StickerColor.Blue,
    }),
    Object.freeze({
      [Face.U]: StickerColor.Red,
      [Face.R]: StickerColor.Yellow,
      [Face.F]: StickerColor.Green,
      [Face.D]: StickerColor.Orange,
      [Face.L]: StickerColor.White,
      [Face.B]: StickerColor.Blue,
    }),
    Object.freeze({
      [Face.U]: StickerColor.Yellow,
      [Face.R]: StickerColor.Orange,
      [Face.F]: StickerColor.Green,
      [Face.D]: StickerColor.White,
      [Face.L]: StickerColor.Red,
      [Face.B]: StickerColor.Blue,
    }),
  ];
  for (const size of [2, 3] as const) {
    for (const scheme of schemes) {
      const faces = {} as Record<Face, StickerColor[]>;
      for (const face of FACE_ORDER) {
        faces[face] = Array<StickerColor>(size * size).fill(scheme[face]);
      }
      const state = createCubeState(size, faces);
      assert(validateCube(state).valid, `${size}x${size} rejected scheme`);
    }
  }
});

Deno.test("defensive color count mismatch is rejected", () => {
  const solved = createSolvedCube(3);
  const faces = {} as Record<Face, StickerColor[]>;
  for (const face of FACE_ORDER) faces[face] = [...solved.faces[face]];
  faces[Face.U][0] = StickerColor.Blue;
  const broken = forceState(faces, 3);
  assert(hasIssue(broken, ValidationIssueCode.ColorCountMismatch));
});

Deno.test("a single twisted 2x2 corner is rejected", () => {
  const solved = createSolvedCube(2);
  const u = solved.faces[Face.U][3];
  const r = solved.faces[Face.R][0];
  const f = solved.faces[Face.F][1];
  const twisted = mutate(solved, [
    [Face.U, 3, r],
    [Face.R, 0, f],
    [Face.F, 1, u],
  ]);
  assert(hasIssue(twisted, ValidationIssueCode.CornerOrientation));
});

Deno.test("missing corner cubies on 3x3 are rejected", () => {
  const solved = createSolvedCube(3);
  const broken = swapStickers(solved, [Face.U, 8], [Face.B, 0]);
  assert(hasIssue(broken, ValidationIssueCode.UnknownCorner));
});

Deno.test("scrambled 2x2 in arbitrary orientation keeps cubie parity unconstrained", () => {
  const rotations = enumerateRotations();
  const scrambled = applyMoves(createSolvedCube(2), parseAlgorithm("R F R' F' R2"));
  for (const rotation of rotations) {
    const rotated = rotateCube(scrambled, rotation.up, rotation.front);
    assert(validateCube(rotated).valid);
  }
});

Deno.test("validation issues carry locale-independent enum codes", () => {
  const solved = createSolvedCube(3);
  const twisted = mutate(solved, [
    [Face.U, 8, solved.faces[Face.R][0]],
    [Face.R, 0, solved.faces[Face.F][2]],
    [Face.F, 2, solved.faces[Face.U][8]],
  ]);
  const report = validateCube(twisted);
  assert(!report.valid);
  assert(report.issues.length > 0);
  for (const issue of report.issues) {
    assert(Number.isInteger(issue.code));
    assert(issue.code >= 1);
    assert(typeof issue.messageKey === "string" && issue.messageKey.length > 0);
  }
});
