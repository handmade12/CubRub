import { useComputed, useSignal } from "@preact/signals";
import {
  computeCubeAtStep,
  emptyFlow,
  type FlowState,
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
} from "@cuberub/cube-application";
import {
  type CaptureGuide,
  CaptureStep,
  countDraftColors,
  deserializeInputSession,
  FRONT_CENTER_STICKER_INDEX,
  getAllCaptureGuides,
  getCurrentDraft,
  goToCaptureStep,
  InputErrorCode,
  type InputSession,
  InputSessionError,
  isInputComplete,
  lockFrontCenter,
  serializeInputSession,
  toCubeState,
  WholeCubeTurn,
} from "@cuberub/cube-input";
import {
  type CubeSize,
  type CubeState,
  Face,
  formatAlgorithm,
  invertMoves,
  type Move,
  parseAlgorithm,
  serializeCube,
  STICKER_COLORS,
  StickerColor,
} from "@cuberub/cube-core";
import type { CubeSolution } from "@cuberub/cube-solver";
import { getMessages, type Locale, type MessageKey } from "@cuberub/cube-i18n";
import {
  createKeyedStore,
  type KeyedStore,
  localStorageAdapter,
  type StorageAdapter,
} from "@cuberub/cube-storage";
import { colorClassFor, renderCubeSvg } from "@cuberub/cube-render";
import { useEffect, useRef } from "preact/hooks";

interface SolvePageProps {
  readonly locale: Locale;
  readonly size: CubeSize;
  readonly storageKey: string;
  readonly query: Readonly<Record<string, string>>;
  readonly onHome: () => void;
  readonly onLanguageSwitch: () => void;
}

interface SolverOutcome {
  readonly stage: FlowState["stage"];
  readonly errorKey: MessageKey | null;
  readonly solution: CubeSolution | null;
}

export const SOLVER_TIMEOUT_MS = 8_000;
export const SOLVER_API_TIMEOUT_MS = 6_000;
export const MAX_SERVER_SOLUTION_MOVES = 200;
const MAX_SERVER_RESPONSE_BYTES = 8 * 1024;

export class SolverTimeoutError extends Error {
  constructor() {
    super("Solver timed out");
    this.name = "SolverTimeoutError";
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      settled = true;
      reject(new SolverTimeoutError());
    }, Math.max(0, timeoutMs));
    void Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type SolverFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ServerCubeStateError extends Error {
  constructor() {
    super("Server rejected cube state");
    this.name = "ServerCubeStateError";
  }
}

export class ServerSolutionError extends Error {
  constructor() {
    super("Server solution response is invalid");
    this.name = "ServerSolutionError";
  }
}

function withAbortTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      reject(new SolverTimeoutError());
    }, Math.max(0, timeoutMs));
    void Promise.resolve().then(() => operation(controller.signal)).then(
      (value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

async function readServerResponse(response: Response): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_SERVER_RESPONSE_BYTES) {
    throw new ServerSolutionError();
  }
  if (response.body === null) throw new ServerSolutionError();

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SERVER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ServerSolutionError();
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof ServerSolutionError) throw error;
    throw new ServerSolutionError();
  } finally {
    reader.releaseLock();
  }
}

export async function parseServerSolutionResponse(response: Response): Promise<CubeSolution> {
  const text = await readServerResponse(response);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ServerSolutionError();
  }

  if (
    response.status === 422 && isExactRecord(payload, ["error"]) &&
    payload.error === "invalid_cube"
  ) {
    throw new ServerCubeStateError();
  }
  if (!response.ok || !isExactRecord(payload, ["notation"])) {
    throw new ServerSolutionError();
  }
  if (typeof payload.notation !== "string") throw new ServerSolutionError();

  let moves: readonly Move[];
  try {
    moves = parseAlgorithm(payload.notation);
  } catch {
    throw new ServerSolutionError();
  }
  if (
    moves.length > MAX_SERVER_SOLUTION_MOVES ||
    formatAlgorithm(moves) !== payload.notation
  ) {
    throw new ServerSolutionError();
  }
  return Object.freeze({
    moves: Object.freeze([...moves]),
    notation: payload.notation,
    moveCount: moves.length,
    provider: "cubing@0.63.3",
  });
}

export function requestServerSolution(
  cube: CubeState,
  fetcher: SolverFetch = globalThis.fetch,
  timeoutMs = SOLVER_API_TIMEOUT_MS,
): Promise<CubeSolution> {
  return withAbortTimeout(async (signal) => {
    const response = await fetcher("/api/solve", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: serializeCube(cube),
      credentials: "same-origin",
      signal,
    });
    return parseServerSolutionResponse(response);
  }, timeoutMs);
}

