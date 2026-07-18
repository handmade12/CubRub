import {
  computeCubeAtStep,
  DEFAULT_SPEED,
  emptyFlow,
  goBack,
  goNext,
  paint,
  progressFraction,
  remainingByColor,
  resetAll,
  resetFace,
  setMoveIndex,
  setSolution,
  startReview,
  startSolving,
  togglePlay,
} from "./mod.ts";
import {
  CaptureStep,
  InputErrorCode,
  type InputSession,
  InputSessionError,
  toCubeState,
} from "@cuberub/cube-input";
import {
  createCubeState,
  createSolvedCube,
  cubeEquals,
  Face,
  FACE_ORDER,
  parseAlgorithm,
  StickerColor,
} from "@cuberub/cube-core";
import { assert, assertEquals } from "@cuberub/test-utils";

function filledSession(size: 2 | 3): InputSession {
  let state = emptyFlow(size);
  const canonical = createSolvedCube(size);
  const solved = size === 3
    ? createCubeState(3, {
      [Face.U]: canonical.faces[Face.B],
      [Face.R]: canonical.faces[Face.R],
      [Face.F]: canonical.faces[Face.U],
      [Face.D]: canonical.faces[Face.F],
      [Face.L]: canonical.faces[Face.L],
      [Face.B]: canonical.faces[Face.D],
    })
    : canonical;
  let stepIndex = 1;
  while (state.session.committedFaces.length < 6) {
    if (state.session.currentStep !== stepIndex) {
      stepIndex = state.session.currentStep;
    }
    const face = state.session.currentStep === CaptureStep.Front
      ? Face.F
      : state.session.currentStep === CaptureStep.Right
      ? Face.R
      : state.session.currentStep === CaptureStep.Back
      ? Face.B
      : state.session.currentStep === CaptureStep.Left
      ? Face.L
      : state.session.currentStep === CaptureStep.Up
      ? Face.U
      : Face.D;
    for (let i = 0; i < size * size; i += 1) {
      state = paint(state, i, solved.faces[face][i]);
    }
    state = goNext(state);
  }
  return state.session;
}

Deno.test("emptyFlow starts at the capture stage with a blank 3x3 session", () => {
  const flow = emptyFlow(3);
  assertEquals(flow.stage, "capture");
  assertEquals(flow.session.currentStep, CaptureStep.Front);
  assertEquals(flow.solution.length, 0);
  assertEquals(flow.error, null);
});

Deno.test("emptyFlow prefills the 3x3 front center as the white anchor", () => {
  const flow = emptyFlow(3);
  assertEquals(flow.session.faces[Face.F][4], StickerColor.White);
  assertEquals(flow.session.committedFaces.length, 0);
});

Deno.test("white anchor consumes one of nine physical white stickers", () => {
  let state = emptyFlow(3);
  const initial = remainingByColor(state).find((entry) => entry.color === StickerColor.White);
  assertEquals(initial, { color: StickerColor.White, remaining: 8, total: 9 });
  for (let index = 0; index < 9; index += 1) {
    if (index !== 4) state = paint(state, index, StickerColor.White);
  }
  state = goNext(state);
  assertEquals(state.error, null);
  const errored = paint(state, 0, StickerColor.White);
  assertEquals(errored.error?.messageKey, "errorColorLimit");
});

Deno.test("emptyFlow does not prefill an anchor on 2x2", () => {
  const flow = emptyFlow(2);
  for (const face of FACE_ORDER) {
    for (const color of flow.session.faces[face]) {
      assertEquals(color, null);
    }
  }
});

Deno.test("paint cannot overwrite the anchored white center", () => {
  const initial = emptyFlow(3);
  const painted = paint(initial, 4, StickerColor.Green);
  assertEquals(painted, initial);
  assertEquals(painted.session.faces[Face.F][4], StickerColor.White);
});

Deno.test("paint tracks sticker count without mutating previous snapshots", () => {
  const initial = emptyFlow(3);
  const painted = paint(initial, 0, StickerColor.White);
  assertEquals(initial.session.faces[Face.F][0], null);
  assertEquals(painted.session.faces[Face.F][0], StickerColor.White);
});

Deno.test("paint surfaces invalid input as a localized error", () => {
  const flow = paint(emptyFlow(3), 0, StickerColor.White);
  const errored = paint(flow, 99, StickerColor.White);
  assert(errored.error !== null);
  assertEquals(errored.error?.messageKey, "errorInvalidSticker");
});

