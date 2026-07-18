import {
  createCubeState,
  type CubeSize,
  type CubeState,
  Face,
  FACE_ORDER,
  isCubeSize,
  isStickerColor,
  STICKER_COLORS,
  StickerColor,
} from "@cuberub/cube-core";
import { type CubiePattern, validateCube, type ValidationIssue } from "@cuberub/cube-validation";

export type DraftSticker = StickerColor | null;

export enum CaptureStep {
  Front = 1,
  Right = 2,
  Back = 3,
  Left = 4,
  Up = 5,
  Down = 6,
}

export enum WholeCubeTurn {
  BringRightFaceForward = 1,
  RestoreFrontFace = 2,
  BringTopFaceForward = 3,
  BringBottomFaceForward = 4,
}

export enum InputStatus {
  Capturing = 1,
  Complete = 2,
}

export enum InputErrorCode {
  InvalidSticker = 1,
  FaceIncomplete = 2,
  ColorLimitReached = 3,
  DuplicateCenter = 4,
  StepLocked = 5,
  CubeIncomplete = 6,
  InvalidSnapshot = 7,
  InvalidPhysicalState = 8,
}

export interface InputSessionErrorDetails {
  readonly issues?: readonly ValidationIssue[];
  readonly pattern?: CubiePattern;
  readonly [key: string]: unknown;
}

export class InputSessionError extends Error {
  constructor(
    readonly code: InputErrorCode,
    message: string,
    readonly details?: InputSessionErrorDetails,
  ) {
    super(message);
    this.name = "InputSessionError";
  }
}

export interface CaptureGuide {
  readonly step: CaptureStep;
  readonly face: Face;
  readonly titleKey: string;
  readonly turnsAfter: readonly WholeCubeTurn[];
}

export interface InputSession {
  readonly version: 1;
  readonly size: CubeSize;
  readonly currentStep: CaptureStep;
  readonly status: InputStatus;
  readonly committedFaces: readonly Face[];
  readonly faces: Readonly<Record<Face, readonly DraftSticker[]>>;
}

const GUIDES: readonly CaptureGuide[] = Object.freeze([
  Object.freeze({
    step: CaptureStep.Front,
    face: Face.F,
    titleKey: "input.face.front",
    turnsAfter: Object.freeze([WholeCubeTurn.BringRightFaceForward]),
  }),
  Object.freeze({
    step: CaptureStep.Right,
    face: Face.R,
    titleKey: "input.face.right",
    turnsAfter: Object.freeze([WholeCubeTurn.BringRightFaceForward]),
  }),
  Object.freeze({
    step: CaptureStep.Back,
    face: Face.B,
    titleKey: "input.face.back",
    turnsAfter: Object.freeze([WholeCubeTurn.BringRightFaceForward]),
  }),
  Object.freeze({
    step: CaptureStep.Left,
    face: Face.L,
    titleKey: "input.face.left",
    turnsAfter: Object.freeze([
      WholeCubeTurn.RestoreFrontFace,
      WholeCubeTurn.BringTopFaceForward,
    ]),
  }),
  Object.freeze({
    step: CaptureStep.Up,
    face: Face.U,
    titleKey: "input.face.up",
    turnsAfter: Object.freeze([WholeCubeTurn.BringBottomFaceForward]),
  }),
  Object.freeze({
    step: CaptureStep.Down,
    face: Face.D,
    titleKey: "input.face.down",
    turnsAfter: Object.freeze([]),
  }),
]);

const STEP_FACES = Object.freeze(GUIDES.map((guide) => guide.face));

