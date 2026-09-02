import { describe, expect, it } from "vitest";
import { GUEST_STORAGE_KEY, readGuestTasks, writeGuestTasks } from "./storage";
import type { Task } from "./types";

const task: Task = {
  id: "a",
  title: "Buy milk",
  status: "pending",
  category: "errands",
  date: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("readGuestTasks", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(readGuestTasks(memoryStorage())).toEqual([]);
  });

  it("round-trips a valid list", () => {
    const storage = memoryStorage();
    writeGuestTasks(storage, [task]);

    expect(readGuestTasks(storage)).toEqual([task]);
  });

  it("discards malformed JSON rather than throwing", () => {
    expect(readGuestTasks(memoryStorage({ [GUEST_STORAGE_KEY]: "{not json" }))).toEqual(
      [],
    );
  });

  it("discards a list written by an older schema", () => {
    const legacy = JSON.stringify([{ id: "a", title: "Buy milk", status: "pending" }]);

    expect(readGuestTasks(memoryStorage({ [GUEST_STORAGE_KEY]: legacy }))).toEqual([]);
  });

  it("survives storage that throws on access", () => {
    const hostile = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error("SecurityError");
      },
    } as Storage;

    expect(readGuestTasks(hostile)).toEqual([]);
  });
});

describe("writeGuestTasks", () => {
  it("swallows a quota error instead of breaking the session", () => {
    const full = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as Storage;

    expect(() => writeGuestTasks(full, [task])).not.toThrow();
  });
});
