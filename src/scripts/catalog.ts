import type { Lens, LensDatabase } from "../types/lens";

const dataNode = document.querySelector<HTMLScriptElement>("#lens-database");

if (dataNode) {
  const database = JSON.parse(dataNode.textContent || "{}") as LensDatabase;
  const results = document.querySelector<HTMLElement>("[data-results]");
  const cardGrid = document.querySelector<HTMLElement>("[data-card-grid]");
  const tableBody = document.querySelector<HTMLTableSectionElement>("[data-table-body]");
  const tableWrap = document.querySelector<HTMLElement>("[data-table-wrap]");
  const emptyState = document.querySelector<HTMLElement>("[data-empty-state]");
  const searchInput = document.querySelector<HTMLInputElement>("[data-search]");
  const clearSearch = document.querySelector<HTMLButtonElement>("[data-clear-search]");
  const sortSelect = document.querySelector<HTMLSelectElement>("[data-sort]");
  const countNodes = document.querySelectorAll<HTMLElement>("[data-results-count], [data-drawer-count]");
  const contextNode = document.querySelector<HTMLElement>("[data-results-context]");
  const activeFilterCount = document.querySelector<HTMLElement>("[data-active-filter-count]");
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".lens-card"));
  const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>("[data-table-body] tr"));
  const rowById = new Map(rows.map((row) => [row.dataset.lensId || "", row]));
  const cardsById = new Map(cards.map((card) => [card.dataset.lensId || "", card]));

  const checkedValues = (group: string) => new Set(Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-filter="${group}"]:checked`)).map((input) => input.value));
  const rangeValue = (range: string, bound: "min" | "max") => Number(document.querySelector<HTMLInputElement>(`input[data-range="${range}"][data-bound="${bound}"]`)?.value || 0);
  const searchable = (lens: Lens) => cardsById.get(lens.id)?.dataset.search || lens.name.toLocaleLowerCase("en");

  const compareNullable = (a: number | null, b: number | null, direction: 1 | -1) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a - b) * direction;
  };

  const sortLenses = (lenses: Lens[]) => {
    const [key, rawDirection] = (sortSelect?.value || "focal-asc").split("-") as [string, "asc" | "desc"];
    const direction: 1 | -1 = rawDirection === "desc" ? -1 : 1;
    return [...lenses].sort((a, b) => {
      let difference = 0;
      if (key === "focal") difference = (a.focalLength.min - b.focalLength.min) * direction;
      if (key === "aperture") difference = (a.aperture.maxWide - b.aperture.maxWide) * direction;
      if (key === "weight") difference = (a.weight - b.weight) * direction;
      if (key === "magnification") difference = compareNullable(a.maxMagnification, b.maxMagnification, direction);
      return difference || a.name.localeCompare(b.name, "en");
    });
  };

  const syncRangeOutputs = () => {
    const focalMin = rangeValue("focal", "min");
    const focalMax = rangeValue("focal", "max");
    const weightMin = rangeValue("weight", "min");
    const weightMax = rangeValue("weight", "max");
    document.querySelectorAll<HTMLOutputElement>('[data-range-output="focal"]').forEach((output) => { output.value = `${focalMin}–${focalMax}mm`; });
    document.querySelectorAll<HTMLOutputElement>('[data-range-output="weight"]').forEach((output) => { output.value = `${weightMin.toLocaleString()}–${weightMax.toLocaleString()}g`; });
  };

  const apply = () => {
    const mounts = checkedValues("mount");
    const series = checkedValues("series");
    const types = checkedValues("type");
    const features = checkedValues("feature");
    const focalMin = rangeValue("focal", "min");
    const focalMax = rangeValue("focal", "max");
    const weightMin = rangeValue("weight", "min");
    const weightMax = rangeValue("weight", "max");
    const terms = (searchInput?.value || "").trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean);

    const visible = database.lenses.filter((lens) => {
      const groupMatch = (!mounts.size || mounts.has(lens.mount)) && (!series.size || series.has(lens.series)) && (!types.size || types.has(lens.type));
      const featureMatch = [...features].every((feature) => lens.features.includes(feature));
      const focalMatch = lens.focalLength.max >= focalMin && lens.focalLength.min <= focalMax;
      const weightMatch = lens.weight >= weightMin && lens.weight <= weightMax;
      const searchMatch = terms.every((term) => searchable(lens).includes(term));
      return groupMatch && featureMatch && focalMatch && weightMatch && searchMatch;
    });

    const sorted = sortLenses(visible);
    const visibleIds = new Set(sorted.map((lens) => lens.id));
    cards.forEach((card) => { card.hidden = !visibleIds.has(card.dataset.lensId || ""); });
    rows.forEach((row) => { row.hidden = !visibleIds.has(row.dataset.lensId || ""); });
    sorted.forEach((lens) => {
      const card = cardsById.get(lens.id);
      const row = rowById.get(lens.id);
      if (card) cardGrid?.append(card);
      if (row) tableBody?.append(row);
    });

    countNodes.forEach((node) => { node.textContent = String(visible.length); });
    if (emptyState) emptyState.hidden = visible.length !== 0;
    if (cardGrid) cardGrid.hidden = visible.length === 0 || results?.dataset.view === "table";
    if (tableWrap) tableWrap.hidden = visible.length === 0 || results?.dataset.view !== "table";
    if (clearSearch) clearSearch.hidden = !searchInput?.value;

    const categoryCount = mounts.size + series.size + types.size + features.size;
    const rangeCount = Number(focalMin !== 8 || focalMax !== 400) + Number(weightMin !== 78 || weightMax !== 2265);
    const totalActive = categoryCount + rangeCount;
    if (activeFilterCount) activeFilterCount.textContent = totalActive ? `(${totalActive})` : "";
    if (contextNode) {
      const context = [...series, ...types].map((item) => item.toUpperCase());
      contextNode.textContent = context.length ? context.join(" / ") : terms.length ? "SEARCH RESULTS" : "ALL LENSES";
    }
  };

  const setView = (view: "cards" | "table") => {
    if (!results) return;
    results.dataset.view = view;
    document.querySelectorAll<HTMLButtonElement>("[data-view-button]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.viewButton === view)));
    apply();
  };

  document.querySelectorAll<HTMLInputElement>("input[data-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      document.querySelectorAll<HTMLInputElement>(`input[data-filter="${input.dataset.filter}"]`).forEach((peer) => { if (peer.value === input.value) peer.checked = input.checked; });
      apply();
    });
  });

  document.querySelectorAll<HTMLInputElement>("input[data-range]").forEach((input) => {
    input.addEventListener("input", () => {
      const range = input.dataset.range || "";
      const bound = input.dataset.bound as "min" | "max";
      const opposite = bound === "min" ? "max" : "min";
      const oppositeValue = rangeValue(range, opposite);
      const nextValue = bound === "min" ? Math.min(Number(input.value), oppositeValue) : Math.max(Number(input.value), oppositeValue);
      document.querySelectorAll<HTMLInputElement>(`input[data-range="${range}"][data-bound="${bound}"]`).forEach((peer) => { peer.value = String(nextValue); });
      syncRangeOutputs(); apply();
    });
  });

  const resetFilters = (includeSearch = false) => {
    document.querySelectorAll<HTMLInputElement>("input[data-filter]").forEach((input) => { input.checked = false; });
    document.querySelectorAll<HTMLInputElement>("input[data-range]").forEach((input) => { input.value = input.dataset.bound === "min" ? input.min : input.max; });
    if (includeSearch && searchInput) searchInput.value = "";
    syncRangeOutputs(); apply();
  };

  document.querySelectorAll<HTMLButtonElement>("[data-reset]").forEach((button) => button.addEventListener("click", () => resetFilters()));
  document.querySelector<HTMLButtonElement>("[data-reset-all]")?.addEventListener("click", () => resetFilters(true));
  searchInput?.addEventListener("input", apply);
  clearSearch?.addEventListener("click", () => { if (searchInput) searchInput.value = ""; apply(); searchInput?.focus(); });
  sortSelect?.addEventListener("change", apply);
  document.querySelectorAll<HTMLButtonElement>("[data-view-button]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewButton as "cards" | "table")));

  const drawer = document.querySelector<HTMLDialogElement>("[data-filter-drawer]");
  document.querySelector<HTMLButtonElement>("[data-open-filters]")?.addEventListener("click", () => drawer?.showModal());
  document.querySelector<HTMLButtonElement>("[data-close-filters]")?.addEventListener("click", () => drawer?.close());
  document.querySelector<HTMLButtonElement>("[data-apply-filters]")?.addEventListener("click", () => drawer?.close());
  drawer?.addEventListener("click", (event) => { if (event.target === drawer) drawer.close(); });

  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (event.key === "/" && !target.matches("input, textarea, select, [contenteditable='true']")) { event.preventDefault(); searchInput?.focus(); }
  });

  syncRangeOutputs(); setView("cards");
}
