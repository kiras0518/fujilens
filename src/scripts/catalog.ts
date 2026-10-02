import database from "../data/lenses.json";
import { formatAperture, formatEquivalentFocal, formatFocalLength } from "../lib/format";
import {
  FOCAL_PRESETS, SLIDER_RANGE, SLIDER_STEPS, WEIGHT_LIMIT, byFocal, equivalentRange, mmToSlider, sliderToMm,
} from "../lib/lens-math";
import type { Lens, LensDatabase } from "../types/lens";

const { lenses, featureDefinitions } = database as LensDatabase;

type SetKey = "series" | "type" | "preset" | "feature";
type SortKey = "focal" | "aperture" | "weight" | "magnification";
type Direction = "asc" | "desc";

interface State {
  q: string;
  mount: string;
  series: Set<string>;
  type: Set<string>;
  preset: Set<string>;
  feature: Set<string>;
  aperture: string;
  focalMin: number; // slider steps
  focalMax: number;
  weight: number;
  sort: `${SortKey}-${Direction}`;
  view: "list" | "table";
  equivalent: boolean;
}

/** Filter keys used by pills and "relax one condition" suggestions. */
type FilterKey = "q" | "mount" | SetKey | "aperture" | "focal" | "weight";

const SET_KEYS: SetKey[] = ["series", "type", "preset", "feature"];
const SORT_DEFAULT_DIRECTION: Record<SortKey, Direction> = { focal: "asc", aperture: "asc", weight: "asc", magnification: "desc" };
const SORT_KEYS = Object.keys(SORT_DEFAULT_DIRECTION) as SortKey[];

const defaults = (): State => ({
  q: "", mount: "", series: new Set(), type: new Set(), preset: new Set(), feature: new Set(), aperture: "",
  focalMin: 0, focalMax: SLIDER_STEPS, weight: WEIGHT_LIMIT.max, sort: "focal-asc", view: "list", equivalent: false,
});

// ---------- URL <-> state ----------

const readUrl = (): State => {
  const params = new URLSearchParams(location.search);
  const state = defaults();
  state.q = params.get("q") || "";
  if (["X", "G"].includes(params.get("mount") || "")) state.mount = params.get("mount")!;
  for (const key of SET_KEYS) for (const value of (params.get(key) || "").split(",").filter(Boolean)) state[key].add(value);
  if (["1.4", "2", "2.8"].includes(params.get("ap") || "")) state.aperture = params.get("ap")!;
  const fmin = Number(params.get("fmin"));
  const fmax = Number(params.get("fmax"));
  if (fmin > SLIDER_RANGE.min) state.focalMin = Math.min(mmToSlider(fmin), SLIDER_STEPS);
  if (fmax && fmax < SLIDER_RANGE.max) state.focalMax = Math.max(mmToSlider(fmax), state.focalMin);
  const weight = Number(params.get("w"));
  if (weight >= WEIGHT_LIMIT.min && weight < WEIGHT_LIMIT.max) state.weight = weight;
  const [sortKey, direction] = (params.get("sort") || "").split("-");
  if (SORT_KEYS.includes(sortKey as SortKey) && (direction === "asc" || direction === "desc")) state.sort = `${sortKey as SortKey}-${direction}`;
  if (params.get("view") === "table") state.view = "table";
  state.equivalent = params.get("eq") === "1";
  return state;
};

const writeUrl = (state: State) => {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.mount) params.set("mount", state.mount);
  for (const key of SET_KEYS) if (state[key].size) params.set(key, [...state[key]].join(","));
  if (state.aperture) params.set("ap", state.aperture);
  if (state.focalMin > 0) params.set("fmin", String(sliderToMm(state.focalMin)));
  if (state.focalMax < SLIDER_STEPS) params.set("fmax", String(sliderToMm(state.focalMax)));
  if (state.weight < WEIGHT_LIMIT.max) params.set("w", String(state.weight));
  if (state.sort !== "focal-asc") params.set("sort", state.sort);
  if (state.view !== "list") params.set("view", state.view);
  if (state.equivalent) params.set("eq", "1");
  const query = params.toString().replaceAll("%2C", ",");
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
};

// ---------- filtering ----------

const searchIndex = new Map(lenses.map((lens) => [lens.id, [
  lens.name, lens.series, lens.mount === "G" ? "GFX G mount 中片幅" : "X mount APS-C",
  lens.type === "prime" ? "prime 定焦" : "zoom 變焦",
  formatFocalLength(lens), formatEquivalentFocal(lens), formatAperture(lens),
  ...lens.features.flatMap((code) => [code, featureDefinitions[code]?.name, featureDefinitions[code]?.nameZh]),
].join(" ").toLocaleLowerCase("en")]));

