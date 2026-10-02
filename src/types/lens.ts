export type Mount = "X" | "G";
export type Series = "XF" | "XC" | "GF";
export type LensType = "prime" | "zoom";

export interface FeatureDefinition {
  name: string;
  nameZh: string;
  description: string;
}

export interface Lens {
  id: string;
  series: Series;
  mount: Mount;
  type: LensType;
  name: string;
  focalLength: { min: number; max: number };
  aperture: { maxWide: number; maxTele: number };
  opticalConstruction: { groups: number; elements: number };
  apertureBlades: number;
  maxMagnification: number | null;
  filterSize: number | null;
  weight: number;
  features: string[];
  generation: number;
}

export interface LensDatabase {
  featureDefinitions: Record<string, FeatureDefinition>;
  lenses: Lens[];
}