function inputError(
  code: InputErrorCode,
  message: string,
  details?: InputSessionErrorDetails,
): never {
  throw new InputSessionError(code, message, details);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isCaptureStep(value: unknown): value is CaptureStep {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 &&
    value <= GUIDES.length;
}

function isInputStatus(value: unknown): value is InputStatus {
  return value === InputStatus.Capturing || value === InputStatus.Complete;
}

function freezeFaces(faces: Record<Face, DraftSticker[]>): InputSession["faces"] {
  for (const face of FACE_ORDER) Object.freeze(faces[face]);
  return Object.freeze(faces);
}

function copyFaces(source: InputSession["faces"]): Record<Face, DraftSticker[]> {
  const faces = {} as Record<Face, DraftSticker[]>;
  for (const face of FACE_ORDER) faces[face] = [...source[face]];
  return faces;
}

function freezeSession(
  session: Omit<InputSession, "version"> & { readonly version?: 1 },
): InputSession {
  return Object.freeze({
    version: 1,
    size: session.size,
    currentStep: session.currentStep,
    status: session.status,
    committedFaces: Object.freeze([...session.committedFaces]),
    faces: session.faces,
  });
}

export function getCaptureGuide(step: CaptureStep): CaptureGuide {
  if (!isCaptureStep(step)) inputError(InputErrorCode.StepLocked, "Unknown capture step");
  return GUIDES[step - 1];
}

export function getAllCaptureGuides(): readonly CaptureGuide[] {
  return GUIDES;
}

export function startInputSession(size: CubeSize): InputSession {
  if (!isCubeSize(size)) inputError(InputErrorCode.InvalidSnapshot, "Cube size must be 2 or 3");
  const faces = {} as Record<Face, DraftSticker[]>;
  for (const face of FACE_ORDER) faces[face] = Array<DraftSticker>(size * size).fill(null);
  return freezeSession({
    size,
    currentStep: CaptureStep.Front,
    status: InputStatus.Capturing,
    committedFaces: [],
    faces: freezeFaces(faces),
  });
}

export const FRONT_CENTER_STICKER_INDEX = 4;

export function frontCenterIndex(size: CubeSize): number {
  if (size !== 3) return -1;
  return FRONT_CENTER_STICKER_INDEX;
}

export function hasFrontAnchor(session: InputSession): boolean {
  return session.size === 3 &&
    session.faces[Face.F][FRONT_CENTER_STICKER_INDEX] === StickerColor.White;
}

export function lockFrontCenter(session: InputSession): InputSession {
  if (session.size !== 3) return session;
  const center = FRONT_CENTER_STICKER_INDEX;
  const current = session.faces[Face.F][center];
  if (current !== null) return session;
  const faces = copyFaces(session.faces);
  faces[Face.F][center] = StickerColor.White;
  return freezeSession({
    ...session,
    faces: freezeFaces(faces),
  });
}

export function getCurrentFace(session: InputSession): Face {
  return getCaptureGuide(session.currentStep).face;
}

export function getCurrentDraft(session: InputSession): readonly DraftSticker[] {
  return session.faces[getCurrentFace(session)];
}

export function countDraftColors(
  session: InputSession,
): Readonly<Record<StickerColor, number>> {
  const counts = {
    [StickerColor.White]: 0,
    [StickerColor.Yellow]: 0,
    [StickerColor.Red]: 0,
    [StickerColor.Orange]: 0,
    [StickerColor.Blue]: 0,
    [StickerColor.Green]: 0,
  };
  for (const face of FACE_ORDER) {
    for (const color of session.faces[face]) {
      if (color !== null) counts[color] += 1;
    }
  }
  return Object.freeze(counts);
}

export function paintSticker(
  session: InputSession,
  stickerIndex: number,
  color: DraftSticker,
): InputSession {
  const faceletCount = session.size * session.size;
  if (!Number.isInteger(stickerIndex) || stickerIndex < 0 || stickerIndex >= faceletCount) {
    inputError(InputErrorCode.InvalidSticker, "Sticker index is outside the current face");
  }
  if (color !== null && !isStickerColor(color)) {
    inputError(InputErrorCode.InvalidSticker, "Unknown sticker color");
  }

  const face = getCurrentFace(session);
  const previous = session.faces[face][stickerIndex];
  if (previous === color) return session;

  if (color !== null) {
    const counts = countDraftColors(session);
    if (counts[color] >= faceletCount) {
      inputError(InputErrorCode.ColorLimitReached, "All stickers of this color are already used");
    }
  }

  const faces = copyFaces(session.faces);
  faces[face][stickerIndex] = color;
  const stepIndex = session.currentStep - 1;
  const committedFaces = session.committedFaces.length > stepIndex
    ? session.committedFaces.slice(0, stepIndex)
    : session.committedFaces;

  return freezeSession({
    ...session,
    status: InputStatus.Capturing,
    committedFaces,
    faces: freezeFaces(faces),
  });
}

export function resetCurrentFace(session: InputSession): InputSession {
  const face = getCurrentFace(session);
  const faces = copyFaces(session.faces);
  faces[face].fill(null);
  const stepIndex = session.currentStep - 1;
  const cleared = freezeSession({
    ...session,
    status: InputStatus.Capturing,
    committedFaces: session.committedFaces.slice(
      0,
      Math.min(stepIndex, session.committedFaces.length),
    ),
    faces: freezeFaces(faces),
  });
  if (session.size === 3 && face === Face.F) {
    return lockFrontCenter(cleared);
  }
  return cleared;
}

function validateUniqueCenter(session: InputSession, face: Face): void {
  if (session.size !== 3) return;
  const center = session.faces[face][4];
  for (const committedFace of session.committedFaces) {
    if (committedFace !== face && session.faces[committedFace][4] === center) {
      inputError(InputErrorCode.DuplicateCenter, "This center color was already entered");
    }
  }
}

export function commitCurrentFace(session: InputSession): InputSession {
  const stepIndex = session.currentStep - 1;
  if (stepIndex > session.committedFaces.length) {
    inputError(InputErrorCode.StepLocked, "Complete the previous face first");
  }

  const face = getCurrentFace(session);
  if (session.faces[face].some((color) => color === null)) {
    inputError(InputErrorCode.FaceIncomplete, "Fill every sticker on this face");
  }
  validateUniqueCenter(session, face);

  const isAlreadyCommitted = session.committedFaces[stepIndex] === face;
  const committedFaces = isAlreadyCommitted
    ? session.committedFaces
    : [...session.committedFaces, face];
  const isComplete = committedFaces.length === GUIDES.length;

  if (isComplete) {
    const complete = freezeSession({
      ...session,
      status: InputStatus.Complete,
      committedFaces,
    });
    toCubeState(complete);
    return complete;
  }

  return freezeSession({
    ...session,
    currentStep: (session.currentStep + 1) as CaptureStep,
    status: InputStatus.Capturing,
    committedFaces,
  });
}

export function goToCaptureStep(session: InputSession, step: CaptureStep): InputSession {
  if (!isCaptureStep(step)) inputError(InputErrorCode.StepLocked, "Unknown capture step");
  const maxUnlocked = Math.min(GUIDES.length, session.committedFaces.length + 1);
  if (step > maxUnlocked) inputError(InputErrorCode.StepLocked, "Complete the previous face first");
  return freezeSession({ ...session, currentStep: step });
}

export function isInputComplete(session: InputSession): boolean {
  return session.status === InputStatus.Complete && session.committedFaces.length === GUIDES.length;
}

export function toCubeState(session: InputSession): CubeState {
  if (!isInputComplete(session)) {
    inputError(InputErrorCode.CubeIncomplete, "All six faces must be confirmed");
  }

  const faces = {} as Record<Face, StickerColor[]>;
  for (const face of FACE_ORDER) {
    const draft = session.faces[face];
    if (draft.some((color) => color === null)) {
      inputError(InputErrorCode.CubeIncomplete, "Cube contains empty stickers");
    }
    faces[face] = [...draft] as StickerColor[];
  }

  let cube: CubeState;
  try {
    cube = createCubeState(session.size, faces);
  } catch (error) {
    inputError(
      InputErrorCode.ColorLimitReached,
      error instanceof Error ? error.message : "Cube colors are invalid",
    );
  }

  const report = validateCube(cube);
  if (!report.valid) {
    inputError(
      InputErrorCode.InvalidPhysicalState,
      "Captured cube is not a valid physical state",
      {
        issues: report.issues,
        ...(report.pattern ? { pattern: report.pattern } : {}),
      },
    );
  }

  return cube;
}

export function serializeInputSession(session: InputSession): string {
  return JSON.stringify({
    version: session.version,
    size: session.size,
    currentStep: session.currentStep,
    status: session.status,
    committedFaces: session.committedFaces,
    faces: FACE_ORDER.map((face) => session.faces[face]),
  });
}

export function deserializeInputSession(serialized: string): InputSession {
  let payload: unknown;
  try {
    payload = JSON.parse(serialized);
  } catch {
    inputError(InputErrorCode.InvalidSnapshot, "Input snapshot is not valid JSON");
  }

  if (
    !isRecord(payload) ||
    !hasExactKeys(payload, [
      "version",
      "size",
      "currentStep",
      "status",
      "committedFaces",
      "faces",
    ]) ||
    payload.version !== 1 ||
    !isCubeSize(payload.size) ||
    !isCaptureStep(payload.currentStep) ||
    !isInputStatus(payload.status) ||
    !Array.isArray(payload.committedFaces) ||
    !Array.isArray(payload.faces)
  ) {
    inputError(InputErrorCode.InvalidSnapshot, "Input snapshot has an invalid shape");
  }

  const size = payload.size;
  const currentStep = payload.currentStep;
  const status = payload.status;
  const committedFaces = payload.committedFaces;
  const serializedFaces = payload.faces;
  const faceletCount = size * size;

  if (
    serializedFaces.length !== FACE_ORDER.length ||
    committedFaces.length > GUIDES.length ||
    committedFaces.some((face, index) => face !== STEP_FACES[index])
  ) {
    inputError(InputErrorCode.InvalidSnapshot, "Input snapshot has invalid face progress");
  }

  const faces = {} as Record<Face, DraftSticker[]>;
  FACE_ORDER.forEach((face, index) => {
    const draft = serializedFaces[index];
    if (
      !Array.isArray(draft) ||
      draft.length !== faceletCount ||
      draft.some((color) => color !== null && !isStickerColor(color))
    ) {
      inputError(InputErrorCode.InvalidSnapshot, "Input snapshot contains invalid stickers");
    }
    faces[face] = [...draft] as DraftSticker[];
  });

  const session = freezeSession({
    size,
    currentStep,
    status,
    committedFaces: committedFaces as Face[],
    faces: freezeFaces(faces),
  });
  const maxUnlocked = Math.min(GUIDES.length, committedFaces.length + 1);
  if (
    currentStep > maxUnlocked ||
    (status === InputStatus.Complete && committedFaces.length !== GUIDES.length)
  ) {
    inputError(InputErrorCode.InvalidSnapshot, "Input snapshot status is inconsistent");
  }

  const counts = countDraftColors(session);
  if (STICKER_COLORS.some((color) => counts[color] > faceletCount)) {
    inputError(
      InputErrorCode.InvalidSnapshot,
      "Input snapshot uses too many stickers of one color",
    );
  }
  for (const face of committedFaces as Face[]) validateUniqueCenter(session, face);
  if (status === InputStatus.Complete) toCubeState(session);
  return session;
}
