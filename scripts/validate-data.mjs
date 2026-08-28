import { readFileSync } from "node:fs";

const database = JSON.parse(readFileSync(new URL("../src/data/lenses.json", import.meta.url), "utf8"));
const { featureDefinitions, lenses } = database;
const fail = (message) => { throw new Error(`Lens data validation failed: ${message}`); };

if (!Array.isArray(lenses) || lenses.length !== 35) fail("expected exactly 35 lenses");
if (!featureDefinitions || Object.keys(featureDefinitions).length !== 7) fail("expected 7 feature definitions");
if (new Set(lenses.map(({ id }) => id)).size !== lenses.length) fail("lens IDs must be unique");

const allowedSeries = new Set(["XF", "XC", "GF"]);
const allowedMounts = new Set(["X", "G"]);
const allowedTypes = new Set(["prime", "zoom"]);

for (const lens of lenses) {
  if (!lens.id || !lens.name) fail("every lens needs an ID and name");
  if (!allowedSeries.has(lens.series)) fail(`${lens.id} has an invalid series`);
  if (!allowedMounts.has(lens.mount)) fail(`${lens.id} has an invalid mount`);
  if (!allowedTypes.has(lens.type)) fail(`${lens.id} has an invalid type`);
  if (lens.series === "GF" && lens.mount !== "G") fail(`${lens.id} has an inconsistent mount`);
  if ((lens.series === "XF" || lens.series === "XC") && lens.mount !== "X") fail(`${lens.id} has an inconsistent mount`);
  if (lens.type === "prime" && lens.focalLength.min !== lens.focalLength.max) fail(`${lens.id} prime focal range must match`);
  if (lens.type === "zoom" && lens.focalLength.min >= lens.focalLength.max) fail(`${lens.id} zoom focal range must increase`);
  if (!Number.isFinite(lens.weight)) fail(`${lens.id} weight must be numeric`);
  if (lens.filterSize !== null && !Number.isFinite(lens.filterSize)) fail(`${lens.id} filter size must be numeric or null`);
  if (lens.maxMagnification !== null && !Number.isFinite(lens.maxMagnification)) fail(`${lens.id} magnification must be numeric or null`);
  for (const feature of lens.features) if (!featureDefinitions[feature]) fail(`${lens.id} references unknown feature ${feature}`);
}

const seriesCounts = Object.fromEntries(["XF", "XC", "GF"].map((series) => [series, lenses.filter((lens) => lens.series === series).length]));
if (seriesCounts.XF !== 23 || seriesCounts.XC !== 5 || seriesCounts.GF !== 7) fail(`unexpected series totals ${JSON.stringify(seriesCounts)}`);

console.log(`Validated ${lenses.length} lenses and ${Object.keys(featureDefinitions).length} feature definitions.`);
