import {
  applyMoves,
  createCubeState,
  createSolvedCube,
  cubeEquals,
  type CubeSize,
  Face,
  FACE_ORDER,
  parseAlgorithm,
  StickerColor,
} from "@cuberub/cube-core";
import {
  CaptureStep,
  commitCurrentFace,
  countDraftColors,
  deserializeInputSession,
  FRONT_CENTER_STICKER_INDEX,
  frontCenterIndex,
  getAllCaptureGuides,
  getCurrentDraft,
  getCurrentFace,
  goToCaptureStep,
  hasFrontAnchor,
  InputErrorCode,
  InputSessionError,
  InputStatus,
  isInputComplete,
  lockFrontCenter,
  paintSticker,
  resetCurrentFace,
  serializeInputSession,
  startInputSession,
  toCubeState,
  WholeCubeTurn,
} from "./mod.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}

function throwsCode(action: () => unknown, code: InputErrorCode): void {
  try {
    action();
  } catch (error) {
    assert(error instanceof InputSessionError);
    equal(error.code, code);
    return;
  }
  throw new Error("Expected InputSessionError");
}

function fillCurrentFace(
  session: ReturnType<typeof startInputSession>,
  colors: readonly StickerColor[],
) {
  return colors.reduce((current, color, index) => paintSticker(current, index, color), session);
}

function completeSolvedInput(size: CubeSize) {
  const solved = createSolvedCube(size);
  let session = startInputSession(size);
  for (const guide of getAllCaptureGuides()) {
    equal(getCurrentFace(session), guide.face);
    session = fillCurrentFace(session, solved.faces[guide.face]);
    session = commitCurrentFace(session);
  }
  return session;
}

Deno.test("a session starts blank on the front face", () => {
  const session = startInputSession(3);
  equal(session.currentStep, CaptureStep.Front);
  equal(getCurrentFace(session), Face.F);
  equal(getCurrentDraft(session).length, 9);
  assert(getCurrentDraft(session).every((color) => color === null));
  assert(Object.isFrozen(session));
});

Deno.test("lockFrontCenter prefills the 3x3 front center with white and is a no-op on 2x2", () => {
  const fresh = startInputSession(3);
  const locked = lockFrontCenter(fresh);
  equal(locked.faces[Face.F][FRONT_CENTER_STICKER_INDEX], StickerColor.White);
  assert(hasFrontAnchor(locked));
  equal(frontCenterIndex(3), FRONT_CENTER_STICKER_INDEX);
  const twoLocked = lockFrontCenter(startInputSession(2));
  equal(twoLocked.faces[Face.F][0], null);
  equal(frontCenterIndex(2), -1);
  assert(!hasFrontAnchor(twoLocked));
});

Deno.test("lockFrontCenter preserves committed progress and replaces null center", () => {
  const fresh = startInputSession(3);
  const seeded = lockFrontCenter(fresh);
  const filled = Array.from(
    { length: 9 },
    (_v, i) => i === FRONT_CENTER_STICKER_INDEX ? StickerColor.White : StickerColor.Red,
  );
  const painted = filled.reduce(
    (current, color, index) => paintSticker(current, index, color),
    seeded,
  );
  const committed = commitCurrentFace(painted);
  const restored = lockFrontCenter(committed);
  equal(restored.committedFaces.length, committed.committedFaces.length);
  equal(restored.faces[Face.F][FRONT_CENTER_STICKER_INDEX], StickerColor.White);
  equal(restored.faces[Face.R][0], null);
});

Deno.test("lockFrontCenter is idempotent when the center is already white", () => {
  const session = lockFrontCenter(startInputSession(3));
  const again = lockFrontCenter(session);
  equal(again, session);
});

Deno.test("lockFrontCenter preserves a non-white center from a legacy session", () => {
  const legacy = paintSticker(
    startInputSession(3),
    FRONT_CENTER_STICKER_INDEX,
    StickerColor.Green,
  );
  const restored = lockFrontCenter(legacy);
  equal(restored, legacy);
  equal(restored.faces[Face.F][FRONT_CENTER_STICKER_INDEX], StickerColor.Green);
  assert(!hasFrontAnchor(restored));
});

Deno.test("painting updates usage without mutating previous snapshots", () => {
  const initial = startInputSession(2);
  const painted = paintSticker(initial, 0, StickerColor.White);
  equal(initial.faces[Face.F][0], null);
  equal(painted.faces[Face.F][0], StickerColor.White);
  equal(countDraftColors(painted)[StickerColor.White], 1);
});

