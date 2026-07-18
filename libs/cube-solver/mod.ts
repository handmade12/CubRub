import {
  applyMoves,
  type CubeState,
  Face,
  FACE_ORDER,
  formatAlgorithm,
  type Move,
  parseAlgorithm,
} from "@cuberub/cube-core";
import { type CubiePattern, validateCube } from "@cuberub/cube-validation";
import { KPattern, type KPatternData, type KPuzzle } from "cubing/kpuzzle";
import { cube2x2x2, cube3x3x3 } from "cubing/puzzles";
import { experimentalSolve2x2x2, experimentalSolve3x3x3IgnoringCenters } from "cubing/search";

export enum CubeSolveErrorCode {
  InvalidState = 1,
  ProviderFailure = 2,
  UnsupportedMove = 3,
  VerificationFailed = 4,
}

export class CubeSolveError extends Error {
  constructor(readonly code: CubeSolveErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CubeSolveError";
  }
}

export interface CubeSolution {
  readonly moves: readonly Move[];
  readonly notation: string;
  readonly moveCount: number;
  readonly provider: "cubing@0.63.3";
}

const CORNER_INDEX_TO_CUBING = Object.freeze([0, 3, 2, 1, 4, 5, 6, 7]);
const EDGE_INDEX_TO_CUBING = Object.freeze([1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10]);

function solveError(code: CubeSolveErrorCode, message: string, cause?: unknown): never {
  throw new CubeSolveError(code, message, cause === undefined ? undefined : { cause });
}

function remapOrbit(
  orbit: CubiePattern["corners"],
  indexMap: readonly number[],
): KPatternData[string] {
  const pieces = Array<number>(indexMap.length);
  const orientation = Array<number>(indexMap.length);
  orbit.permutation.forEach((piece, position) => {
    const cubingPosition = indexMap[position];
    pieces[cubingPosition] = indexMap[piece];
    orientation[cubingPosition] = orbit.orientation[position];
  });
  return { pieces, orientation };
}

async function toKPattern(state: CubeState, pattern: CubiePattern): Promise<KPattern> {
  const kpuzzle: KPuzzle = state.size === 2 ? await cube2x2x2.kpuzzle() : await cube3x3x3.kpuzzle();
  const patternData: KPatternData = {
    CORNERS: remapOrbit(pattern.corners, CORNER_INDEX_TO_CUBING),
  };

  if (state.size === 3) {
    if (!pattern.edges) solveError(CubeSolveErrorCode.InvalidState, "3x3 edge data is missing");
    patternData.EDGES = remapOrbit(pattern.edges, EDGE_INDEX_TO_CUBING);
    const centers = kpuzzle.defaultPattern().patternData.CENTERS;
    patternData.CENTERS = {
      pieces: [...centers.pieces],
      orientation: [...centers.orientation],
      ...(centers.orientationMod ? { orientationMod: [...centers.orientationMod] } : {}),
    };
  }

  return new KPattern(kpuzzle, patternData);
}

export function isVisuallySolved(state: CubeState): boolean {
  return FACE_ORDER.every((face) =>
    state.faces[face].every((color) => color === state.faces[face][0])
  );
}

function emptySolution(): CubeSolution {
  return Object.freeze({
    moves: Object.freeze([]),
    notation: "",
    moveCount: 0,
    provider: "cubing@0.63.3",
  });
}

export async function solveCube(state: CubeState): Promise<CubeSolution> {
  const validation = validateCube(state);
  if (!validation.valid || !validation.pattern) {
    solveError(CubeSolveErrorCode.InvalidState, "Cube state is physically impossible");
  }
  if (isVisuallySolved(state)) return emptySolution();

  const pattern = await toKPattern(state, validation.pattern);
  let notation: string;
  try {
    const algorithm = state.size === 2
      ? await experimentalSolve2x2x2(pattern)
      : await experimentalSolve3x3x3IgnoringCenters(pattern);
    notation = algorithm.toString().trim();
  } catch (error) {
    solveError(CubeSolveErrorCode.ProviderFailure, "Solver could not produce a solution", error);
  }

  let moves: readonly Move[];
  try {
    moves = parseAlgorithm(notation);
  } catch (error) {
    solveError(
      CubeSolveErrorCode.UnsupportedMove,
      "Solver returned unsupported move notation",
      error,
    );
  }

  if (!isVisuallySolved(applyMoves(state, moves))) {
    solveError(CubeSolveErrorCode.VerificationFailed, "Generated solution failed verification");
  }

  return Object.freeze({
    moves: Object.freeze([...moves]),
    notation: formatAlgorithm(moves),
    moveCount: moves.length,
    provider: "cubing@0.63.3",
  });
}

export const SOLVER_LICENSE_NOTICE = Object.freeze({
  name: "cubing.js",
  version: "0.63.3",
  license: "MPL-2.0 OR GPL-3.0-or-later",
  source: "https://github.com/cubing/cubing.js",
});

export function faceName(face: Face): string {
  return Face[face];
}