function hasBrowserSolverApi(): boolean {
  return typeof window !== "undefined" && typeof location !== "undefined";
}

const TURN_INSTRUCTION_KEY: Readonly<Record<WholeCubeTurn, MessageKey>> = {
  [WholeCubeTurn.BringRightFaceForward]: "turnBringRight",
  [WholeCubeTurn.RestoreFrontFace]: "turnRestoreFront",
  [WholeCubeTurn.BringTopFaceForward]: "turnBringTop",
  [WholeCubeTurn.BringBottomFaceForward]: "turnBringBottom",
};

const FACE_TITLE_KEY: Readonly<Record<Face, MessageKey>> = {
  [Face.U]: "faceUp",
  [Face.R]: "faceRight",
  [Face.F]: "faceFront",
  [Face.D]: "faceDown",
  [Face.L]: "faceLeft",
  [Face.B]: "faceBack",
};

const COLOR_TITLE_KEY: Readonly<Record<StickerColor, MessageKey>> = {
  [StickerColor.White]: "colorWhite",
  [StickerColor.Yellow]: "colorYellow",
  [StickerColor.Red]: "colorRed",
  [StickerColor.Orange]: "colorOrange",
  [StickerColor.Blue]: "colorBlue",
  [StickerColor.Green]: "colorGreen",
};

type ActiveTool = StickerColor | "erase" | null;

