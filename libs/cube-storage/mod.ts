export interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export const memoryStorage: StorageAdapter = Object.freeze({
  read(_key: string) {
    return null;
  },
  write(_key: string, _value: string) {
    // no-op
  },
  remove(_key: string) {
    // no-op
  },
});

function safeGet(): Storage | null {
  try {
    if (typeof globalThis === "undefined") return null;
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (!candidate) return null;
    const probe = "__cuberub_probe__";
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return null;
  }
}

export const localStorageAdapter: StorageAdapter = (() => {
  const target = safeGet();
  if (!target) return memoryStorage;
  const adapter: StorageAdapter = {
    read(key: string) {
      try {
        return target.getItem(key);
      } catch {
        return null;
      }
    },
    write(key: string, value: string) {
      try {
        target.setItem(key, value);
      } catch {
        // quota exceeded, private mode, etc.
      }
    },
    remove(key: string) {
      try {
        target.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
  return Object.freeze(adapter);
})();

export interface KeyedStore<T> {
  load(): T | null;
  save(value: T): void;
  clear(): void;
}

export function createKeyedStore<T>(
  storage: StorageAdapter,
  key: string,
  parse: (raw: string) => T | null,
  serialize: (value: T) => string,
): KeyedStore<T> {
  return Object.freeze({
    load() {
      let raw: string | null;
      try {
        raw = storage.read(key);
      } catch {
        return null;
      }
      if (raw === null || raw === undefined) return null;
      try {
        return parse(raw);
      } catch {
        return null;
      }
    },
    save(value: T) {
      try {
        storage.write(key, serialize(value));
      } catch {
        // fail soft
      }
    },
    clear() {
      try {
        storage.remove(key);
      } catch {
        // fail soft
      }
    },
  });
}