const matches = (lens: Lens, state: State, skip?: FilterKey) => {
  const eq = equivalentRange(lens);
  if (skip !== "mount" && state.mount && lens.mount !== state.mount) return false;
  if (skip !== "series" && state.series.size && !state.series.has(lens.series)) return false;
  if (skip !== "type" && state.type.size && !state.type.has(lens.type)) return false;
  if (skip !== "preset" && state.preset.size && !FOCAL_PRESETS.some((preset) => state.preset.has(preset.id) && eq.max >= preset.min && eq.min <= preset.max)) return false;
  if (skip !== "focal" && (eq.max < sliderToMm(state.focalMin) || eq.min > sliderToMm(state.focalMax))) return false;
  if (skip !== "feature" && ![...state.feature].every((code) => lens.features.includes(code))) return false;
  if (skip !== "aperture" && state.aperture && lens.aperture.maxWide > Number(state.aperture)) return false;
  if (skip !== "weight" && lens.weight > state.weight) return false;
  if (skip !== "q" && state.q) {
    const haystack = searchIndex.get(lens.id) || "";
    if (!state.q.toLocaleLowerCase("en").split(/\s+/).filter(Boolean).every((term) => haystack.includes(term))) return false;
  }
  return true;
};

const compareNullable = (a: number | null, b: number | null, direction: number) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
};

const sortLenses = (list: Lens[], sort: State["sort"]) => {
  const [key, rawDirection] = sort.split("-") as [SortKey, Direction];
  const direction = rawDirection === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    let difference = 0;
    if (key === "focal") difference = byFocal(a, b) * direction;
    if (key === "aperture") difference = (a.aperture.maxWide - b.aperture.maxWide) * direction;
    if (key === "weight") difference = (a.weight - b.weight) * direction;
    if (key === "magnification") difference = compareNullable(a.maxMagnification, b.maxMagnification, direction);
    return difference || byFocal(a, b);
  });
};

/** Human-readable labels for each active condition, used by pills and empty-state suggestions. */
const activeConditions = (state: State): { key: FilterKey; value?: string; label: string }[] => {
  const conditions: { key: FilterKey; value?: string; label: string }[] = [];
  if (state.q) conditions.push({ key: "q", label: `搜尋「${state.q}」` });
  if (state.mount) conditions.push({ key: "mount", label: state.mount === "G" ? "GFX" : "X 系統" });
  state.series.forEach((value) => conditions.push({ key: "series", value, label: value }));
  state.type.forEach((value) => conditions.push({ key: "type", value, label: value === "prime" ? "定焦" : "變焦" }));
  state.preset.forEach((value) => conditions.push({ key: "preset", value, label: FOCAL_PRESETS.find((preset) => preset.id === value)?.label || value }));
  if (state.focalMin > 0 || state.focalMax < SLIDER_STEPS) conditions.push({ key: "focal", label: `等效 ${sliderToMm(state.focalMin)}–${sliderToMm(state.focalMax)}mm` });
  if (state.aperture) conditions.push({ key: "aperture", label: `≤F${state.aperture}` });
  if (state.weight < WEIGHT_LIMIT.max) conditions.push({ key: "weight", label: `≤${state.weight}g` });
  state.feature.forEach((value) => conditions.push({ key: "feature", value, label: value }));
  return conditions;
};

const clearCondition = (state: State, key: FilterKey, value?: string) => {
  const reset = defaults();
  if (key === "series" || key === "type" || key === "preset" || key === "feature") {
    if (value) state[key].delete(value); else state[key].clear();
  } else if (key === "focal") {
    state.focalMin = reset.focalMin;
    state.focalMax = reset.focalMax;
  } else {
    (state as unknown as Record<string, unknown>)[key] = reset[key];
  }
};

// ---------- DOM ----------