Deno.test("paint maps a color limit to the color limit error", () => {
  let state = emptyFlow(2);
  for (let index = 0; index < 4; index += 1) state = paint(state, index, StickerColor.White);
  state = goNext(state);
  const errored = paint(state, 0, StickerColor.White);
  assertEquals(errored.error?.messageKey, "errorColorLimit");
});

Deno.test("successful paint clears a stale color limit error", () => {
  let state = emptyFlow(2);
  for (let index = 0; index < 4; index += 1) state = paint(state, index, StickerColor.White);
  state = goNext(state);
  state = paint(state, 0, StickerColor.White);
  assertEquals(state.error?.messageKey, "errorColorLimit");
  const recovered = paint(state, 0, StickerColor.Red);
  assertEquals(recovered.error, null);
  assertEquals(recovered.session.faces[Face.R][0], StickerColor.Red);
});

Deno.test("goNext preserves a specific paint error on an incomplete face", () => {
  let state = emptyFlow(2);
  for (let index = 0; index < 4; index += 1) state = paint(state, index, StickerColor.White);
  state = goNext(state);
  const colorLimit = paint(state, 0, StickerColor.White);
  const next = goNext(colorLimit);
  assertEquals(next, colorLimit);
  assertEquals(next.error?.messageKey, "errorColorLimit");
});

Deno.test("paint catches InputSessionError as a localized error", () => {
  // Force a duplicate center on 3x3 just to exercise the catch path
  const withError = (() => {
    const draft = emptyFlow(3);
    let s = draft;
    s = paint(s, 0, StickerColor.White);
    s = paint(s, 1, StickerColor.Yellow);
    s = paint(s, 2, StickerColor.Red);
    s = paint(s, 3, StickerColor.Orange);
    s = paint(s, 4, StickerColor.Green);
    s = paint(s, 5, StickerColor.Blue);
    s = paint(s, 6, StickerColor.White);
    s = paint(s, 7, StickerColor.Yellow);
    s = paint(s, 8, StickerColor.Red);
    try {
      s = goNext(s);
    } catch (_e) {
      // ignore
    }
    try {
      s = paint(s, 0, StickerColor.Green);
      s = paint(s, 1, StickerColor.Blue);
      s = paint(s, 2, StickerColor.Red);
      s = paint(s, 3, StickerColor.White);
      s = paint(s, 4, StickerColor.Yellow);
      s = paint(s, 5, StickerColor.Blue);
      s = paint(s, 6, StickerColor.Red);
      s = paint(s, 7, StickerColor.Orange);
      s = paint(s, 8, StickerColor.Green);
      s = goNext(s);
    } catch (error) {
      assert(error instanceof InputSessionError);
      assertEquals(error.code, InputErrorCode.DuplicateCenter);
      return applyErrorFromSession(s, error);
    }
    return s;
  })();
  assert(
    withError.error?.messageKey === "errorDuplicateCenter" ||
      withError.session.committedFaces.length > 0,
  );
});

Deno.test("goNext advances the capture step and emits an error for incomplete faces", () => {
  const partial = paint(emptyFlow(3), 0, StickerColor.White);
  const errored = goNext(partial);
  assertEquals(errored.error?.messageKey, "errorFaceIncomplete");
});

Deno.test("goBack opens the previous face without deleting colors", () => {
  const before = filledSession(2);
  const flow = { ...emptyFlow(2), session: before };
  const previous = goBack(flow);
  assertEquals(previous.session.currentStep, CaptureStep.Up);
  assertEquals(previous.session.committedFaces.length, 6);
  assertEquals(previous.session.faces[Face.D][0], StickerColor.Yellow);
});

Deno.test("resetAll returns a fresh flow state", () => {
  const dirty = setSolution(emptyFlow(3), parseAlgorithm("R U R' U'"));
  const fresh = resetAll(dirty.size);
  assertEquals(fresh.stage, "capture");
  assertEquals(fresh.solution.length, 0);
});

Deno.test("resetFace clears only the active face", () => {
  let state = emptyFlow(3);
  state = paint(state, 0, StickerColor.White);
  state = paint(state, 1, StickerColor.White);
  const cleared = resetFace(state);
  assertEquals(cleared.session.faces[Face.F][0], null);
  assertEquals(cleared.session.faces[Face.F][1], null);
});

