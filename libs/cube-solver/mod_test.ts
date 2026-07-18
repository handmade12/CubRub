import { emptyFlow, goNext, paint, startReview } from "@cuberub/cube-application";
import {
  applyMoves,
  createCubeState,
  createSolvedCube,
  cubeEquals,
  type CubeState,
  Face,
  FACE_ORDER,
  parseAlgorithm,
  StickerColor,
} from "@cuberub/cube-core";
import { getAllCaptureGuides, toCubeState } from "@cuberub/cube-input";
import { CubeSolveError, CubeSolveErrorCode, isVisuallySolved, solveCube } from "./mod.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

function rotatedSolved(size: 2 | 3): CubeState {
  const count = size * size;
  return createCubeState(size, {
    [Face.U]: Array(count).fill(StickerColor.White),
    [Face.R]: Array(count).fill(StickerColor.Blue),
    [Face.F]: Array(count).fill(StickerColor.Red),
    [Face.D]: Array(count).fill(StickerColor.Yellow),
    [Face.L]: Array(count).fill(StickerColor.Green),
    [Face.B]: Array(count).fill(StickerColor.Orange),
  });
}

function whiteFrontSolved3x3(): CubeState {
  const canonical = createSolvedCube(3);
  return createCubeState(3, {
    [Face.U]: canonical.faces[Face.B],
    [Face.R]: canonical.faces[Face.R],
    [Face.F]: canonical.faces[Face.U],
    [Face.D]: canonical.faces[Face.F],
    [Face.L]: canonical.faces[Face.L],
    [Face.B]: canonical.faces[Face.D],
  });
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

Deno.test("solved cubes return an empty solution", async () => {
  for (const size of [2, 3] as const) {
    const solution = await solveCube(createSolvedCube(size));
    assert(solution.moveCount === 0);
    assert(solution.notation === "");
  }
});

Deno.test("solver deterministically solves 2x2 and 3x3 scrambles", async () => {
  const scrambles = [
    "R U F",
    "R U R' U' F2",
    "F2 L D' B R2 U",
  ];
  for (const size of [2, 3] as const) {
    for (const scramble of scrambles) {
      const state = applyMoves(createSolvedCube(size), parseAlgorithm(scramble));
      const first = await solveCube(state);
      const second = await solveCube(state);
      assert(first.notation === second.notation, `${size}x${size} is not deterministic`);
      assert(
        isVisuallySolved(applyMoves(state, first.moves)),
        `${size}x${size} failed ${scramble}`,
      );
    }
  }
});

Deno.test("solver handles an arbitrary whole-cube starting orientation", async () => {
  for (const size of [2, 3] as const) {
    const state = applyMoves(rotatedSolved(size), parseAlgorithm("R U F2 L'"));
    const solution = await solveCube(state);
    assert(isVisuallySolved(applyMoves(state, solution.moves)));
  }
});

Deno.test("white-front solved and all-face scramble captures reach review and solve", async () => {
  const solved = whiteFrontSolved3x3();
  const fixtures = [
    { name: "solved", cube: solved },
    { name: "scrambled", cube: applyMoves(solved, parseAlgorithm("F R B L U D")) },
  ] as const;
  for (const fixture of fixtures) {
    let flow = emptyFlow(3);
    for (const guide of getAllCaptureGuides()) {
      for (let index = 0; index < 9; index += 1) {
        flow = paint(flow, index, fixture.cube.faces[guide.face][index]);
      }
      flow = goNext(flow);
      assert(flow.error === null, `${fixture.name} capture failed at ${Face[guide.face]}`);
    }
    flow = startReview(flow);
    assert(flow.stage === "review", `${fixture.name} did not reach review`);
    const captured = toCubeState(flow.session);
    assert(cubeEquals(captured, fixture.cube), `${fixture.name} capture changed stickers`);
    const solution = await solveCube(captured);
    assert(cubeEquals(applyMoves(captured, solution.moves), solved));
  }
});

Deno.test("physically impossible input is rejected before solving", async () => {
  for (const size of [2, 3] as const) {
    try {
      await solveCube(twistOneCorner(createSolvedCube(size)));
    } catch (error) {
      assert(error instanceof CubeSolveError);
      assert(error.code === CubeSolveErrorCode.InvalidState);
      continue;
    }
    throw new Error(`Invalid ${size}x${size} cube was accepted`);
  }
});
