import { emptyFlow, goNext, paint, setMoveIndex } from "@cuberub/cube-application";
import {
  applyMove,
  applyMoves,
  createSolvedCube,
  type CubeSize,
  CubeState,
  deserializeCube,
  Face,
  formatAlgorithm,
  type Move,
  parseAlgorithm,
  StickerColor,
} from "@cuberub/cube-core";
import { getAllCaptureGuides, paintSticker, startInputSession } from "@cuberub/cube-input";
import { isVisuallySolved, solveCube } from "@cuberub/cube-solver";
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import {
  clearStoredSession,
  MAX_SERVER_SOLUTION_MOVES,
  parseServerSolutionResponse,
  persistSession,
  readStoredSession,
  requestServerSolution,
  runSolver,
  ServerCubeStateError,
  ServerSolutionError,
  type SolverFetch,
  SolverTimeoutError,
  withTimeout,
} from "./SolvePage.tsx";
import type { StorageAdapter } from "@cuberub/cube-storage";

class MapStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();

  read(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.values.set(key, value);
  }

  remove(key: string): void {
    this.values.delete(key);
  }
}

function completeSession(size: CubeSize) {
  const solved = createSolvedCube(size);
  let state = emptyFlow(size);
  for (const guide of getAllCaptureGuides()) {
    for (let index = 0; index < size * size; index += 1) {
      state = paint(state, index, solved.faces[guide.face][index]);
    }
    state = goNext(state);
  }
  return state.session;
}

Deno.test("completed input sessions persist and explicit reset clears them", () => {
  const storage = new MapStorage();
  const key = "solve";
  const session = completeSession(2);
  persistSession(session, key, storage);
  assertEquals(readStoredSession(key, 2, storage), session);
  clearStoredSession(key, storage);
  assertEquals(readStoredSession(key, 2, storage), null);
});

Deno.test("restoring a legacy session preserves its non-white front center", () => {
  const storage = new MapStorage();
  const key = "legacy-solve";
  const session = paintSticker(startInputSession(3), 4, StickerColor.Green);
  persistSession(session, key, storage);
  const restored = readStoredSession(key, 3, storage);
  assertEquals(restored?.faces[Face.F][4], StickerColor.Green);
});

Deno.test("withTimeout rejects on deadline and handles a late provider rejection", async () => {
  const provider = new Promise<never>((_resolve, reject) => {
    globalThis.setTimeout(() => reject(new Error("late provider failure")), 20);
  });
  await assertRejects(
    () => withTimeout(provider, 1),
    SolverTimeoutError,
  );
  await new Promise((resolve) => globalThis.setTimeout(resolve, 30));
  assert(true);
});