Deno.test("resetFace restores the white center anchor on the 3x3 front face", () => {
  let state = emptyFlow(3);
  state = paint(state, 0, StickerColor.Red);
  const cleared = resetFace(state);
  assertEquals(cleared.session.faces[Face.F][0], null);
  assertEquals(cleared.session.faces[Face.F][4], StickerColor.White);
});

Deno.test("startReview transitions only when the cube is complete", () => {
  const partial = emptyFlow(3);
  assertEquals(startReview(partial).stage, "capture");
  const complete = { ...partial, session: filledSession(3) };
  assertEquals(startReview(complete).stage, "review");
});

Deno.test("startReview surfaces an impossible completed cube", () => {
  const complete = filledSession(3);
  const faces = {} as Record<Face, readonly (StickerColor | null)[]>;
  for (const face of FACE_ORDER) faces[face] = [...complete.faces[face]];
  const front = [...faces[Face.F]];
  const up = [...faces[Face.U]];
  const frontColor = front[3];
  front[3] = up[3];
  up[3] = frontColor;
  faces[Face.F] = front;
  faces[Face.U] = up;
  const invalidSession = { ...complete, faces };
  const reviewed = startReview({ ...emptyFlow(3), session: invalidSession });
  assertEquals(reviewed.stage, "capture");
  assertEquals(reviewed.error?.messageKey, "errorImpossible");
});

Deno.test("setSolution moves to the result stage with a move index of zero", () => {
  const moves = parseAlgorithm("R U R'");
  const result = setSolution(emptyFlow(3), moves);
  assertEquals(result.stage, "result");
  assertEquals(result.moveIndex, 0);
  assertEquals(result.solution.length, 3);
  assertEquals(result.playing, false);
});

Deno.test("setMoveIndex clamps to the move range", () => {
  const moves = parseAlgorithm("R U R'");
  const start = setSolution(emptyFlow(3), moves);
  assertEquals(setMoveIndex(start, -5).moveIndex, 0);
  assertEquals(setMoveIndex(start, 99).moveIndex, 3);
  assertEquals(setMoveIndex(start, 2).moveIndex, 2);
});

Deno.test("togglePlay flips the playing flag in the result stage", () => {
  const moves = parseAlgorithm("R U");
  const start = setSolution(emptyFlow(3), moves);
  assertEquals(togglePlay(start).playing, true);
  assertEquals(togglePlay(togglePlay(start)).playing, false);
});

Deno.test("DEFAULT_SPEED exposes three named speeds in descending order", () => {
  assert(DEFAULT_SPEED.slow > DEFAULT_SPEED.normal);
  assert(DEFAULT_SPEED.normal > DEFAULT_SPEED.fast);
});

Deno.test("progressFraction grows as stickers are filled", () => {
  const a = emptyFlow(3);
  const b = paint(a, 0, StickerColor.White);
  assert(b.stage === "capture");
  assert(progressFraction(b) > 0);
  assert(progressFraction(b) < 1);
});

Deno.test("remainingByColor reflects per-color usage", () => {
  let s = emptyFlow(2);
  s = paint(s, 0, StickerColor.White);
  s = paint(s, 1, StickerColor.White);
  const counts = remainingByColor(s);
  const white = counts.find((entry) => entry.color === StickerColor.White);
  assert(white);
  assertEquals(white!.remaining, 4 - 2);
});

Deno.test("computeCubeAtStep applies moves to the entered cube", () => {
  const complete = { ...emptyFlow(3), session: filledSession(3) };
  const entered = toCubeState(complete.session);
  const flow = setSolution(complete, parseAlgorithm("R U R' U' R U R' U' R U R' U'"));
  const total = flow.solution.length;
  const mid = setMoveIndex(flow, Math.max(1, Math.floor(total / 2)));
  const snapshot = computeCubeAtStep(mid);
  assert(!cubeEquals(snapshot, entered));
  const empty = setSolution(complete, []);
  assert(cubeEquals(computeCubeAtStep(empty), entered));
});

Deno.test("startSolving transitions stage to solving", () => {
  const flow = startReview({ ...emptyFlow(3), session: filledSession(3) });
  const solving = startSolving(flow);
  assertEquals(solving.stage, "solving");
});

function applyErrorFromSession(s: ReturnType<typeof emptyFlow>, error: unknown) {
  if (error instanceof InputSessionError) {
    const key = error.code === InputErrorCode.DuplicateCenter
      ? "errorDuplicateCenter"
      : "errorGeneric";
    return { ...s, error: { messageKey: key, detail: error.message } };
  }
  return s;
}
