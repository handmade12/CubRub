import { applyMoves, createSolvedCube, cubeEquals, invertMoves } from "@cuberub/cube-core";
import { validateCube } from "@cuberub/cube-validation";
import { assert, assertEquals } from "@cuberub/test-utils";
import { createPatternState, getPattern, getPatterns, PatternId } from "./mod.ts";

Deno.test("catalog contains patterns for both cube sizes", () => {
  assert(getPatterns(2).length >= 3);
  assert(getPatterns(3).length >= 3);
});

Deno.test("every pattern is reachable and not solved", () => {
  for (const entry of getPatterns()) {
    const state = createPatternState(entry);
    assert(validateCube(state).valid, entry.title.en);
    assert(!cubeEquals(state, createSolvedCube(entry.size)), entry.title.en);
  }
});

Deno.test("reversing a pattern restores the solved cube", () => {
  for (const entry of getPatterns()) {
    const patterned = createPatternState(entry);
    const restored = applyMoves(patterned, invertMoves(entry.moves));
    assert(cubeEquals(restored, createSolvedCube(entry.size)));
  }
});

Deno.test("pattern lookup is deterministic", () => {
  const checkerboard = getPattern(PatternId.Checkerboard3);
  assert(checkerboard);
  assertEquals(checkerboard.notation, "R2 L2 U2 D2 F2 B2");
});
