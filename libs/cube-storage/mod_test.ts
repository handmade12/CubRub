import {
  createKeyedStore,
  localStorageAdapter,
  memoryStorage,
  type StorageAdapter,
} from "./mod.ts";
import { assert, assertEquals } from "@cuberub/test-utils";

class MapStorage implements StorageAdapter {
  private readonly map = new Map<string, string>();
  read(key: string) {
    return this.map.get(key) ?? null;
  }
  write(key: string, value: string) {
    this.map.set(key, value);
  }
  remove(key: string) {
    this.map.delete(key);
  }
}

Deno.test("memoryStorage always returns null and never throws", () => {
  assertEquals(memoryStorage.read("any"), null);
  memoryStorage.write("any", "value");
  memoryStorage.remove("any");
});

Deno.test("createKeyedStore round-trips parsed values", () => {
  const store = createKeyedStore(
    new MapStorage(),
    "test",
    (raw) => JSON.parse(raw) as { n: number },
    (value) => JSON.stringify(value),
  );
  store.save({ n: 7 });
  assertEquals(store.load(), { n: 7 });
  store.clear();
  assertEquals(store.load(), null);
});

Deno.test("createKeyedStore returns null on corrupted payloads", () => {
  const storage = new MapStorage();
  storage.write("broken", "not-json");
  const store = createKeyedStore(
    storage,
    "broken",
    (raw) => JSON.parse(raw) as { ok: boolean },
    (value) => JSON.stringify(value),
  );
  assertEquals(store.load(), null);
});

Deno.test("createKeyedStore never throws when underlying storage does", () => {
  const throwing: StorageAdapter = {
    read: () => {
      throw new Error("boom");
    },
    write: () => {
      throw new Error("boom");
    },
    remove: () => {
      throw new Error("boom");
    },
  };
  const store = createKeyedStore(
    throwing,
    "x",
    () => ({ ok: true }),
    () => "",
  );
  assertEquals(store.load(), null);
  store.save({ ok: true });
  store.clear();
  assert(true);
});

Deno.test("localStorageAdapter exposes an object with read/write/remove", () => {
  assert(typeof localStorageAdapter.read === "function");
  assert(typeof localStorageAdapter.write === "function");
  assert(typeof localStorageAdapter.remove === "function");
});
