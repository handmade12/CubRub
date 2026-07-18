import {
  applyMoves,
  createSolvedCube,
  type CubeSize,
  type CubeState,
  type Move,
  STICKER_COLORS,
  StickerColor,
} from "@cuberub/cube-core";
import {
  commitCurrentFace,
  countDraftColors,
  type DraftSticker,
  frontCenterIndex,
  goToCaptureStep,
  hasFrontAnchor,
  InputErrorCode,
  type InputSession,
  InputSessionError,
  lockFrontCenter,
  paintSticker,
  resetCurrentFace,
  startInputSession,
  toCubeState,
} from "@cuberub/cube-input";

export type Stage = "capture" | "review" | "solving" | "result" | "error";

export interface ErrorState {
  readonly messageKey: string;
  readonly detail?: string;
}

export interface FlowState {
  readonly stage: Stage;
  readonly size: CubeSize;
  readonly session: InputSession;
  readonly solution: readonly Move[];
  readonly moveIndex: number;
  readonly playing: boolean;
  readonly speed: number;
  readonly error: ErrorState | null;
}

export const DEFAULT_SPEED = Object.freeze({ slow: 1100, normal: 600, fast: 250 } as const);

export function emptyFlow(size: CubeSize): FlowState {
  return Object.freeze({
    stage: "capture",
    size,
    session: lockFrontCenter(startInputSession(size)),
    solution: Object.freeze([]),
    moveIndex: 0,
    playing: false,
    speed: DEFAULT_SPEED.normal,
    error: null,
  });
}

export function paint(
  state: FlowState,
  stickerIndex: number,
  color: DraftSticker,
): FlowState {
  if (state.stage !== "capture") return state;
  if (
    isLockedCenterSticker(state.size, state.session.currentStep, stickerIndex) &&
    hasWhiteAnchor(state.size, state.session)
  ) {
    return state;
  }
  try {
    const session = paintSticker(state.session, stickerIndex, color);
    if (session === state.session && state.error === null) return state;
    return Object.freeze({ ...state, session, error: null });
  } catch (error) {
    return applyError(state, errorKeyFor(error, "errorInvalidSticker"), describeError(error));
  }
}

export function resetFace(state: FlowState): FlowState {
  if (state.stage !== "capture") return state;
  return Object.freeze({ ...state, session: resetCurrentFace(state.session) });
}

export function goNext(state: FlowState): FlowState {
  if (state.stage !== "capture") return state;
  try {
    const session = commitCurrentFace(state.session);
    return Object.freeze({ ...state, session, error: null });
  } catch (error) {
    const messageKey = errorKeyFor(error, "errorFaceIncomplete");
    if (
      messageKey === "errorFaceIncomplete" &&
      state.error !== null &&
      state.error.messageKey !== messageKey
    ) {
      return state;
    }
    return applyError(state, messageKey, describeError(error));
  }
}

export function goBack(state: FlowState): FlowState {
  if (state.stage !== "capture" || state.session.currentStep === 1) return state;
  try {
    const previousStep = (state.session.currentStep - 1) as InputSession["currentStep"];
    return Object.freeze({
      ...state,
      session: goToCaptureStep(state.session, previousStep),
      error: null,
    });
  } catch (error) {
    return applyError(state, errorKeyFor(error, "errorStepLocked"), describeError(error));
  }
}

export function startReview(state: FlowState): FlowState {
  try {
    toCubeState(state.session);
  } catch (error) {
    return applyError(state, errorKeyFor(error, "errorCubeIncomplete"), describeError(error));
  }
  return Object.freeze({ ...state, stage: "review", error: null });
}

export function startSolving(state: FlowState): FlowState {
  return Object.freeze({ ...state, stage: "solving", error: null });
}

export function setSolution(state: FlowState, moves: readonly Move[]): FlowState {
  return Object.freeze({
    ...state,
    stage: "result",
    solution: Object.freeze([...moves]),
    moveIndex: 0,
    playing: false,
  });
}

export function setError(state: FlowState, error: ErrorState): FlowState {
  return Object.freeze({ ...state, stage: "error", error });
}

export function clearError(state: FlowState): FlowState {
  return Object.freeze({
    ...state,
    error: null,
    stage: state.session.committedFaces.length === 6 ? "review" : "capture",
  });
}

export function resetAll(size: CubeSize): FlowState {
  return emptyFlow(size);
}

export function setMoveIndex(state: FlowState, index: number): FlowState {
  if (state.stage !== "result") return state;
  const clamped = Math.max(0, Math.min(index, state.solution.length));
  if (clamped === state.moveIndex) return state;
  return Object.freeze({ ...state, moveIndex: clamped });
}

export function togglePlay(state: FlowState, playing?: boolean): FlowState {
  if (state.stage !== "result") return state;
  const next = playing === undefined ? !state.playing : playing;
  return Object.freeze({ ...state, playing: next });
}

export function setSpeed(state: FlowState, speed: number): FlowState {
  if (speed <= 0) return state;
  return Object.freeze({ ...state, speed });
}

export function computeCubeAtStep(state: FlowState): CubeState {
  if (state.stage !== "result") return createSolvedCube(state.size);
  try {
    return applyMoves(toCubeState(state.session), state.solution.slice(0, state.moveIndex));
  } catch {
    return createSolvedCube(state.size);
  }
}

export interface RemainingCount {
  readonly color: StickerColor;
  readonly remaining: number;
  readonly total: number;
}

export function isLockedCenterSticker(
  size: CubeSize,
  currentStep: number,
  stickerIndex: number,
): boolean {
  if (size !== 3 || currentStep !== 1) return false;
  return stickerIndex === frontCenterIndex(size);
}

export function hasWhiteAnchor(size: CubeSize, session: InputSession): boolean {
  return size === 3 && hasFrontAnchor(session);
}

export function remainingByColor(state: FlowState): readonly RemainingCount[] {
  const faceletCount = state.size * state.size;
  const counts = countDraftColors(state.session);
  return STICKER_COLORS.map((color) => {
    const used = counts[color];
    return Object.freeze({
      color,
      remaining: faceletCount - used,
      total: faceletCount,
    });
  });
}

export function progressFraction(state: FlowState): number {
  const total = state.size * state.size * 6;
  const counts = countDraftColors(state.session);
  let filled = 0;
  for (const color of STICKER_COLORS) filled += counts[color];
  return Math.min(1, filled / total);
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorKeyFor(error: unknown, fallback: string): string {
  if (error instanceof InputSessionError) return mapInputError(error.code, fallback);
  return fallback;
}

function mapInputError(code: InputErrorCode, fallback: string): string {
  switch (code) {
    case InputErrorCode.InvalidSticker:
      return "errorInvalidSticker";
    case InputErrorCode.FaceIncomplete:
      return "errorFaceIncomplete";
    case InputErrorCode.ColorLimitReached:
      return "errorColorLimit";
    case InputErrorCode.DuplicateCenter:
      return "errorDuplicateCenter";
    case InputErrorCode.StepLocked:
      return "errorStepLocked";
    case InputErrorCode.CubeIncomplete:
      return "errorCubeIncomplete";
    case InputErrorCode.InvalidSnapshot:
      return "errorInvalidSnapshot";
    case InputErrorCode.InvalidPhysicalState:
      return "errorImpossible";
    default:
      return fallback;
  }
}

function applyError(state: FlowState, messageKey: string, detail?: string): FlowState {
  return Object.freeze({
    ...state,
    error: Object.freeze(detail ? { messageKey, detail } : { messageKey }),
  });
}
