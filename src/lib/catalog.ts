import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const exportRoot = path.join(root, "fixture", "export", "v1");

export interface AssetRef {
  url: string;
  sha256: string;
  bytes: number;
}

export interface ModelAssets {
  svg: AssetRef;
  thumb: AssetRef;
  pdf: AssetRef | null;
  tlspec: AssetRef;
}

export interface ModelRecord {
  stable_id: string;
  slug: string;
  display_name: string;
  family_normalized: string;
  domain: string;
  zoo: string;
  era_raw: string;
  year: number | null;
  year_confidence: string;
  source_zoo: string;
  source_license: string;
  source_url: string;
  paper_url: string | null;
  render_status: "rendered";
  forward_validated: boolean;
  input_tier: "real" | "wrapper" | "none";
  quarantine: boolean;
  n_ops: number | null;
  graph_shape_hash: string;
  param_count: number | null;
  is_recurrent: boolean | null;
  input_shape_label: string;
  input_dtype_label: string;
  recipe_text: string;
  torchlens_version: string;
  renderer_version: string;
  monster_graph: boolean;
  assets: ModelAssets;
}

export interface Funnel {
  cataloged: number;
  build_verified: number;
  forward_validated_real: number;
  forward_validated_wrapper: number;
  rendered: number;
  quarantined: number;
  deferred: number;
  predicate_note: string;
}

export interface Manifest {
  schema_version: string;
  export_version: string;
  counts: Record<string, number>;
  torchlens_version: string;
  renderer_version: string;
}

export interface CatalogFacet {
  value: string;
  count: number;
}

export interface CatalogIndex {
  models: ModelRecord[];
  facets: {
    domains: CatalogFacet[];
    families: CatalogFacet[];
    zoos: CatalogFacet[];
    tiers: CatalogFacet[];
  };
}

/** Return the canonical fixture export root. */
export function getExportRoot(): string {
  return exportRoot;
}

/** Read a JSON file from the fixture export. */
function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(exportRoot, relativePath), "utf-8")) as T;
}

/** Ensure fixture data exists before a page attempts to build. */
export function assertFixtureReady(): void {
  if (!fs.existsSync(path.join(exportRoot, "models.jsonl"))) {
    throw new Error("Fixture export missing. Run `python scripts/gen_fixture.py` first.");
  }
}

/** Return all model slugs without loading every model body. */
export function listModelSlugs(): string[] {
  assertFixtureReady();
  const modelDir = path.join(exportRoot, "models");
  return fs
    .readdirSync(modelDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -5))
    .sort();
}

/** Load one model by slug from its per-model JSON document. */
export function getModelBySlug(slug: string): ModelRecord {
  assertFixtureReady();
  return readJson<ModelRecord>(path.join("models", `${slug}.json`));
}

/** Load the complete catalog for aggregate pages and search bootstrap data. */
export function getAllModels(): ModelRecord[] {
  assertFixtureReady();
  const lines = fs.readFileSync(path.join(exportRoot, "models.jsonl"), "utf-8").trim().split("\n");
  return lines.filter(Boolean).map((line) => JSON.parse(line) as ModelRecord);
}

/** Load funnel counts. */
export function getFunnel(): Funnel {
  assertFixtureReady();
  return readJson<Funnel>("funnel.json");
}

/** Load export manifest metadata. */
export function getManifest(): Manifest {
  assertFixtureReady();
  return readJson<Manifest>("export_manifest.json");
}

/** Build facet counts for the client-side gallery controls. */
export function getCatalogIndex(): CatalogIndex {
  const models = getAllModels();
  return {
    models,
    facets: {
      domains: countFacet(models.map((model) => model.domain)),
      families: countFacet(models.map((model) => model.family_normalized)),
      zoos: countFacet(models.map((model) => model.zoo)),
      tiers: countFacet(models.map((model) => model.input_tier)),
    },
  };
}

/** Return a stable featured set for the landing page. */
export function getFeaturedModels(count = 8): ModelRecord[] {
  return getAllModels()
    .filter((model) => !model.quarantine)
    .sort((left, right) => Number(right.forward_validated) - Number(left.forward_validated) || (right.n_ops ?? 0) - (left.n_ops ?? 0))
    .slice(0, count);
}

/** Read SVG text for safe inline rendering on model pages. */
export function readSvgAsset(model: ModelRecord): string {
  const relativePath = model.assets.svg.url.replace(/^\//, "");
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

/** Return previous and next models using slug order only. */
export function getAdjacentModels(slug: string): { prev: ModelRecord | null; next: ModelRecord | null } {
  const slugs = listModelSlugs();
  const index = slugs.indexOf(slug);
  return {
    prev: index > 0 ? getModelBySlug(slugs[index - 1]) : null,
    next: index >= 0 && index < slugs.length - 1 ? getModelBySlug(slugs[index + 1]) : null,
  };
}

/** Format large integers compactly for UI metadata. */
export function formatCount(value: number | null): string {
  if (value === null) {
    return "unknown";
  }
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Count and sort facet values. */
function countFacet(values: string[]): CatalogFacet[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}