const results = document.querySelector<HTMLElement>("[data-results]");
const list = document.querySelector<HTMLElement>("[data-lens-list]");
const tableWrap = document.querySelector<HTMLElement>("[data-table-wrap]");
const tableBody = document.querySelector<HTMLTableSectionElement>("[data-table-body]");
const emptyState = document.querySelector<HTMLElement>("[data-empty-state]");
const emptySuggestions = document.querySelector<HTMLElement>("[data-empty-suggestions]");
const emptyHint = document.querySelector<HTMLElement>("[data-empty-hint]");
const activeFilters = document.querySelector<HTMLElement>("[data-active-filters]");
const searchInput = document.querySelector<HTMLInputElement>("[data-search]");
const sortSelect = document.querySelector<HTMLSelectElement>("[data-sort]");
const equivalentToggle = document.querySelector<HTMLInputElement>("[data-equivalent-toggle]");
const rows = new Map(Array.from(document.querySelectorAll<HTMLElement>(".lens-row")).map((row) => [row.dataset.lensId || "", row]));
const tableRows = new Map(Array.from(document.querySelectorAll<HTMLTableRowElement>("[data-table-body] tr")).map((row) => [row.dataset.lensId || "", row]));
const mapBars = Array.from(document.querySelectorAll<HTMLElement>("[data-map-id]"));

const state = readUrl();

const syncControls = () => {
  // Compare trimmed so typing a trailing space (between search terms) is not overwritten.
  if (searchInput && searchInput.value.trim() !== state.q) searchInput.value = state.q;
  const clearSearch = document.querySelector<HTMLButtonElement>("[data-clear-search]");
  if (clearSearch) clearSearch.hidden = !state.q;
  document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    const key = button.dataset.filter as "mount" | "aperture" | SetKey;
    const value = button.dataset.value || "";
    const pressed = key === "mount" || key === "aperture" ? state[key] === value : state[key].has(value);
    button.setAttribute("aria-pressed", String(pressed));
  });
  document.querySelectorAll<HTMLInputElement>("[data-focal]").forEach((input) => {
    input.value = String(input.dataset.focal === "min" ? state.focalMin : state.focalMax);
  });
  document.querySelectorAll<HTMLElement>("[data-focal-fill]").forEach((fill) => {
    fill.style.left = `${(state.focalMin / SLIDER_STEPS) * 100}%`;
    fill.style.right = `${100 - (state.focalMax / SLIDER_STEPS) * 100}%`;
  });
  document.querySelectorAll<HTMLOutputElement>("[data-focal-output]").forEach((output) => {
    output.value = `${sliderToMm(state.focalMin)}–${sliderToMm(state.focalMax)}mm`;
  });
  document.querySelectorAll<HTMLInputElement>("[data-weight]").forEach((input) => { input.value = String(state.weight); });
  document.querySelectorAll<HTMLOutputElement>("[data-weight-output]").forEach((output) => {
    output.value = state.weight >= WEIGHT_LIMIT.max ? "不限" : `≤ ${state.weight.toLocaleString("en-US")}g`;
  });
  if (sortSelect) sortSelect.value = state.sort;
  if (equivalentToggle) equivalentToggle.checked = state.equivalent;
  document.querySelectorAll<HTMLButtonElement>("[data-view-button]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.viewButton === state.view));
  });
  const [sortKey, direction] = state.sort.split("-");
  document.querySelectorAll<HTMLElement>("[data-sort-column]").forEach((cell) => {
    if (cell.dataset.sortColumn === sortKey) cell.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
    else cell.removeAttribute("aria-sort");
  });
};

const renderPills = (conditions: ReturnType<typeof activeConditions>) => {
  if (!activeFilters) return;
  const pills = conditions.map(({ key, value, label }) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "pill";
    pill.textContent = `${label} ×`;
    pill.setAttribute("aria-label", `移除條件：${label}`);
    pill.addEventListener("click", () => { clearCondition(state, key, value); update(); });
    return pill;
  });
  if (conditions.length > 1) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "text-button";
    clear.textContent = "全部清除";
    clear.addEventListener("click", () => resetAll());
    pills.push(clear);
  }
  activeFilters.replaceChildren(...pills);
};

