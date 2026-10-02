import type { Lens, Mount } from "../types/lens";

/** 35mm full-frame crop factors: X = APS-C, G = GFX medium format (44×33). */
export const CROP: Record<Mount, number> = { X: 1.5, G: 0.79 };

export const MOUNT_LABEL: Record<Mount, string> = { X: "X 卡口 · APS-C", G: "G 卡口 · 中片幅" };
export const TYPE_LABEL = { prime: "定焦", zoom: "變焦" } as const;

export const equivalentRange = (lens: Lens) => ({
  min: Math.round(lens.focalLength.min * CROP[lens.mount]),
  max: Math.round(lens.focalLength.max * CROP[lens.mount]),
});

/** Logarithmic equivalent-focal axis shared by the focal map, focal bars and the range slider. */
export const AXIS = { min: 10, max: 700 };
export const AXIS_TICKS = [12, 18, 24, 35, 50, 85, 135, 200, 300, 600];

export const focalPercent = (mm: number) => {
  const ratio = Math.log(mm / AXIS.min) / Math.log(AXIS.max / AXIS.min);
  return Math.min(100, Math.max(0, ratio * 100));
};

/** Bar position for a lens on the axis; primes get a minimum visible width. */
export const focalSpan = (lens: Lens, minWidth = 0.8) => {
  const { min, max } = equivalentRange(lens);
  const left = focalPercent(min);
  return { left, width: Math.max(focalPercent(max) - left, minWidth) };
};

/** Range slider works on 0–1000 steps mapped logarithmically to SLIDER_RANGE (equivalent mm). */
export const SLIDER_STEPS = 1000;
export const SLIDER_RANGE = { min: 12, max: 600 };
export const sliderToMm = (step: number) =>
  Math.round(SLIDER_RANGE.min * Math.pow(SLIDER_RANGE.max / SLIDER_RANGE.min, step / SLIDER_STEPS));
export const mmToSlider = (mm: number) =>
  Math.round((Math.log(mm / SLIDER_RANGE.min) / Math.log(SLIDER_RANGE.max / SLIDER_RANGE.min)) * SLIDER_STEPS);

/** Focal presets, defined on equivalent focal length; a lens matches when its range overlaps. */
export const FOCAL_PRESETS = [
  { id: "uw", label: "超廣角", hint: "≤20", min: 0, max: 20 },
  { id: "w", label: "廣角", hint: "21–35", min: 21, max: 35 },
  { id: "n", label: "標準", hint: "36–60", min: 36, max: 60 },
  { id: "p", label: "人像", hint: "61–135", min: 61, max: 135 },
  { id: "t", label: "望遠", hint: ">135", min: 136, max: Infinity },
] as const;

export const APERTURE_OPTIONS = [1.4, 2, 2.8] as const;
export const WEIGHT_LIMIT = { min: 100, max: 2300, step: 50 };

/** Orders by 35mm-equivalent focal length so X and GFX lenses interleave by angle of view. */
export const byFocal = (a: Lens, b: Lens) => {
  const [ra, rb] = [equivalentRange(a), equivalentRange(b)];
  return ra.min - rb.min || ra.max - rb.max || a.name.localeCompare(b.name, "en");
};

/** Previous / next lens within the same mount, ordered by focal length. */
export const neighbors = (lens: Lens, lenses: Lens[]) => {
  const sameMount = lenses.filter((other) => other.mount === lens.mount).sort(byFocal);
  const index = sameMount.findIndex((other) => other.id === lens.id);
  return { prev: sameMount[index - 1] ?? null, next: sameMount[index + 1] ?? null };
};

/** Same-mount lenses closest in (log) focal centre, preferring the same lens type. */
export const similarLenses = (lens: Lens, lenses: Lens[], limit = 4) => {
  const centre = (l: Lens) => Math.log(Math.sqrt(l.focalLength.min * l.focalLength.max));
  return lenses
    .filter((other) => other.mount === lens.mount && other.id !== lens.id)
    .map((other) => ({ other, score: Math.abs(centre(other) - centre(lens)) + (other.type === lens.type ? 0 : 0.35) }))
    .sort((a, b) => a.score - b.score || a.other.name.localeCompare(b.other.name, "en"))
    .slice(0, limit)
    .map(({ other }) => other);
};
