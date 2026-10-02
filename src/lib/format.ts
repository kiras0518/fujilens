import type { Lens } from "../types/lens";
import { equivalentRange } from "./lens-math";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const formatRange = (min: number, max: number) => (min === max ? `${min}mm` : `${min}–${max}mm`);

export const formatFocalLength = (lens: Lens) => formatRange(lens.focalLength.min, lens.focalLength.max);

export const formatEquivalentFocal = (lens: Lens) => {
  const { min, max } = equivalentRange(lens);
  return formatRange(min, max);
};

export const formatAperture = (lens: Lens) =>
  lens.aperture.maxWide === lens.aperture.maxTele
    ? `F${number.format(lens.aperture.maxWide)}`
    : `F${number.format(lens.aperture.maxWide)}–${number.format(lens.aperture.maxTele)}`;

export const formatMagnification = (value: number | null) =>
  value === null ? "—" : `${number.format(value)}×`;

export const formatFilter = (value: number | null) =>
  value === null ? "—" : `Ø${value}mm`;

export const formatWeight = (value: number) => `${value.toLocaleString("en-US")}g`;

export const formatConstruction = (lens: Lens) =>
  `${lens.opticalConstruction.groups} 群 ${lens.opticalConstruction.elements} 枚`;