export function SolvePage(props: SolvePageProps) {
  const messages = getMessages(props.locale);
  const initialSession = readStoredSession(props.storageKey, props.size);
  const restoredNotice = useSignal(initialSession !== null);
  const initial = useSignal<FlowState>(
    initialSession ? { ...emptyFlow(props.size), session: initialSession } : emptyFlow(props.size),
  );
  const activeColor = useSignal<ActiveTool>(null);
  const solverError = useSignal<string | null>(null);
  const showResetConfirm = useSignal(false);
  const copyState = useSignal<"idle" | "copied">("idle");
  const solveRequest = useRef(0);

  useEffect(() => {
    if (initial.value.stage !== "capture") return;
    persistSession(initial.value.session, props.storageKey);
  }, [initial.value.session, props.storageKey]);

  const state = useComputed(() => initial.value);
  const remaining = useComputed(() => remainingByColor(initial.value));
  const progress = useComputed(() => progressFraction(initial.value));

  const onPickColor = (color: ActiveTool) => {
    activeColor.value = color;
  };

  const onPickSticker = (stickerIndex: number) => {
    if (activeColor.value === null) return;
    initial.value = paint(
      initial.value,
      stickerIndex,
      activeColor.value === "erase" ? null : activeColor.value,
    );
  };

  const onResetFace = () => {
    initial.value = resetFace(initial.value);
  };

  const onGoNext = () => {
    initial.value = goNext(initial.value);
  };

  const onGoBack = () => {
    initial.value = goBack(initial.value);
  };

  const onJumpStep = (step: CaptureStep) => {
    try {
      const session = goToCaptureStep(initial.value.session, step);
      initial.value = { ...initial.value, session };
    } catch {
      // ignore locked steps
    }
  };

  const onSolve = async () => {
    const review = initial.value.stage === "review" ? initial.value : startReview(initial.value);
    if (review.stage !== "review") {
      initial.value = review;
      return;
    }
    const solving = startSolving(review);
    const requestId = solveRequest.current + 1;
    solveRequest.current = requestId;
    initial.value = solving;
    solverError.value = null;
    const outcome = await runSolver(solving);
    if (requestId !== solveRequest.current) return;
    if (outcome.errorKey) {
      solverError.value = errorKeyToText(outcome.errorKey, messages);
      initial.value = {
        ...solving,
        stage: "capture",
        error: { messageKey: outcome.errorKey },
      };
      return;
    }
    if (outcome.solution) {
      initial.value = setSolution(solving, outcome.solution.moves);
      persistSolution(props.storageKey, outcome.solution);
    }
  };

  const onResetAll = () => {
    solveRequest.current += 1;
    initial.value = resetAll(props.size);
    solverError.value = null;
    activeColor.value = null;
    clearStoredSession(props.storageKey);
  };

  const onRestart = () => {
    onResetAll();
  };

  const onMoveBack = () => {
    initial.value = setMoveIndex(initial.value, initial.value.moveIndex - 1);
  };

  const onMoveForward = () => {
    initial.value = setMoveIndex(initial.value, initial.value.moveIndex + 1);
  };

  const onReplay = () => {
    const rewinded = setMoveIndex(initial.value, 0);
    initial.value = togglePlay(rewinded, true);
  };

  const onTogglePlay = () => {
    initial.value = togglePlay(initial.value);
  };

  const onCopyNotation = async () => {
    const text = formatAlgorithm(initial.value.solution);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      copyState.value = "copied";
      globalThis.setTimeout(() => {
        copyState.value = "idle";
      }, 1600);
    } catch {
      // clipboard not available; ignore
    }
  };

  useEffect(() => {
    if (!initial.value.playing) return;
    if (initial.value.moveIndex >= initial.value.solution.length) {
      initial.value = togglePlay(initial.value, false);
      return;
    }
    const speed = initial.value.speed;
    const timer = globalThis.setTimeout(() => {
      initial.value = setMoveIndex(initial.value, initial.value.moveIndex + 1);
    }, speed);
    return () => globalThis.clearTimeout(timer);
  }, [initial.value.playing, initial.value.moveIndex, initial.value.speed]);

  const session = state.value.session;
  const currentGuide = getAllCaptureGuides()[session.currentStep - 1];
  const draft = getCurrentDraft(session);
  const completedFaces = session.committedFaces.length;
  const allFilled = isInputComplete(session);
  const errorMessage = solverError.value ??
    errorKeyToText(initial.value.error?.messageKey, messages);

  return (
    <section class="solve">
      <header class="solve__header">
        <div>
          <p class="eyebrow">{messages.solveTitle}</p>
          <h1 class="solve__title">
            {messages.brand} {props.size}×{props.size}
          </h1>
          <p class="solve__lead">{messages.solveSubtitle}</p>
        </div>
        <button
          type="button"
          class="button button--secondary solve__restart"
          onClick={() => (showResetConfirm.value = true)}
        >
          {messages.resetAll}
        </button>
      </header>

      {restoredNotice.value && (
        <div class="banner banner--info" role="status">
          <span>{messages.autosaveRestored}</span>
          <button
            type="button"
            class="banner__dismiss"
            aria-label={messages.dismissed}
            onClick={() => (restoredNotice.value = false)}
          >
            ×
          </button>
        </div>
      )}

      {errorMessage && (
        <div class="banner banner--error" role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            class="banner__dismiss"
            aria-label={messages.dismissed}
            onClick={() => {
              solverError.value = null;
              if (initial.value.error) {
                initial.value = { ...initial.value, error: null };
              }
            }}
          >
            ×
          </button>
        </div>
      )}

      {initial.value.stage === "capture" && (
        <CaptureStage
          messages={messages}
          state={initial.value}
          draft={draft}
          guide={currentGuide}
          remaining={remaining.value}
          progress={progress.value}
          completedFaces={completedFaces}
          allFilled={allFilled}
          activeColor={activeColor.value}
          onPickColor={onPickColor}
          onPickSticker={onPickSticker}
          onResetFace={onResetFace}
          onGoBack={onGoBack}
          onGoNext={onGoNext}
          onJumpStep={onJumpStep}
          onSolve={() => {
            void onSolve();
          }}
        />
      )}

      {initial.value.stage === "review" && (
        <ReviewStage
          messages={messages}
          state={initial.value}
          onSolve={onSolve}
          onBack={() => (initial.value = { ...initial.value, stage: "capture" })}
        />
      )}

      {initial.value.stage === "solving" && <SolvingStage messages={messages} />}

      {initial.value.stage === "result" && (
        <ResultStage
          messages={messages}
          state={initial.value}
          copyState={copyState.value}
          onPrev={onMoveBack}
          onNext={onMoveForward}
          onReplay={onReplay}
          onTogglePlay={onTogglePlay}
          onJump={(index) => (initial.value = setMoveIndex(initial.value, index))}
          onCopyNotation={onCopyNotation}
          onRestart={onRestart}
        />
      )}

      {showResetConfirm.value && (
        <ConfirmDialog
          messages={messages}
          title={messages.resetConfirmTitle}
          body={messages.resetConfirmBody}
          confirmLabel={messages.resetConfirmYes}
          cancelLabel={messages.resetConfirmNo}
          onConfirm={() => {
            showResetConfirm.value = false;
            onResetAll();
          }}
          onCancel={() => (showResetConfirm.value = false)}
        />
      )}
    </section>
  );
}

