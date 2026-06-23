import fs from "node:fs";
import path from "node:path";

const siteDataRoot = path.join(process.cwd(), "site-data");
const modelsJsonlPath = path.join(siteDataRoot, "models.jsonl");
const publicR2Base = (import.meta.env.PUBLIC_R2_BASE as string | undefined)?.replace(/\/+$/, "") ?? "";

let catalogModels: ModelRecord[] | null = null;
let catalogBySlug: Map<string, ModelRecord> | null = null;

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

/** Return the canonical committed site data root. */
export function getExportRoot(): string {
  return siteDataRoot;
}

/** Read a JSON file from committed site data. */
function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(siteDataRoot, relativePath), "utf-8")) as T;
}

/** Ensure committed catalog data exists before a page attempts to build. */
export function assertFixtureReady(): void {
  if (!fs.existsSync(modelsJsonlPath)) {
    throw new Error(
      "Committed site data missing. Run `python scripts/sync_site_data.py --export-dir <generated-catalog-dir> --site-data ./site-data` after building the catalog data.",
    );
  }
}

/** Return the asset basename used as the R2 object key. */
function assetKey(ref: AssetRef): string {
  const key = ref.url.split("/").filter(Boolean).pop();
  if (!key) {
    throw new Error(`Asset reference has no key: ${ref.url}`);
  }
  return key;
}

/** Return a build-time public URL for a content-addressed asset. */
function publicAssetUrl(ref: AssetRef): string {
  const key = assetKey(ref);
  return publicR2Base ? `${publicR2Base}/${key}` : `/assets/${key}`;
}

/** Return an asset reference with its URL rewritten for public delivery. */
function withPublicAssetUrl(ref: AssetRef): AssetRef {
  return {
    ...ref,
    url: publicAssetUrl(ref),
  };
}

/** Return a model variant with public asset URLs. */
function withPublicVariantAssetUrls(variant: ModelVariant): ModelVariant {
  return {
    ...variant,
    svg: withPublicAssetUrl(variant.svg),
    thumb: withPublicAssetUrl(variant.thumb),
    pdf: variant.pdf ? withPublicAssetUrl(variant.pdf) : null,
  };
}

/** Return a model record with public asset URLs. */
function withPublicModelAssetUrls(model: ModelRecord): ModelRecord {
  return {
    ...model,
    variants: model.variants.map(withPublicVariantAssetUrls),
    tlspec: model.tlspec ? withPublicAssetUrl(model.tlspec) : null,
  };
}

/** Load all model records from committed JSON Lines data once. */
function loadCatalogModels(): ModelRecord[] {
  assertFixtureReady();
  if (catalogModels === null) {
    catalogModels = fs
      .readFileSync(modelsJsonlPath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => withPublicModelAssetUrls(JSON.parse(line) as ModelRecord));
  }
  return catalogModels;
}

/** Return the slug lookup map for committed JSON Lines data. */
function loadCatalogBySlug(): Map<string, ModelRecord> {
  if (catalogBySlug === null) {
    catalogBySlug = new Map(loadCatalogModels().map((model) => [model.slug, model]));
  }
  return catalogBySlug;
}

/** Return all model slugs from the in-memory JSON Lines index. */
export function listModelSlugs(): string[] {
  return loadCatalogModels()
    .map((model) => model.slug)
    .sort();
}

/** Load one model by slug from the in-memory JSON Lines index. */
export function getModelBySlug(slug: string): ModelRecord {
  const model = loadCatalogBySlug().get(slug);
  if (!model) {
    throw new Error(`Model not found: ${slug}`);
  }
  return model;
}

/** Load the complete catalog for aggregate pages and search bootstrap data. */
export function getAllModels(): ModelRecord[] {
  return loadCatalogModels();
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
