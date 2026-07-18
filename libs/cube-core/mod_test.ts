import {
  applyMoves,
  cloneCube,
  countColors,
  createSolvedCube,
  cubeEquals,
  type CubeSize,
  deserializeCube,
  Face,
  FACE_ORDER,
  formatAlgorithm,
  invertMove,
  invertMoves,
  parseAlgorithm,
  parseMove,
  serializeCube,
  STICKER_COLORS,
  StickerColor,
} from "./mod.ts";

const assert = {
  ok(value: unknown, message = "Assertion failed"): void {
    if (!value) throw new Error(message);
  },
  equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  },
  notEqual(actual: unknown, expected: unknown): void {
    if (actual === expected) throw new Error("Values must not be equal");
  },
  deepEqual(actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error("Values are not deeply equal");
    }
  },
  throws(action: () => unknown, expected?: { new (message?: string): Error }): void {
    try {
      action();
    } catch (error) {
      if (expected && !(error instanceof expected)) throw error;
      return;
    }
    throw new Error("Expected action to throw");
  },
};

const sizes: readonly CubeSize[] = [2, 3];

Deno.test("solved cubes have exact color counts", () => {
  for (const size of sizes) {
    const state = createSolvedCube(size);
    const counts = countColors(state);
    for (const color of STICKER_COLORS) assert.equal(counts[color], size * size);
  }
});

Deno.test("four quarter turns are identity for every face and size", () => {
  for (const size of sizes) {
    for (const face of FACE_ORDER) {
      const solved = createSolvedCube(size);
      const turned = applyMoves(solved, Array(4).fill({ face, amount: 1 }));
      assert.ok(cubeEquals(turned, solved), `${size}x${size} ${Face[face]}`);
    }
  }
});

Deno.test("every move followed by its inverse is identity", () => {
  for (const size of sizes) {
    for (const face of FACE_ORDER) {
      for (const amount of [1, -1, 2] as const) {
        const solved = createSolvedCube(size);
        const move = { face, amount } as const;
        const restored = applyMoves(solved, [move, invertMove(move)]);
        assert.ok(cubeEquals(restored, solved), `${size}x${size} ${Face[face]} ${amount}`);
      }
    }
  }
});

Deno.test("two double turns are identity", () => {
  for (const size of sizes) {
    for (const face of FACE_ORDER) {
      const solved = createSolvedCube(size);
      const restored = applyMoves(solved, [{ face, amount: 2 }, { face, amount: 2 }]);
      assert.ok(cubeEquals(restored, solved));
    }
  }
});

Deno.test("an algorithm followed by its inverse is identity", () => {
  const algorithm = parseAlgorithm("R U R' U' F2 L D B' R2");
  for (const size of sizes) {
    const solved = createSolvedCube(size);
    const scrambled = applyMoves(solved, algorithm);
    assert.ok(!cubeEquals(scrambled, solved));
    assert.ok(cubeEquals(applyMoves(scrambled, invertMoves(algorithm)), solved));
  }
});

Deno.test("move parser and formatter round-trip", () => {
  const algorithm = parseAlgorithm("U R2 F' D L B2");
  assert.equal(formatAlgorithm(algorithm), "U R2 F' D L B2");
  assert.deepEqual(parseMove("R'"), { face: Face.R, amount: -1 });
  assert.throws(() => parseMove("X"), TypeError);
});

Deno.test("serialization is strict and round-trips", () => {
  for (const size of sizes) {
    const state = applyMoves(createSolvedCube(size), parseAlgorithm("R U2 F'"));
    const restored = deserializeCube(serializeCube(state));
    assert.ok(cubeEquals(restored, state));
    assert.notEqual(restored, state);
    assert.notEqual(cloneCube(state), state);
  }
});

Deno.test("invalid snapshots are rejected", () => {
  assert.throws(() => deserializeCube("not json"), TypeError);
  assert.throws(() => deserializeCube('{"version":1,"size":4,"facelets":[]}'), TypeError);
  assert.throws(
    () => deserializeCube('{"version":1,"size":2,"facelets":[],"extra":true}'),
    TypeError,
  );

  const payload = JSON.parse(serializeCube(createSolvedCube(2)));
  payload.facelets[0][0] = StickerColor.Red;
  assert.throws(() => deserializeCube(JSON.stringify(payload)), TypeError);
});

Deno.test("domain snapshots are deeply immutable", () => {
  const state = createSolvedCube(3);
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.faces));
  for (const face of FACE_ORDER) assert.ok(Object.isFrozen(state.faces[face]));
});

Deno.test("turns preserve all sticker counts", () => {
  for (const size of sizes) {
    const moved = applyMoves(createSolvedCube(size), parseAlgorithm("R U F2 L' D B R2"));
    const counts = countColors(moved);
    for (const color of STICKER_COLORS) assert.equal(counts[color], size * size);
  }
});
