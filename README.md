# TorchLens Model Menagerie Scaffold

Local, synthetic-data scaffold for a future TorchLens Model Menagerie website. It proves the Astro static architecture, dark observatory design, searchable gallery, model detail pages, dataset landing page, and 10k-page build path without touching real menagerie data.

## Run

```bash
python scripts/gen_fixture.py
npm install
npm run dev
```

Build the static site:

```bash
npm run build
```

The build copies `fixture/export/v1` into `public/fixture` so local asset URLs like `/fixture/export/v1/assets/svg/...` resolve in dev and `dist`.

## Data Seam

`fixture/export/v1` is the replaceable export directory. The scaffold reads it only through `src/lib/catalog.ts`; components and pages consume typed model objects and do not hardcode model data.

The fixture includes:

- `models.jsonl` and `catalog.csv`
- per-model JSON files in `models/` for lazy model-page loading
- `funnel.json`, `assets_index.json`, `retired_ids.json`, and `export_manifest.json`
- SVG diagrams, PNG thumbnails, and tlspec JSON assets

To swap in the real export later, replace `fixture/export/v1` with the real SEAM export and update `src/lib/catalog.ts` only if the real contract differs.

## Benchmark

Run:

```bash
scripts/benchmark_10k.sh
```

The script generates the 10k fixture, runs `npm run build` including Pagefind, and prints wall-clock time, peak memory when `/usr/bin/time -v` is available, output file count, and `dist` size. Results from the latest local run are recorded in `BENCHMARK.md`.

Cloudflare Pages Free caps a deployment at 20,000 files and 20-minute builds. Cloudflare Pages Pro has a 100k-file limit when `PAGES_WRANGLER_MAJOR_VERSION=4` is set. The benchmark sets `TORCHLENS_SKIP_PUBLIC_FIXTURE=1` so it measures metadata pages plus Pagefind with assets treated as external URLs. The normal 60-model local build mirrors fixture assets for local verification.

## Scope

All catalog content is synthetic. The scaffold does not read the TorchLens repository, does not include real menagerie data, and has no configured remote.
