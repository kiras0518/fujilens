import database from "../data/lenses.json";
import type { LensDatabase } from "../types/lens";

const STORAGE_KEY = "fujilens:compare";
export const MAX_COMPARE = 4;
export const COMPARE_EVENT = "compare-change";

const { lenses } = database as LensDatabase;
export const lensById = new Map(lenses.map((lens) => [lens.id, lens]));

const sanitize = (ids: unknown): string[] =>
  Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string" && lensById.has(id)))].slice(0, MAX_COMPARE) : [];

export const getCompare = (): string[] => {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
};

export const setCompare = (ids: string[]) => {
  const next = sanitize(ids);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode); the list still works for this page view.
  }
  document.dispatchEvent(new CustomEvent<string[]>(COMPARE_EVENT, { detail: next }));
  return next;
};

/** Returns false when the list is full and the lens could not be added. */
export const toggleCompare = (id: string) => {
  const ids = getCompare();
  if (ids.includes(id)) {
    setCompare(ids.filter((other) => other !== id));
    return true;
  }
  if (ids.length >= MAX_COMPARE) return false;
  setCompare([...ids, id]);
  return true;
};

export const compareUrl = (ids: string[]) =>
  `${import.meta.env.BASE_URL}compare/${ids.length ? `?ids=${ids.join(",")}` : ""}`;