const renderEmptySuggestions = (conditions: ReturnType<typeof activeConditions>) => {
  if (!emptySuggestions) return;
  const seen = new Set<FilterKey>();
  const suggestions = conditions
    .filter(({ key }) => !seen.has(key) && seen.add(key))
    .map(({ key, label }) => ({ key, label, count: lenses.filter((lens) => matches(lens, state, key)).length }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  if (emptyHint) emptyHint.hidden = suggestions.length === 0;
  emptySuggestions.replaceChildren(...suggestions.map(({ key, label, count }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = `移除「${label}」→ ${count} 支`;
    button.addEventListener("click", () => { clearCondition(state, key); update(); });
    return button;
  }));
};

const apply = () => {
  const visible = sortLenses(lenses.filter((lens) => matches(lens, state)), state.sort);
  const visibleIds = new Set(visible.map((lens) => lens.id));
  const empty = visible.length === 0;

  rows.forEach((row, id) => { row.hidden = !visibleIds.has(id); });
  tableRows.forEach((row, id) => { row.hidden = !visibleIds.has(id); });
  visible.forEach((lens) => {
    const row = rows.get(lens.id);
    const tableRow = tableRows.get(lens.id);
    if (row) list?.append(row);
    if (tableRow) tableBody?.append(tableRow);
  });
  mapBars.forEach((bar) => bar.classList.toggle("is-dim", !visibleIds.has(bar.dataset.mapId || "")));

  document.querySelectorAll<HTMLElement>("[data-results-count]").forEach((node) => { node.textContent = String(visible.length); });
  if (results) {
    results.dataset.view = state.view;
    results.dataset.equivalent = String(state.equivalent);
  }
  if (list) list.hidden = empty || state.view !== "list";
  if (tableWrap) tableWrap.hidden = empty || state.view !== "table";
  if (emptyState) emptyState.hidden = !empty;

  const conditions = activeConditions(state);
  renderPills(conditions);
  if (empty) renderEmptySuggestions(conditions);
  const filterCount = conditions.filter(({ key }) => key !== "q").length;
  document.querySelectorAll<HTMLElement>("[data-active-filter-count]").forEach((badge) => {
    badge.textContent = String(filterCount);
    badge.hidden = filterCount === 0;
  });
};

const update = () => {
  syncControls();
  apply();
  writeUrl(state);
};

const resetAll = (includeSearch = true) => {
  const fresh = defaults();
  Object.assign(state, { ...fresh, q: includeSearch ? "" : state.q, sort: state.sort, view: state.view, equivalent: state.equivalent });
  update();
};

// ---------- events ----------

document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.filter as "mount" | "aperture" | SetKey;
    const value = button.dataset.value || "";
    if (key === "mount" || key === "aperture") state[key] = value;
    else if (state[key].has(value)) state[key].delete(value);
    else state[key].add(value);
    update();
  });
});

document.querySelectorAll<HTMLInputElement>("[data-focal]").forEach((input) => {
  input.addEventListener("input", () => {
    const value = Number(input.value);
    const gap = 20;
    if (input.dataset.focal === "min") state.focalMin = Math.min(value, state.focalMax - gap);
    else state.focalMax = Math.max(value, state.focalMin + gap);
    update();
  });
});

document.querySelectorAll<HTMLInputElement>("[data-weight]").forEach((input) => {
  input.addEventListener("input", () => { state.weight = Number(input.value); update(); });
});

searchInput?.addEventListener("input", () => { state.q = searchInput.value.trim(); update(); });
document.querySelector<HTMLFormElement>("[data-search-form]")?.addEventListener("submit", (event) => event.preventDefault());
sortSelect?.addEventListener("change", () => { state.sort = sortSelect.value as State["sort"]; update(); });
equivalentToggle?.addEventListener("change", () => { state.equivalent = equivalentToggle.checked; update(); });

document.querySelectorAll<HTMLButtonElement>("[data-view-button]").forEach((button) => {
  button.addEventListener("click", () => { state.view = button.dataset.viewButton === "table" ? "table" : "list"; update(); });
});

document.querySelectorAll<HTMLButtonElement>("[data-sort-header]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.sortHeader as SortKey;
    const [currentKey, currentDirection] = state.sort.split("-");
    const direction: Direction = currentKey === key ? (currentDirection === "asc" ? "desc" : "asc") : SORT_DEFAULT_DIRECTION[key];
    state.sort = `${key}-${direction}`;
    update();
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-reset]").forEach((button) => button.addEventListener("click", () => resetAll(false)));
document.querySelector<HTMLButtonElement>("[data-reset-all]")?.addEventListener("click", () => resetAll(true));

const drawer = document.querySelector<HTMLDialogElement>("[data-filter-drawer]");
document.querySelector<HTMLButtonElement>("[data-open-filters]")?.addEventListener("click", () => drawer?.showModal());
document.querySelectorAll<HTMLButtonElement>("[data-close-filters]").forEach((button) => button.addEventListener("click", () => drawer?.close()));
drawer?.addEventListener("click", (event) => { if (event.target === drawer) drawer.close(); });

update();
