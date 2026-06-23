import type { APIRoute } from "astro";
import { getAllModels, getDefaultVariant, getSizeBucket, type ModelRecord } from "@/lib/catalog";

type CompactModelIndexEntry = [string, string, string, string, ModelRecord["input_tier"], string, string, string, number | null];

/** Return the content-addressed asset key from a public or export asset URL. */
function assetKey(url: string): string {
  const key = url.split("/").filter(Boolean).pop();
  if (!key) {
    throw new Error(`Asset URL has no key: ${url}`);
  }
  return key;
}

/** Return the compact full-catalog index entry used by lazy client filtering. */
function toIndexEntry(model: ModelRecord): CompactModelIndexEntry {
  const variant = getDefaultVariant(model);
  return [model.slug, model.display_name, model.category, getSizeBucket(model.n_ops), model.input_tier, model.family_normalized, model.zoo, assetKey(variant.thumb.url), model.n_ops];
}

/** Emit a compact model index for full-catalog client-side search and filters. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(getAllModels().map(toIndexEntry)), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
