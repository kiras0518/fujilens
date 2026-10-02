import database from "../data/lenses.json";
import {
  formatAperture, formatConstruction, formatEquivalentFocal, formatFilter, formatFocalLength, formatMagnification, formatWeight,
} from "../lib/format";
import { AXIS_TICKS, focalPercent, focalSpan } from "../lib/lens-math";
import type { Lens, LensDatabase } from "../types/lens";
import { COMPARE_EVENT, MAX_COMPARE, getCompare, lensById, setCompare } from "./compare-store";

const { featureDefinitions } = database as LensDatabase;
const base = import.meta.env.BASE_URL;

const root = document.querySelector<HTMLElement>("[data-compare-root]");
const empty = document.querySelector<HTMLElement>("[data-compare-empty]");
const title = document.querySelector<HTMLElement>("[data-compare-title]");
const addSelect = document.querySelector<HTMLSelectElement>("[data-compare-add]");
const diffToggle = document.querySelector<HTMLInputElement>("[data-compare-diff]");

interface Row {
  label: string;
  values: string[];
  /** Raw numbers used to mark the best value; omitted for non-comparable rows. */
  raw?: (number | null)[];
  best?: "min" | "max";
}

const buildRows = (lenses: Lens[]): Row[] => [
  { label: "焦距", values: lenses.map(formatFocalLength) },
  { label: "等效焦距", values: lenses.map(formatEquivalentFocal) },
  { label: "最大光圈", values: lenses.map(formatAperture), raw: lenses.map((lens) => lens.aperture.maxWide), best: "min" },
  { label: "重量", values: lenses.map((lens) => formatWeight(lens.weight)), raw: lenses.map((lens) => lens.weight), best: "min" },
  { label: "最大放大倍率", values: lenses.map((lens) => formatMagnification(lens.maxMagnification)), raw: lenses.map((lens) => lens.maxMagnification), best: "max" },
  { label: "鏡片結構", values: lenses.map(formatConstruction) },
  { label: "光圈葉片", values: lenses.map((lens) => String(lens.apertureBlades)), raw: lenses.map((lens) => lens.apertureBlades), best: "max" },
  { label: "濾鏡口徑", values: lenses.map((lens) => formatFilter(lens.filterSize)) },
  { label: "卡口", values: lenses.map((lens) => (lens.mount === "G" ? "G 卡口" : "X 卡口")) },
  ...Object.entries(featureDefinitions).map(([code, definition]) => ({
    label: `${code} ${definition.nameZh}`,
    values: lenses.map((lens) => (lens.features.includes(code) ? "●" : "—")),
  })),
];

const bestFlags = (row: Row) => {
  if (!row.raw || !row.best) return row.values.map(() => false);
  const numbers = row.raw.filter((value): value is number => value !== null);
  if (numbers.length < 2 || new Set(numbers).size === 1) return row.values.map(() => false);
  const target = row.best === "min" ? Math.min(...numbers) : Math.max(...numbers);
  return row.raw.map((value) => value === target);
};

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const renderOverlay = (lenses: Lens[]) => {
  const figure = element("figure", "focal-position compare-overlay");
  figure.append(element("figcaption", undefined, "焦段涵蓋（35mm 等效）"));
  for (const lens of lenses) {
    const line = element("div", "compare-overlay-row");
    const track = element("div", "focal-position-track");
    const bar = element("i", "focal-position-current");
    const { left, width } = focalSpan(lens);
    bar.style.left = `${left}%`;
    bar.style.width = `${width}%`;
    track.append(bar);
    line.append(element("span", undefined, lens.name), track);
    figure.append(line);
  }
  const axis = element("div", "focal-axis");
  axis.setAttribute("aria-hidden", "true");
  for (const tick of AXIS_TICKS) {
    const label = element("span", undefined, String(tick));
    label.style.left = `${focalPercent(tick)}%`;
    axis.append(label);
  }
  figure.append(axis);
  return figure;
};

const renderTable = (lenses: Lens[]) => {
  const wrap = element("div", "table-wrap compare-table-wrap");
  const table = element("table", "lens-table compare-table num");
  const head = element("thead");
  const headRow = element("tr");
  headRow.append(element("th", "sr-only-cell", ""));
  for (const lens of lenses) {
    const cell = element("th");
    cell.scope = "col";
    const chip = element("span", `series-chip series-${lens.series.toLowerCase()}`, lens.series);
    const link = element("a", undefined, lens.name);
    link.href = `${base}lenses/${lens.id}/`;
    const remove = element("button", "text-button", "移除");
    remove.type = "button";
    remove.setAttribute("aria-label", `從比較移除 ${lens.name}`);
    remove.addEventListener("click", () => setCompare(getCompare().filter((id) => id !== lens.id)));
    cell.append(chip, link, remove);
    headRow.append(cell);
  }
  head.append(headRow);

  const body = element("tbody");
  const onlyDiff = diffToggle?.checked ?? false;
  for (const row of buildRows(lenses)) {
    if (onlyDiff && new Set(row.values).size === 1) continue;
    const tr = element("tr");
    const th = element("th", undefined, row.label);
    th.scope = "row";
    tr.append(th);
    const flags = bestFlags(row);
    row.values.forEach((value, index) => {
      const td = element("td", flags[index] ? "is-best" : undefined, value);
      if (flags[index]) td.setAttribute("aria-label", `${value}（最佳）`);
      tr.append(td);
    });
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
};

const render = (ids: string[]) => {
  const lenses = ids.map((id) => lensById.get(id)).filter((lens): lens is Lens => Boolean(lens));
  const query = ids.length ? `?ids=${ids.join(",")}` : "";
  history.replaceState(null, "", `${location.pathname}${query}`);
  if (title) title.textContent = lenses.length ? `比較 ${lenses.length} 支鏡頭` : "鏡頭比較";
  if (empty) empty.hidden = lenses.length > 0;
  if (addSelect) {
    addSelect.disabled = lenses.length >= MAX_COMPARE;
    addSelect.options[0].textContent = lenses.length >= MAX_COMPARE ? `已達上限 ${MAX_COMPARE} 支` : "＋ 加入鏡頭…";
    Array.from(addSelect.options).forEach((option) => { if (option.value) option.disabled = ids.includes(option.value); });
  }
  if (!root) return;
  if (!lenses.length) { root.replaceChildren(); return; }
  const nodes: HTMLElement[] = [renderOverlay(lenses), renderTable(lenses)];
  if (lenses.length === 1) nodes.push(element("p", "muted", "再加入至少 1 支鏡頭即可並排比較。"));
  else nodes.push(element("p", "muted compare-legend", "紅色標示該列最佳值。"));
  root.replaceChildren(...nodes);
};

// URL wins on first load so shared links work; afterwards the store is the source of truth.
const urlIds = new URLSearchParams(location.search).get("ids");
if (urlIds !== null) setCompare(urlIds.split(",").filter(Boolean));
render(getCompare());

document.addEventListener(COMPARE_EVENT, (event) => render((event as CustomEvent<string[]>).detail));
diffToggle?.addEventListener("change", () => render(getCompare()));
addSelect?.addEventListener("change", () => {
  if (addSelect.value) setCompare([...getCompare(), addSelect.value]);
  addSelect.value = "";
});