Deno.test("a color cannot exceed its physical sticker count", () => {
  let session = startInputSession(2);
  session = fillCurrentFace(session, Array(4).fill(StickerColor.White));
  session = commitCurrentFace(session);
  throwsCode(
    () => paintSticker(session, 0, StickerColor.White),
    InputErrorCode.ColorLimitReached,
  );
});

Deno.test("incomplete and locked faces cannot be opened", () => {
  const session = startInputSession(3);
  throwsCode(() => commitCurrentFace(session), InputErrorCode.FaceIncomplete);
  throwsCode(() => goToCaptureStep(session, CaptureStep.Back), InputErrorCode.StepLocked);
});

Deno.test("capture order preserves physical orientation and exact turn sequences", () => {
  const guides = getAllCaptureGuides();
  const faces = guides.map((guide) => guide.face);
  equal(
    JSON.stringify(faces),
    JSON.stringify([Face.F, Face.R, Face.B, Face.L, Face.U, Face.D]),
  );

  const expectStep = [
    { step: CaptureStep.Front, face: Face.F, turnsAfter: [WholeCubeTurn.BringRightFaceForward] },
    { step: CaptureStep.Right, face: Face.R, turnsAfter: [WholeCubeTurn.BringRightFaceForward] },
    { step: CaptureStep.Back, face: Face.B, turnsAfter: [WholeCubeTurn.BringRightFaceForward] },
    {
      step: CaptureStep.Left,
      face: Face.L,
      turnsAfter: [
        WholeCubeTurn.RestoreFrontFace,
        WholeCubeTurn.BringTopFaceForward,
      ],
    },
    {
      step: CaptureStep.Up,
      face: Face.U,
      turnsAfter: [WholeCubeTurn.BringBottomFaceForward],
    },
    { step: CaptureStep.Down, face: Face.D, turnsAfter: [] },
  ] as const;

  for (let index = 0; index < expectStep.length; index += 1) {
    const expected = expectStep[index];
    const guide = guides[index];
    equal(guide.step, expected.step);
    equal(guide.face, expected.face);
    equal(
      JSON.stringify([...guide.turnsAfter]),
      JSON.stringify([...expected.turnsAfter]),
    );
  }
});

Deno.test("duplicate 3x3 centers are rejected", () => {
  let session = startInputSession(3);
  const first = [
    StickerColor.White,
    StickerColor.Yellow,
    StickerColor.Red,
    StickerColor.Orange,
    StickerColor.Green,
    StickerColor.Blue,
    StickerColor.White,
    StickerColor.Yellow,
    StickerColor.Red,
  ];
  session = fillCurrentFace(session, first);
  session = commitCurrentFace(session);

  const second = [
    StickerColor.Orange,
    StickerColor.Green,
    StickerColor.Blue,
    StickerColor.White,
    StickerColor.Green,
    StickerColor.Yellow,
    StickerColor.Red,
    StickerColor.Orange,
    StickerColor.Blue,
  ];
  session = fillCurrentFace(session, second);
  throwsCode(() => commitCurrentFace(session), InputErrorCode.DuplicateCenter);
});

Deno.test("a solved cube completes and converts to domain state", () => {
  for (const size of [2, 3] as const) {
    const session = completeSolvedInput(size);
    equal(session.status, InputStatus.Complete);
    assert(isInputComplete(session));
    assert(cubeEquals(toCubeState(session), createSolvedCube(size)));
  }
});

Deno.test("editing a committed face truncates confirmation progress", () => {
  let session = startInputSession(2);
  session = fillCurrentFace(session, Array(4).fill(StickerColor.Green));
  session = commitCurrentFace(session);
  session = goToCaptureStep(session, CaptureStep.Front);
  session = paintSticker(session, 0, StickerColor.Red);
  equal(session.committedFaces.length, 0);
  equal(session.status, InputStatus.Capturing);
});

Deno.test("reset clears only the current face and its confirmation", () => {
  let session = startInputSession(2);
  session = paintSticker(session, 0, StickerColor.Green);
  session = resetCurrentFace(session);
  assert(getCurrentDraft(session).every((color) => color === null));
});

Deno.test("resetCurrentFace restores the 3x3 white center anchor on the front face", () => {
  let session = lockFrontCenter(startInputSession(3));
  session = paintSticker(session, 0, StickerColor.Red);
  const cleared = resetCurrentFace(session);
  equal(cleared.faces[Face.F][0], null);
  equal(cleared.faces[Face.F][FRONT_CENTER_STICKER_INDEX], StickerColor.White);
});