interface CaptureStageProps {
  readonly messages: ReturnType<typeof getMessages>;
  readonly state: FlowState;
  readonly draft: readonly (StickerColor | null)[];
  readonly guide: CaptureGuide;
  readonly remaining: readonly { color: StickerColor; remaining: number; total: number }[];
  readonly progress: number;
  readonly completedFaces: number;
  readonly allFilled: boolean;
  readonly activeColor: ActiveTool;
  readonly onPickColor: (color: ActiveTool) => void;
  readonly onPickSticker: (stickerIndex: number) => void;
  readonly onResetFace: () => void;
  readonly onGoBack: () => void;
  readonly onGoNext: () => void;
  readonly onJumpStep: (step: CaptureStep) => void;
  readonly onSolve: () => void;
}

function CaptureStage(props: CaptureStageProps) {
  const guides = getAllCaptureGuides();
  const showAnchorHint = props.state.size === 3 &&
    props.state.session.currentStep === CaptureStep.Front &&
    props.draft[FRONT_CENTER_STICKER_INDEX] === StickerColor.White;
  const showTwoByTwoHint = props.state.size === 2 &&
    props.state.session.currentStep === CaptureStep.Front &&
    props.state.session.committedFaces.length === 0;
  return (
    <div class="capture">
      <div class="capture__progress" role="group" aria-label={props.messages.progressAria}>
        {guides.map((guide, index) => {
          const completed = index < props.completedFaces;
          const current = index === props.state.session.currentStep - 1;
          return (
            <button
              type="button"
              key={guide.step}
              class={`capture__step${completed ? " capture__step--done" : ""}${
                current ? " capture__step--current" : ""
              }`}
              aria-current={current ? "step" : undefined}
              onClick={() => props.onJumpStep(guide.step)}
              disabled={index > props.completedFaces}
            >
              <span class="capture__step-index">{index + 1}</span>
              <span class="capture__step-label">
                {props.messages[FACE_TITLE_KEY[guide.face]]} {index + 1}
              </span>
            </button>
          );
        })}
      </div>

      <div class="capture__panel">
        <div class="capture__face">
          <header class="capture__face-header">
            <h2>
              {props.messages.stepLabel} {props.state.session.currentStep} {props.messages.stepOf}
              {" "}
              {guides.length}
            </h2>
            <p>
              {props.messages[FACE_TITLE_KEY[props.guide.face]]} — {Face[props.guide.face]}
            </p>
          </header>

          {showAnchorHint && (
            <aside class="capture__anchor" role="note" aria-label={props.messages.anchorTitle}>
              <strong>{props.messages.anchorTitle}.</strong>{" "}
              <span>{props.messages.anchorHint}</span>
            </aside>
          )}

          {showTwoByTwoHint && (
            <aside
              class="capture__anchor"
              role="note"
              aria-label={props.messages.twoByTwoAnchorTitle}
            >
              <strong>{props.messages.twoByTwoAnchorTitle}.</strong>{" "}
              <span>{props.messages.twoByTwoAnchorHint}</span>
            </aside>
          )}

          <div class="capture__workspace">
            <div class="capture__grid-wrap">
              <FaceGrid
                size={props.state.size}
                stickers={props.draft}
                activeColor={props.activeColor}
                ariaLabel={props.messages.stepLabel}
                messages={props.messages}
                lockedIndices={lockedIndicesFor(
                  props.state.size,
                  props.state.session.currentStep,
                  props.draft,
                )}
                onPickSticker={props.onPickSticker}
              />
              <FaceGridLegend
                size={props.state.size}
                currentStep={props.state.session.currentStep}
                anchored={showAnchorHint}
                messages={props.messages}
              />
            </div>

            <div class="capture__palette-col" aria-label={props.messages.paletteTitle}>
              <div class="capture__palette-head">
                <h3>{props.messages.paletteTitle}</h3>
                <span class="capture__palette-count">
                  {props.completedFaces} / {guides.length} {props.messages.ofFaces}
                </span>
              </div>
              <ul class="palette">
                {props.remaining.map((entry) => (
                  <li key={entry.color} class="palette__item">
                    <button
                      type="button"
                      class={`palette__swatch palette__swatch--${colorClassFor(entry.color)}${
                        props.activeColor === entry.color ? " palette__swatch--active" : ""
                      }`}
                      aria-label={`${props.messages.selectColor} ${
                        props.messages[COLOR_TITLE_KEY[entry.color]]
                      }`}
                      aria-pressed={props.activeColor === entry.color}
                      disabled={entry.remaining === 0}
                      onClick={() => props.onPickColor(entry.color)}
                    >
                      <span class="palette__name">
                        {props.messages[COLOR_TITLE_KEY[entry.color]]}
                      </span>
                    </button>
                    <span class="palette__count">
                      <strong>{entry.remaining}</strong>
                      <small>{props.messages.paletteRemaining}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <div class="capture__palette-tools">
                <button
                  type="button"
                  class={`palette__eraser${
                    props.activeColor === "erase" ? " palette__eraser--active" : ""
                  }`}
                  aria-pressed={props.activeColor === "erase"}
                  onClick={() => props.onPickColor("erase")}
                >
                  {props.messages.clearSticker}
                </button>
                <progress
                  class="capture__bar"
                  max={1}
                  value={props.progress}
                  aria-label={props.messages.progressAria}
                />
              </div>
              {props.allFilled && (
                <button
                  type="button"
                  class="button button--primary capture__review"
                  onClick={props.onSolve}
                >
                  {props.messages.solveAction}
                </button>
              )}
            </div>
          </div>

          <RotationHint
            face={props.guide.face}
            turns={props.guide.turnsAfter}
            messages={props.messages}
          />

          <div class="capture__actions">
            <button
              type="button"
              class="button button--secondary"
              onClick={props.onGoBack}
              disabled={props.state.session.currentStep === CaptureStep.Front}
            >
              ← {props.messages.back}
            </button>
            <button
              type="button"
              class="button button--ghost"
              onClick={props.onResetFace}
            >
              {props.messages.resetFace}
            </button>
            <button
              type="button"
              class="button button--primary"
              onClick={props.onGoNext}
            >
              {props.messages.next} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function lockedIndicesFor(
  size: CubeSize,
  currentStep: number,
  stickers: readonly (StickerColor | null)[],
): readonly number[] {
  if (size !== 3) return [];
  if (currentStep !== CaptureStep.Front) return [];
  if (stickers[FRONT_CENTER_STICKER_INDEX] !== StickerColor.White) return [];
  return [FRONT_CENTER_STICKER_INDEX];
}

function FaceGrid({
  size,
  stickers,
  activeColor,
  ariaLabel,
  messages,
  lockedIndices,
  onPickSticker,
}: {
  readonly size: CubeSize;
  readonly stickers: readonly (StickerColor | null)[];
  readonly activeColor: ActiveTool;
  readonly ariaLabel: string;
  readonly messages: ReturnType<typeof getMessages>;
  readonly lockedIndices: readonly number[];
  readonly onPickSticker: (index: number) => void;
}) {
  const locked = new Set<number>(lockedIndices);
  const buttons = stickers.map((color, index) => {
    const klass = colorClassFor(color);
    const colorLabel = color === null ? "—" : messages[COLOR_TITLE_KEY[color]];
    const label = `${ariaLabel} ${index + 1}: ${colorLabel}`;
    const isLocked = locked.has(index);
    const lockedDescribed = isLocked ? ` ${messages.anchorLockedLabel}` : "";
    return (
      <button
        type="button"
        key={`${index}-${color ?? "x"}`}
        class={`face-sticker face-sticker--${klass}${
          activeColor !== null && !isLocked ? " face-sticker--armed" : ""
        }${isLocked ? " face-sticker--locked" : ""}`}
        aria-label={label + lockedDescribed}
        aria-disabled={isLocked ? "true" : undefined}
        title={isLocked ? messages.anchorLockedLabel : undefined}
        onClick={() => {
          if (isLocked) return;
          onPickSticker(index);
        }}
        disabled={activeColor === null || isLocked}
      >
        <span class="face-sticker__label">{colorLabel}</span>
        {isLocked && (
          <span class="face-sticker__badge" aria-hidden="true">
            {messages.anchorTitle.charAt(0)}
          </span>
        )}
      </button>
    );
  });
  const cols = size === 2 ? 2 : 3;
  return (
    <div
      class={`face-grid face-grid--${size}`}
      style={`--face-cols:${cols};`}
      role="grid"
    >
      {buttons}
    </div>
  );
}

function FaceGridLegend({
  size,
  currentStep,
  anchored,
  messages,
}: {
  readonly size: CubeSize;
  readonly currentStep: number;
  readonly anchored: boolean;
  readonly messages: ReturnType<typeof getMessages>;
}) {
  if (!anchored || size !== 3 || currentStep !== CaptureStep.Front) return null;
  return (
    <p class="face-grid__legend" aria-hidden="true">
      <span class="face-grid__legend-dot" /> {messages.anchorLockedLabel}
    </p>
  );
}

function RotationHint({
  face,
  turns,
  messages,
}: {
  readonly face: Face;
  readonly turns: readonly WholeCubeTurn[];
  readonly messages: ReturnType<typeof getMessages>;
}) {
  if (turns.length === 0) return null;
  const label = turns
    .map((turn) => messages[TURN_INSTRUCTION_KEY[turn]])
    .join(" · ");
  const stepClass = `mini-cube--step-${Face[face]}`;
  const stageKey = `mini-cube-${Face[face]}`;
  return (
    <div class="rotation-hint" aria-live="polite">
      <div
        class="mini-cube-stage"
        aria-label={messages.rotationVisualLabel}
        role="img"
      >
        <div class="mini-cube__camera" aria-hidden="true">
          <div class={`mini-cube ${stepClass}`} key={stageKey}>
            <div class="mini-cube__face mini-cube__face--F" />
            <div class="mini-cube__face mini-cube__face--B" />
            <div class="mini-cube__face mini-cube__face--R" />
            <div class="mini-cube__face mini-cube__face--L" />
            <div class="mini-cube__face mini-cube__face--U" />
            <div class="mini-cube__face mini-cube__face--D" />
          </div>
        </div>
      </div>
      <div class="rotation-hint__text">
        <span aria-hidden="true">↻</span>
        <span>
          {messages.turnAfter}: <strong>{label}</strong>
        </span>
        <small class="rotation-hint__repeat">{messages.rotationHint}</small>
      </div>
    </div>
  );
}

interface ReviewStageProps {
  readonly messages: ReturnType<typeof getMessages>;
  readonly state: FlowState;
  readonly onSolve: () => void;
  readonly onBack: () => void;
}

function ReviewStage({ messages, state, onSolve, onBack }: ReviewStageProps) {
  let previewState;
  try {
    previewState = toCubeState(state.session);
  } catch {
    return (
      <div class="review">
        <h2>{messages.reviewTitle}</h2>
        <p>{messages.errorCubeIncomplete}</p>
        <div class="review__actions">
          <button type="button" class="button button--secondary" onClick={onBack}>
            ← {messages.back}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div class="review">
      <h2>{messages.reviewTitle}</h2>
      <p>{messages.reviewLead}</p>
      <div
        class="review__preview"
        // deno-lint-ignore react-no-danger
        dangerouslySetInnerHTML={{
          __html: renderCubeSvg({ size: state.size, state: previewState }),
        }}
      />
      <div class="review__actions">
        <button type="button" class="button button--secondary" onClick={onBack}>
          ← {messages.back}
        </button>
        <button type="button" class="button button--primary" onClick={onSolve}>
          {messages.solveAction}
        </button>
      </div>
    </div>
  );
}

function SolvingStage({ messages }: { readonly messages: ReturnType<typeof getMessages> }) {
  return (
    <div class="solving" role="status" aria-live="polite">
      <div class="solving__spinner" aria-hidden="true" />
      <p>{messages.solving}</p>
    </div>
  );
}

interface ResultStageProps {
  readonly messages: ReturnType<typeof getMessages>;
  readonly state: FlowState;
  readonly copyState: "idle" | "copied";
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onReplay: () => void;
  readonly onTogglePlay: () => void;
  readonly onJump: (index: number) => void;
  readonly onCopyNotation: () => void;
  readonly onRestart: () => void;
}

function ResultStage(props: ResultStageProps) {
  const { messages, state } = props;
  const hasMoves = state.solution.length > 0;
  const totalSteps = state.solution.length;
  const currentStep = Math.min(state.moveIndex, totalSteps);
  const isPlaying = state.playing;
  const cubeState = computeCubeAtStep(state);
  const notationText = hasMoves ? formatAlgorithm(state.solution) : messages.resultNotationEmpty;

  return (
    <div class="result">
      <header class="result__header">
        <h2>{messages.resultTitle}</h2>
        <p class="result__subline">
          <strong>{totalSteps}</strong> {messages.resultMoves}
        </p>
      </header>

      <p class="result__orientation-note" role="status" aria-live="polite">
        {messages.resultOrientationNote}
      </p>

      <p class="result__walkthrough-note" role="status" aria-live="polite">
        {messages.resultWalkthroughNote}
      </p>

      <div class="result__layout">
        <div class="result__diagram" aria-label={messages.resultVisualLabel}>
          <TwistyCube
            size={state.size}
            solution={state.solution}
            moveIndex={state.moveIndex}
            fallbackState={cubeState}
            ariaLabel={messages.resultVisualLabel}
          />
          <p class="result__diagram-hint">{messages.result3dHint}</p>
        </div>

        <div class="result__panel">
          <div class="trainer-controls" role="group" aria-label={messages.resultStepOf}>
            <button
              type="button"
              class="button button--secondary trainer-controls__btn trainer-controls__btn--nudge"
              onClick={props.onPrev}
              disabled={!hasMoves || state.moveIndex === 0}
              aria-label={messages.resultStepBack}
            >
              ← {messages.resultStepBack}
            </button>
            <button
              type="button"
              class="button button--primary trainer-controls__btn trainer-controls__btn--nudge trainer-controls__btn--primary"
              onClick={props.onTogglePlay}
              disabled={!hasMoves}
              aria-label={isPlaying ? messages.resultPause : messages.resultPlay}
              aria-pressed={isPlaying}
            >
              {isPlaying ? `⏸ ${messages.resultPause}` : `▶ ${messages.resultPlay}`}
            </button>
            <button
              type="button"
              class="button button--secondary trainer-controls__btn trainer-controls__btn--nudge"
              onClick={props.onNext}
              disabled={!hasMoves || state.moveIndex >= totalSteps}
              aria-label={messages.resultStepForward}
            >
              {messages.resultStepForward} →
            </button>
          </div>

          {hasMoves && (
            <input
              type="range"
              class="result__scrubber"
              min={0}
              max={totalSteps}
              value={state.moveIndex}
              onInput={(event) =>
                props.onJump(Number((event.currentTarget as HTMLInputElement).value))}
              aria-label={messages.resultStepOf}
            />
          )}

          <p class="result__step">
            {messages.resultStepOf} {currentStep} / {totalSteps}
          </p>

          <p class="result__notation-label">{messages.resultNotationLabel}</p>
          <p class="result__notation" aria-live="polite">{notationText}</p>

          <div class="result__panel-actions">
            <button
              type="button"
              class="button button--secondary result__replay"
              onClick={props.onReplay}
              disabled={!hasMoves}
            >
              ↻ {messages.resultReplay}
            </button>
            <button
              type="button"
              class="button button--ghost result__copy"
              onClick={props.onCopyNotation}
              aria-live="polite"
            >
              {props.copyState === "copied" ? messages.resultCopied : messages.resultCopy}
            </button>
            <button
              type="button"
              class="button button--danger result__restart"
              onClick={props.onRestart}
            >
              {messages.resultRestart}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TwistyPlayerElement extends HTMLElement {
  alg: string;
  experimentalSetupAlg: string;
  timestamp: "start" | "end";
  disconnect?: () => void;
}

function TwistyCube({
  size,
  solution,
  moveIndex,
  fallbackState,
  ariaLabel,
}: {
  readonly size: CubeSize;
  readonly solution: readonly Move[];
  readonly moveIndex: number;
  readonly fallbackState: ReturnType<typeof computeCubeAtStep>;
  readonly ariaLabel: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<TwistyPlayerElement | null>(null);
  const ready = useSignal(false);
  const setupAlgorithm = formatAlgorithm(invertMoves(solution));
  const visibleAlgorithm = formatAlgorithm(solution.slice(0, moveIndex));

  useEffect(() => {
    let active = true;
    let player: TwistyPlayerElement | null = null;
    void import("cubing/twisty")
      .then(({ TwistyPlayer }) => {
        if (!active || !hostRef.current) return;
        player = new TwistyPlayer({
          puzzle: size === 2 ? "2x2x2" : "3x3x3",
          alg: visibleAlgorithm,
          experimentalSetupAlg: setupAlgorithm,
          experimentalSetupAnchor: "start",
          visualization: "3D",
          background: "none",
          controlPanel: "none",
          hintFacelets: "floating",
          experimentalDragInput: "auto",
          cameraLatitude: 24,
          cameraLongitude: 32,
        }) as TwistyPlayerElement;
        player.timestamp = "end";
        player.style.width = "100%";
        player.style.height = "100%";
        hostRef.current.replaceChildren(player);
        playerRef.current = player;
        ready.value = true;
      })
      .catch(() => {
        ready.value = false;
      });

    return () => {
      active = false;
      player?.disconnect?.();
      player?.remove();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [size, setupAlgorithm]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.experimentalSetupAlg = setupAlgorithm;
    player.alg = visibleAlgorithm;
    player.timestamp = "end";
  }, [setupAlgorithm, visibleAlgorithm]);

  return (
    <div class="twisty-cube" aria-label={ariaLabel}>
      <div ref={hostRef} class="twisty-cube__host" />
      {!ready.value && (
        <div
          class="twisty-cube__fallback"
          // deno-lint-ignore react-no-danger
          dangerouslySetInnerHTML={{
            __html: renderCubeSvg({ size, state: fallbackState, ariaLabel }),
          }}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  messages,
}: {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly messages: ReturnType<typeof getMessages>;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);
  return (
    <div class="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        class="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <p>{body}</p>
        <div class="dialog__actions">
          <button type="button" class="button button--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" class="button button--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
        <span class="visually-hidden">{messages.dismissed}</span>
      </div>
    </div>
  );
}

function errorKeyToText(
  key: string | undefined,
  messages: ReturnType<typeof getMessages>,
): string | null {
  if (!key) return null;
  const fallback = messages.errorGeneric;
  const message = (messages as Record<string, string>)[key];
  return typeof message === "string" ? message : fallback;
}

export function createInputSessionStore(
  storage: StorageAdapter,
  key: string,
): KeyedStore<InputSession> {
  return createKeyedStore(
    storage,
    key,
    (raw) => deserializeInputSession(raw),
    serializeInputSession,
  );
}

export function persistSession(
  session: InputSession,
  key: string,
  storage: StorageAdapter = localStorageAdapter,
): void {
  const counts = countDraftColors(session);
  const totalUsed = STICKER_COLORS.reduce((sum, color) => sum + counts[color], 0);
  const store = createInputSessionStore(storage, key);
  if (totalUsed === 0) {
    store.clear();
    return;
  }
  store.save(session);
}

function persistSolution(key: string, solution: CubeSolution): void {
  try {
    localStorageAdapter.write(`${key}:result`, JSON.stringify(solution));
  } catch {
    return;
  }
}

export function readStoredSession(
  key: string,
  size: CubeSize,
  storage: StorageAdapter = localStorageAdapter,
): InputSession | null {
  const session = createInputSessionStore(storage, key).load();
  if (!session || session.size !== size) return null;
  return lockFrontCenter(session);
}

export function clearStoredSession(
  key: string,
  storage: StorageAdapter = localStorageAdapter,
): void {
  createInputSessionStore(storage, key).clear();
  try {
    storage.remove(`${key}:result`);
  } catch {
    return;
  }
}

export async function runSolver(
  state: FlowState,
  timeoutMs = SOLVER_TIMEOUT_MS,
): Promise<SolverOutcome> {
  let solverModule: typeof import("@cuberub/cube-solver") | undefined;
  try {
    const session = state.session;
    if (!isInputComplete(session)) {
      return { stage: "capture", errorKey: "errorCubeIncomplete", solution: null };
    }
    const cube = toCubeState(session);
    const deadline = Date.now() + Math.max(0, timeoutMs);

    if (hasBrowserSolverApi()) {
      try {
        const apiTimeout = Math.min(SOLVER_API_TIMEOUT_MS, Math.max(0, deadline - Date.now()));
        const solution = await requestServerSolution(cube, globalThis.fetch, apiTimeout);
        return { stage: "result", errorKey: null, solution };
      } catch (error) {
        if (error instanceof ServerCubeStateError) {
          return { stage: "capture", errorKey: "errorImpossible", solution: null };
        }
      }
    }

    let remaining = deadline - Date.now();
    if (remaining <= 0) throw new SolverTimeoutError();
    solverModule = await withTimeout(import("@cuberub/cube-solver"), remaining);
    const activeSolver = solverModule;
    remaining = deadline - Date.now();
    if (remaining <= 0) throw new SolverTimeoutError();
    const solution = await withTimeout(
      Promise.resolve().then(() => activeSolver.solveCube(cube)),
      remaining,
    );
    return { stage: "result", errorKey: null, solution };
  } catch (error) {
    if (error instanceof SolverTimeoutError) {
      return { stage: "capture", errorKey: "errorTimeout", solution: null };
    }
    if (error instanceof InputSessionError) {
      switch (error.code) {
        case InputErrorCode.InvalidPhysicalState:
          return { stage: "capture", errorKey: "errorImpossible", solution: null };
        case InputErrorCode.ColorLimitReached:
          return { stage: "capture", errorKey: "errorColorLimit", solution: null };
        case InputErrorCode.CubeIncomplete:
          return { stage: "capture", errorKey: "errorCubeIncomplete", solution: null };
        default:
          return { stage: "capture", errorKey: "errorSolver", solution: null };
      }
    }
    if (solverModule && error instanceof solverModule.CubeSolveError) {
      switch (error.code) {
        case solverModule.CubeSolveErrorCode.InvalidState:
          return { stage: "capture", errorKey: "errorImpossible", solution: null };
        case solverModule.CubeSolveErrorCode.ProviderFailure:
          return { stage: "capture", errorKey: "errorProvider", solution: null };
        case solverModule.CubeSolveErrorCode.VerificationFailed:
          return { stage: "capture", errorKey: "errorVerifier", solution: null };
        default:
          return { stage: "capture", errorKey: "errorSolver", solution: null };
      }
    }
    return { stage: "capture", errorKey: "errorSolver", solution: null };
  }
}