Deno.test("server solution parsing accepts only canonical bounded notation", async () => {
  const solution = await parseServerSolutionResponse(
    new Response(JSON.stringify({ notation: "R U2 F'" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  assertEquals(solution.notation, "R U2 F'");
  assertEquals(solution.moveCount, 3);
  assertEquals(formatAlgorithm(solution.moves), solution.notation);

  const invalidPayloads = [
    { notation: "R  U" },
    { notation: "X" },
    { notation: "R", extra: true },
    { notation: Array(MAX_SERVER_SOLUTION_MOVES + 1).fill("R").join(" ") },
  ];
  for (const payload of invalidPayloads) {
    await assertRejects(
      () => parseServerSolutionResponse(new Response(JSON.stringify(payload), { status: 200 })),
      ServerSolutionError,
    );
  }
});

Deno.test("server solution parsing distinguishes an impossible cube", async () => {
  await assertRejects(
    () =>
      parseServerSolutionResponse(
        new Response(JSON.stringify({ error: "invalid_cube" }), { status: 422 }),
      ),
    ServerCubeStateError,
  );
});

Deno.test("server solution request is same-origin, serialized, and aborts on timeout", async () => {
  const cube = createSolvedCube(2);
  let requestedUrl = "";
  let requestedBody = "";
  const successFetch: SolverFetch = (input, init) => {
    requestedUrl = String(input);
    requestedBody = String(init?.body ?? "");
    assertEquals(init?.method, "POST");
    assertEquals(init?.credentials, "same-origin");
    assert(init?.signal instanceof AbortSignal);
    return Promise.resolve(new Response(JSON.stringify({ notation: "" }), { status: 200 }));
  };
  const solution = await requestServerSolution(cube, successFetch, 50);
  assertEquals(requestedUrl, "/api/solve");
  assertEquals(deserializeCube(requestedBody), cube);
  assertEquals(solution.moveCount, 0);

  const timeoutSignals: AbortSignal[] = [];
  const hangingFetch: SolverFetch = (_input, init) => {
    if (init?.signal) timeoutSignals.push(init.signal);
    return new Promise<Response>(() => {});
  };
  await assertRejects(
    () => requestServerSolution(cube, hangingFetch, 1),
    SolverTimeoutError,
  );
  assertEquals(timeoutSignals[0]?.aborted, true);
});

Deno.test("runSolver uses the direct bounded solver without browser globals", async () => {
  const state = { ...emptyFlow(2), session: completeSession(2) };
  const outcome = await runSolver(state, 1_000);
  assertEquals(outcome.stage, "result");
  assertEquals(outcome.errorKey, null);
  assertEquals(outcome.solution?.moveCount, 0);
});

Deno.test("result panel restores the orientation helper paragraph and shows the walkthrough note", async () => {
  const source = await Deno.readTextFile(new URL("./SolvePage.tsx", import.meta.url));
  assert(
    source.includes("result__orientation-note"),
    "orientation helper class must be restored in the result panel",
  );
  assert(
    source.includes("messages.resultOrientationNote"),
    "result panel must wire the orientation helper to the resultOrientationNote i18n key",
  );
  const noteIdx = source.indexOf('class="result__orientation-note"');
  assert(noteIdx !== -1, "result panel must render the orientation helper paragraph");
  assert(
    source.indexOf("messages.resultOrientationNote", noteIdx) !== -1,
    "orientation helper paragraph must be wired to the resultOrientationNote i18n key in place",
  );
  assert(
    source.includes('class="result__walkthrough-note"'),
    "walkthrough note must still use the result__walkthrough-note class",
  );
  assert(
    source.includes("messages.resultWalkthroughNote"),
    "walkthrough note must still be wired to the resultWalkthroughNote i18n key",
  );
});

Deno.test("result panel wires the minimal 3D trainer with TwistyCube and essential controls", async () => {
  const source = await Deno.readTextFile(new URL("./SolvePage.tsx", import.meta.url));
  const requiredKeys = [
    "resultStepBack",
    "resultStepForward",
    "resultPause",
    "resultPlay",
    "resultReplay",
    "resultRestart",
    "resultCopy",
    "resultCopied",
    "resultNotationLabel",
    "resultOrientationNote",
    "result3dHint",
  ];
  for (const key of requiredKeys) {
    assert(source.includes(key), `result panel must reference the ${key} i18n key`);
  }
  assert(
    source.includes("<TwistyCube"),
    "result panel must render the TwistyCube component",
  );
  assert(
    !source.includes("<MoveCard"),
    "result panel must not import or render the removed MoveCard component",
  );
  assert(
    source.includes("onPrev") && source.includes("onNext"),
    "result panel must wire step-by-step prev/next callbacks",
  );
  assert(
    source.includes("onTogglePlay"),
    "result panel must wire a play/pause toggle callback",
  );
  assert(
    source.includes("onJump"),
    "result panel must wire a scrubber jump callback",
  );
  assert(
    source.includes("onCopyNotation") && source.includes("onRestart"),
    "result panel must wire copy and restart callbacks",
  );
});

Deno.test("trainer step controls keep every required control reachable and 44px+", async () => {
  const css = await Deno.readTextFile(new URL("../assets/styles.css", import.meta.url));
  assert(
    /\.trainer-controls__btn[\s\S]{0,200}min-height:\s*48px/.test(css),
    "trainer controls must have a 48px min-height touch target",
  );
  assert(
    /\.result__replay[\s\S]{0,200}min-height:\s*48px/.test(css),
    "result replay/restart buttons must have a 48px min-height touch target",
  );
  assert(
    /\.result__orientation-note[\s\S]{0,300}var\(--mint\)/.test(css),
    "orientation helper must use the mint accent color",
  );
});

Deno.test("result panel toggle button exposes the current play/pause state and label", async () => {
  const pageSource = await Deno.readTextFile(new URL("./SolvePage.tsx", import.meta.url));
  assert(
    pageSource.includes("aria-pressed") && pageSource.includes("isPlaying"),
    "result panel must expose the playing flag via aria-pressed",
  );
  assert(
    pageSource.includes("messages.resultPause") && pageSource.includes("messages.resultPlay"),
    "result panel must surface both pause and play labels from i18n",
  );
});

Deno.test(
  "deterministic walk-through: 3x3 white-front scramble applies move[0..n) one at a time and is solved at step n",
  async () => {
    const scramble = "R U F2 L' D B'";
    const size: CubeSize = 3;
    const solved = createSolvedCube(size);
    const scrambled = applyMoves(solved, parseAlgorithm(scramble));
    const solution = await solveCube(scrambled);
    assert(solution.moves.length > 0, "solver must produce at least one move");

    let stepState: CubeState = scrambled;
    const flow = setMoveIndex(emptyFlow(size), 0);
    assertEquals(flow.solution.length, 0);
    assertEquals(flow.moveIndex, 0);

    const moves: readonly Move[] = solution.moves;
    for (let k = 0; k < moves.length; k += 1) {
      const move = moves[k];
      const before = stepState;
      const after = applyMove(before, move);
      stepState = after;
      assert(
        after !== before,
        `step ${k + 1}: applying move ${formatAlgorithm([move])} must change the cube state`,
      );
      const isLast = k === moves.length - 1;
      assertEquals(
        isVisuallySolved(stepState),
        isLast,
        `step ${k + 1}: cube should be solved only at the final step`,
      );
    }

    assert(
      isVisuallySolved(stepState),
      "after applying the full solution the cube must be visually solved",
    );
  },
);

Deno.test("deterministic walk-through: pre-applied moves[0..k) are visually solved only at k=n", async () => {
  const size: CubeSize = 3;
  const scrambles = ["R U R' U'", "F R U R' U' F'", "L B D' R2 F2"];
  for (const scramble of scrambles) {
    const solved = createSolvedCube(size);
    const scrambled = applyMoves(solved, parseAlgorithm(scramble));
    const solution = await solveCube(scrambled);
    assert(solution.moves.length > 0, `${scramble} produced an empty solution`);

    const moves = solution.moves;
    let running = scrambled;
    for (let k = 0; k < moves.length; k += 1) {
      running = applyMove(running, moves[k]);
      const expectedSolved = k === moves.length - 1;
      assertEquals(
        isVisuallySolved(running),
        expectedSolved,
        `${scramble}: step ${k + 1}/${moves.length} visibility mismatch`,
      );
    }
    assert(isVisuallySolved(running), `${scramble}: cube not solved after walk-through`);
  }
});
