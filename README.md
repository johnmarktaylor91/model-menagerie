# TorchLens Model Menagerie Web

Astro static site for the public Model Menagerie gallery. Phase 0 points the existing scaffold at the real rendered diagram catalog while preserving the target Tier-B schema.

## Run

Generate the local preview export first:

```bash
python scripts/build_catalog.py \
  --gallery /home/jtaylor/menagerie_gallery \
  --manifest /home/jtaylor/menagerie_gallery/manifest.tsv \
  --out ./export \
  --limit 600
npm install
npm run dev
```

Build the static site and Pagefind index:

```bash
npm run build
npx astro check
```

`npm run build` mirrors `export/` into `public/export/` before Astro builds, so asset URLs such as `/export/assets/<sha256>.svg` resolve in dev and in `dist`.

## Regenerating the Catalog

`scripts/build_catalog.py` is the re-runnable Phase 0 export builder:

```bash
python scripts/build_catalog.py --gallery /home/jtaylor/menagerie_gallery --manifest /home/jtaylor/menagerie_gallery/manifest.tsv --out ./export --limit 600
```

It reads rendered manifest rows, verifies each SVG exists, copies SVGs into content-addressed assets, generates WebP thumbnails, and emits:

- `models/<slug>.json`
- `models.jsonl`
- `funnel.json`
- `export_manifest.json`
- `facets.json`
- `catalog.csv`
- `assets/<sha256>.svg` and `assets/<sha256>.webp`

Use `--limit 600` for a fast local preview. To scale to the full rendered gallery, omit `--limit` or set a higher value:

```bash
python scripts/build_catalog.py --gallery /home/jtaylor/menagerie_gallery --manifest /home/jtaylor/menagerie_gallery/manifest.tsv --out ./export --jobs 8
```

Full-scale thumbnail generation is intentionally a separate operator-triggered step.

## Data Seam

All catalog access goes through `src/lib/catalog.ts`. Pages and components consume typed records from:

- `getAllModels`
- `getModelBySlug`
- `listModelSlugs`
- `getFunnel`
- `getCatalogIndex`
- `getFeaturedModels`

Swapping Phase 0 manifest scraping for a future pipeline export should require editing only `src/lib/catalog.ts` if the storage location changes. The model schema already includes the Tier-B fields, with honest placeholders such as `forward_validated: false`, `source_license: "unknown"`, `param_count: null`, `tlspec: null`, and exactly one current variant.

## Content-Addressed Assets

Every emitted SVG and WebP thumbnail has an `AssetRef`:

```ts
interface AssetRef {
  url: string;
  sha256: string;
  bytes: number;
}
```

Asset URLs are keyed by digest as `/export/assets/<sha256>.<ext>`. The path, sha256, and byte count are stored together in each model record, so the loaded path is also the integrity identity. Tier-B should reuse this layout rather than reorganizing assets.

## Scope

This repo is the separate web project. It does not modify the TorchLens package repo or the read-only `/home/jtaylor/menagerie_gallery` source gallery.
