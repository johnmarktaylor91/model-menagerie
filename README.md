# TorchLens Model Menagerie Web

Astro static site for the public Model Menagerie gallery. The repo commits lightweight catalog data in `site-data/` and serves content-addressed diagram assets from Cloudflare R2.

## Run

Install dependencies and run the site:

```bash
npm install
npm run dev
```

Asset URLs are composed from `PUBLIC_R2_BASE`. If it is unset, the site falls back to `/assets/<sha256>.<ext>` for local preview. To preview locally without R2, copy assets from a generated export into Astro public assets:

```bash
mkdir -p public/assets
cp -a export/assets/. public/assets/
```

Build the static site and Pagefind index:

```bash
PUBLIC_R2_BASE=https://<bucket-public-url> npm run build
PUBLIC_R2_BASE=https://<bucket-public-url> npx astro check
```

## Deploy

End-to-end deployment flow:

```bash
python scripts/build_catalog.py \
  --gallery /home/jtaylor/menagerie_gallery \
  --manifest /home/jtaylor/menagerie_gallery/manifest.tsv \
  --out ./export \
  --jobs 8
python scripts/sync_site_data.py --export-dir ./export --site-data ./site-data
git add site-data
git commit -m "feat: update catalog data"
scripts/upload_assets.sh
git push
```

Cloudflare Pages should be connected to the GitHub repo and configured with:

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `PUBLIC_R2_BASE=<bucket public URL>`
- Environment variable: `PAGES_WRANGLER_MAJOR_VERSION=4`

R2 must expose the uploaded object keys through the public URL used by `PUBLIC_R2_BASE`. Configure R2 CORS to allow `GET` and `HEAD` from any origin.

`scripts/upload_assets.sh` uses `rclone` and is idempotent for content-addressed assets. Either configure an rclone S3 remote named `r2` pointed at the target bucket, or set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET`.

For a small local export refresh, keep using `--limit` on `build_catalog.py`, then run `sync_site_data.py`:

```bash
python scripts/build_catalog.py --gallery /home/jtaylor/menagerie_gallery --manifest /home/jtaylor/menagerie_gallery/manifest.tsv --out ./export --limit 600
python scripts/sync_site_data.py --export-dir ./export --site-data ./site-data
npm run build
```

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

Only aggregate text data is committed:

- `site-data/models.jsonl`
- `site-data/facets.json`
- `site-data/funnel.json`
- `site-data/export_manifest.json`
- `site-data/catalog.csv`

Do not commit `export/models/*.json` or `export/assets/`.

Use `--limit 600` for a fast local preview. To scale to the full rendered gallery, omit `--limit` or set a higher value:

```bash
python scripts/build_catalog.py --gallery /home/jtaylor/menagerie_gallery --manifest /home/jtaylor/menagerie_gallery/manifest.tsv --out ./export --jobs 8
```

Full-scale thumbnail generation is intentionally a separate operator-triggered step.

## Data Loading

All catalog access goes through `src/lib/catalog.ts`, which reads only committed `site-data/` files. Pages and components consume typed records from:

- `getAllModels`
- `getModelBySlug`
- `listModelSlugs`
- `getFunnel`
- `getCatalogIndex`
- `getFeaturedModels`

`models.jsonl` is loaded once and indexed in memory by slug. The model schema already includes the Tier-B fields, with honest placeholders such as `forward_validated: false`, `source_license: "unknown"`, `param_count: null`, `tlspec: null`, and exactly one current variant.

## Content-Addressed Assets

Every emitted SVG and WebP thumbnail has an `AssetRef`:

```ts
interface AssetRef {
  url: string;
  sha256: string;
  bytes: number;
}
```

Generated asset references preserve the digest, byte count, and generated path in the source data. At build time, the site takes the `<sha256>.<ext>` basename and composes a public URL as `${PUBLIC_R2_BASE}/<sha256>.<ext>`. If `PUBLIC_R2_BASE` is unset, URLs fall back to `/assets/<sha256>.<ext>` for local preview.

## Scope

This repo is the separate web project. It does not modify the TorchLens package repo or the read-only `/home/jtaylor/menagerie_gallery` source gallery.
