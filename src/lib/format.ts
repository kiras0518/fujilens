import type { Lens } from "../types/lens";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const formatFocalLength = (lens: Lens) =>
  lens.focalLength.min === lens.focalLength.max
    ? `${lens.focalLength.min}mm`
    : `${lens.focalLength.min}–${lens.focalLength.max}mm`;

export const formatAperture = (lens: Lens) =>
  lens.aperture.maxWide === lens.aperture.maxTele
    ? `F${number.format(lens.aperture.maxWide)}`
    : `F${number.format(lens.aperture.maxWide)}–${number.format(lens.aperture.maxTele)}`;

export const formatMagnification = (value: number | null) =>
  value === null ? "—" : `${number.format(value)}×`;

export const formatFilter = (value: number | null) =>
  value === null ? "—" : `Ø${value}mm`;
