import { TASK_CATEGORIES, type TaskCategory } from "./types";

const LEGACY_ALIASES: Record<string, TaskCategory> = {
  // English free-text emitted by the previous prompt
  appointment: "appointment",
  meeting: "appointment",
  market: "errands",
  groceries: "errands",
  shopping: "errands",
  food: "errands",
  work: "work",
  personal: "personal",
  health: "health",
  finance: "finance",
  study: "study",
  school: "study",
  general: "general",
  // Portuguese free-text emitted by the previous prompt
  compromisso: "appointment",
  reuniao: "appointment",
  mercado: "errands",
  compras: "errands",
  lazer: "personal",
  trabalho: "work",
  pessoal: "personal",
  saude: "health",
  financas: "finance",
  estudo: "study",
  geral: "general",
};

const isTaskCategory = (value: string): value is TaskCategory =>
  (TASK_CATEGORIES as readonly string[]).includes(value);

/**
 * Maps any incoming category string onto a known slug.
 *
 * Existing Firestore documents hold localized free text written by the old
 * prompt, so reads go through here rather than trusting the stored value.
 * Anything unrecognised becomes "general" instead of creating a new group.
 */
export function normalizeCategory(input: unknown): TaskCategory {
  if (typeof input !== "string") return "general";

  const slug = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (isTaskCategory(slug)) return slug;
  return LEGACY_ALIASES[slug] ?? "general";
}