Deno.test("autosave snapshot round-trips and rejects corruption", () => {
  let session = startInputSession(3);
  session = paintSticker(session, 0, StickerColor.Blue);
  const restored = deserializeInputSession(serializeInputSession(session));
  equal(serializeInputSession(restored), serializeInputSession(session));
  throwsCode(() => deserializeInputSession("bad"), InputErrorCode.InvalidSnapshot);
  throwsCode(
    () =>
      deserializeInputSession(
        '{"version":1,"size":3,"currentStep":6,"status":1,"committedFaces":[],"faces":[]}',
      ),
    InputErrorCode.InvalidSnapshot,
  );
});

Deno.test("all draft faces are immutable", () => {
  const session = startInputSession(2);
  assert(Object.isFrozen(session.faces));
  for (const face of FACE_ORDER) assert(Object.isFrozen(session.faces[face]));
});

Deno.test("completing a solved session commits to the result stage", () => {
  for (const size of [2, 3] as const) {
    const session = completeSolvedInput(size);
    assert(session.status === InputStatus.Complete);
    assert(isInputComplete(session));
  }
});

Deno.test("input completion rejects a physically impossible cube", () => {
  const solved = createSolvedCube(3);
  // Swap F[3] (UF edge F side) with U[3] (UL edge U side). Color counts
  // stay balanced, but the UF edge ends up with White on both stickers,
  // which is not a valid edge cubie.
  const front = [...solved.faces[Face.F]];
  front[3] = StickerColor.White;
  const up = [...solved.faces[Face.U]];
  up[3] = StickerColor.Green;
  let session = startInputSession(3);
  let caught: unknown = null;
  for (const guide of getAllCaptureGuides()) {
    const faceColors = guide.face === Face.F
      ? front
      : guide.face === Face.U
      ? up
      : solved.faces[guide.face];
    session = fillCurrentFace(session, faceColors);
    try {
      session = commitCurrentFace(session);
    } catch (error) {
      caught = error;
      break;
    }
  }
  assert(caught);
  assert(caught instanceof InputSessionError);
  equal(caught.code, InputErrorCode.InvalidPhysicalState);
  assert(caught.details);
  const issues = caught.details.issues as readonly { code: number }[] | undefined;
  assert(issues && issues.length > 0);
  for (const issue of issues) {
    assert(Number.isInteger(issue.code) && issue.code >= 1);
  }
});

Deno.test("a scrambled legal cube still completes successfully", () => {
  for (const size of [2, 3] as const) {
    const solved = createSolvedCube(size);
    const scrambled = applyMoves(solved, parseAlgorithm("R U R' U' F2"));
    let session = startInputSession(size);
    for (const guide of getAllCaptureGuides()) {
      session = fillCurrentFace(session, scrambled.faces[guide.face]);
      session = commitCurrentFace(session);
    }
    assert(isInputComplete(session));
    assert(cubeEquals(toCubeState(session), scrambled));
  }
});

Deno.test("a cube captured in an arbitrary orientation completes successfully", () => {
  for (const size of [2, 3] as const) {
    const count = size * size;
    const rotated = createCubeState(size, {
      [Face.U]: Array<StickerColor>(count).fill(StickerColor.White),
      [Face.R]: Array<StickerColor>(count).fill(StickerColor.Blue),
      [Face.F]: Array<StickerColor>(count).fill(StickerColor.Red),
      [Face.D]: Array<StickerColor>(count).fill(StickerColor.Yellow),
      [Face.L]: Array<StickerColor>(count).fill(StickerColor.Green),
      [Face.B]: Array<StickerColor>(count).fill(StickerColor.Orange),
    });
    let session = startInputSession(size);
    for (const guide of getAllCaptureGuides()) {
      session = fillCurrentFace(session, rotated.faces[guide.face]);
      session = commitCurrentFace(session);
    }
    assert(isInputComplete(session));
    const cube = toCubeState(session);
    assert(cube.size === size);
  }
});

Deno.test("snapshot serialization is byte-compatible across detail additions", () => {
  const session = startInputSession(2);
  const serialized = serializeInputSession(session);
  const restored = deserializeInputSession(serialized);
  equal(serializeInputSession(restored), serialized);
});

Deno.test("legacy 3x3 snapshots without a white center still deserialize into a valid blank frame", () => {
  const legacy = JSON.stringify({
    version: 1,
    size: 3,
    currentStep: 1,
    status: 1,
    committedFaces: [],
    faces: FACE_ORDER.map(() => Array<number | null>(9).fill(null)),
  });
  const restored = deserializeInputSession(legacy);
  equal(restored.faces[Face.F][FRONT_CENTER_STICKER_INDEX], null);
  assert(restored.version === 1);
});
