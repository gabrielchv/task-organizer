import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "task-helper-test";
const ALICE = "alice";
const BOB = "bob";

let testEnv: RulesTestEnvironment;

function validTask(overrides: Record<string, unknown> = {}) {
  return {
    title: "Dentist",
    status: "pending",
    category: "health",
    date: "2026-03-12T14:00",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function taskRef(uid: string, actorUid: string | null, taskId = "task-1") {
  const context =
    actorUid === null
      ? testEnv.unauthenticatedContext()
      : testEnv.authenticatedContext(actorUid);
  return doc(context.firestore(), `users/${uid}/tasks/${taskId}`);
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("users/{uid}/tasks", () => {
  it("lets a user create their own task", async () => {
    await assertSucceeds(setDoc(taskRef(ALICE, ALICE), validTask()));
  });

  it("lets a user read, update and delete their own task", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${ALICE}/tasks/task-1`), validTask());
    });

    await assertSucceeds(getDoc(taskRef(ALICE, ALICE)));
    await assertSucceeds(
      setDoc(taskRef(ALICE, ALICE), validTask({ status: "completed" })),
    );
    await assertSucceeds(deleteDoc(taskRef(ALICE, ALICE)));
  });

  it("denies reading another user's tasks", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${ALICE}/tasks/task-1`), validTask());
    });

    await assertFails(getDoc(taskRef(ALICE, BOB)));
  });

  it("denies writing into another user's tasks", async () => {
    await assertFails(setDoc(taskRef(ALICE, BOB), validTask()));
  });

  it("denies deleting another user's task", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${ALICE}/tasks/task-1`), validTask());
    });

    await assertFails(deleteDoc(taskRef(ALICE, BOB)));
  });

  it("denies anonymous access entirely", async () => {
    await assertFails(getDoc(taskRef(ALICE, null)));
    await assertFails(setDoc(taskRef(ALICE, null), validTask()));
  });

  describe("document shape", () => {
    it("rejects an empty title", async () => {
      await assertFails(setDoc(taskRef(ALICE, ALICE), validTask({ title: "" })));
    });

    it("rejects an oversized title", async () => {
      await assertFails(
        setDoc(taskRef(ALICE, ALICE), validTask({ title: "x".repeat(201) })),
      );
    });

    it("rejects an unknown status", async () => {
      await assertFails(setDoc(taskRef(ALICE, ALICE), validTask({ status: "archived" })));
    });

    it("rejects a category outside the known set", async () => {
      await assertFails(setDoc(taskRef(ALICE, ALICE), validTask({ category: "Saúde" })));
    });

    it("rejects a malformed date", async () => {
      await assertFails(setDoc(taskRef(ALICE, ALICE), validTask({ date: "12/03/2026" })));
    });

    it("accepts a null date and an all-day date", async () => {
      await assertSucceeds(setDoc(taskRef(ALICE, ALICE), validTask({ date: null })));
      await assertSucceeds(
        setDoc(taskRef(ALICE, ALICE), validTask({ date: "2026-03-12" })),
      );
    });

    it("rejects unexpected fields", async () => {
      await assertFails(setDoc(taskRef(ALICE, ALICE), validTask({ isAdmin: true })));
    });
  });
});

describe("rateLimits", () => {
  it("is unreachable from any client", async () => {
    const context = testEnv.authenticatedContext(ALICE);
    const ref = doc(context.firestore(), "rateLimits/alice:m");

    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { count: 0 }));
  });
});
