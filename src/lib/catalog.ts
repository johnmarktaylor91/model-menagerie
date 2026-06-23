import fs from "node:fs";
import path from "node:path";

const exportRoot = process.env.TORCHLENS_EXPORT_ROOT ?? path.join(process.cwd(), "export");

export interface AssetRef {
  url: string;
  sha256: string;
  bytes: number;
}

export interface ModelVariant {
  key: string;
  vis_mode: "unrolled" | "rolled";
  collapse: "none" | "auto" | "max";
  label: string;
  svg: AssetRef;
  thumb: AssetRef;
  pdf: AssetRef | null;
  monster: boolean;
}

export interface ModelRecord {
  stable_id: string;
  slug: string;
  display_name: string;
  category: string;
  family_normalized: string;
  domain: string;
  zoo: string;
  source_zoo: string;
  source_license: string;
  source_url: string | null;
  paper_url: string | null;
  render_status: "rendered";
  forward_validated: boolean;
  input_tier: "real" | "wrapper" | "none";
  quarantine: boolean;
  n_ops: number | null;
  graph_shape_hash: string;
  param_count: number | null;
  is_recurrent: boolean | null;
  default_variant: string;
  variants: ModelVariant[];
  tlspec: AssetRef | null;
  recipe_text: string;
  torchlens_version: string;
  renderer_version: string;
  monster_graph: boolean;
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
    categories: CatalogFacet[];
    sizes: CatalogFacet[];
    domains: CatalogFacet[];
    families: CatalogFacet[];
    zoos: CatalogFacet[];
    tiers: CatalogFacet[];
  };
}

/** Return the canonical generated export root. */
export function getExportRoot(): string {
  return exportRoot;
}

/** Read a JSON file from the generated export. */
function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(exportRoot, relativePath), "utf-8")) as T;
}

/** Ensure generated catalog data exists before a page attempts to build. */
export function assertFixtureReady(): void {
  if (!fs.existsSync(path.join(exportRoot, "models.jsonl"))) {
    throw new Error(
      "Catalog export missing. Run `python scripts/build_catalog.py --gallery /home/jtaylor/menagerie_gallery --manifest /home/jtaylor/menagerie_gallery/manifest.tsv --out ./export --limit 600` first.",
    );
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

/** Load the precomputed catalog index and attach the model list. */
export function getCatalogIndex(): CatalogIndex {
  assertFixtureReady();
  return {
    models: getAllModels(),
    facets: readJson<CatalogIndex["facets"]>("facets.json"),
  };
}

/** Return a stable featured set for the landing page. */
export function getFeaturedModels(count = 8): ModelRecord[] {
  return getAllModels()
    .filter((model) => !model.quarantine)
    .sort((left, right) => Number(right.forward_validated) - Number(left.forward_validated) || (right.n_ops ?? 0) - (left.n_ops ?? 0))
    .slice(0, count);
}

/** Return the default variant for a model. */
export function getDefaultVariant(model: ModelRecord): ModelVariant {
  return model.variants.find((variant) => variant.key === model.default_variant) ?? model.variants[0];
}

/** Return one variant by key, falling back to the default variant. */
export function getVariantByKey(model: ModelRecord, key: string | null | undefined): ModelVariant {
  return model.variants.find((variant) => variant.key === key) ?? getDefaultVariant(model);
}

/** Read SVG text for safe inline rendering on model pages. */
export function readSvgAsset(variant: ModelVariant): string {
  const relativePath = variant.svg.url.replace(/^\/export\//, "");
  return fs.readFileSync(path.join(exportRoot, relativePath), "utf-8");
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

/** Return a gallery size bucket from operation count. */
export function getSizeBucket(value: number | null): string {
  if (value === null) {
    return "unknown";
  }
  if (value < 50) {
    return "small";
  }
  if (value < 250) {
    return "medium";
  }
  if (value < 1000) {
    return "large";
  }
  return "monster";
}

/** Format large integers compactly for UI metadata. */
export function formatCount(value: number | null): string {
  if (value === null) {
    return "unknown";
  }
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
