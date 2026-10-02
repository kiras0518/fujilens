import { COMPARE_EVENT, MAX_COMPARE, compareUrl, getCompare, lensById, setCompare, toggleCompare } from "./compare-store";

// Theme: explicit choice is stored; otherwise follow the OS preference.
const root = document.documentElement;
document.querySelector<HTMLButtonElement>("[data-theme-toggle]")?.addEventListener("click", () => {
  const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("fujilens:theme", next); } catch { /* ignore */ }
});

// Search box: "/" focuses it; the clear button mirrors the input value.
const searchInput = document.querySelector<HTMLInputElement>("[data-search]");
const clearSearch = document.querySelector<HTMLButtonElement>("[data-clear-search]");
const syncClear = () => { if (clearSearch) clearSearch.hidden = !searchInput?.value; };
searchInput?.addEventListener("input", syncClear);
clearSearch?.addEventListener("click", () => {
  if (!searchInput) return;
  searchInput.value = "";
  searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  searchInput.focus();
});
document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  if (event.key === "/" && !target.matches("input, textarea, select, [contenteditable='true']")) {
    event.preventDefault();
    searchInput?.focus();
  }
});

// Compare list UI: header badge, tray, and every [data-compare-toggle] button.
const tray = document.querySelector<HTMLElement>("[data-compare-tray]");
const trayItems = document.querySelector<HTMLUListElement>("[data-compare-items]");

const renderCompare = (ids: string[]) => {
  const full = ids.length >= MAX_COMPARE;
  document.querySelectorAll<HTMLElement>("[data-compare-count]").forEach((node) => {
    node.textContent = String(ids.length);
    node.hidden = ids.length === 0;
  });
  document.querySelectorAll<HTMLAnchorElement>("[data-compare-link]").forEach((link) => { link.href = compareUrl(ids); });
  document.querySelectorAll<HTMLButtonElement>("[data-compare-toggle]").forEach((button) => {
    const selected = ids.includes(button.dataset.compareToggle || "");
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-disabled", String(full && !selected));
    button.title = full && !selected ? `最多比較 ${MAX_COMPARE} 支鏡頭` : "";
    const label = button.querySelector("span");
    if (label) label.textContent = selected ? button.dataset.labelOn || "✓" : button.dataset.labelOff || "+";
  });
  if (tray && trayItems) {
    tray.hidden = ids.length === 0;
    trayItems.replaceChildren(...ids.map((id) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = lensById.get(id)?.name || id;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `從比較移除 ${name.textContent}`);
      remove.addEventListener("click", () => setCompare(getCompare().filter((other) => other !== id)));
      item.append(name, remove);
      return item;
    }));
  }
};

document.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-compare-toggle]");
  if (button?.dataset.compareToggle) toggleCompare(button.dataset.compareToggle);
});
document.addEventListener(COMPARE_EVENT, (event) => renderCompare((event as CustomEvent<string[]>).detail));
window.addEventListener("storage", (event) => { if (event.key === "fujilens:compare") renderCompare(getCompare()); });
renderCompare(getCompare());
