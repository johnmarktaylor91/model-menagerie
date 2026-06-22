# 10k Benchmark

Command:

```bash
scripts/benchmark_10k.sh
```

Latest local result, run on 2026-06-22:

| Metric | Result |
| --- | ---: |
| Fixture size | 10,000 models |
| Wall-clock build time | 106 seconds |
| Peak memory | 698,596 KB |
| Total `dist` file count | 20,144 files |
| `dist` size | 209 MB |
| Astro pages built | 10,005 pages |
| Pagefind indexed pages | 10,005 pages |
| Pagefind files | 10,096 files |

The benchmark intentionally measures the static metadata-page build plus Pagefind indexing with `TORCHLENS_SKIP_PUBLIC_FIXTURE=1`, so generated fixture assets are treated as external URLs and are not copied into `dist`. If the 10k build exceeds local memory or time limits, the first mitigation is to keep generated assets outside the Pages deployment and publish only metadata pages plus search artifacts.

Readout: the architecture holds for local 10k static generation on this machine: build time is well under 15 minutes and peak memory is under 1 GB. The output narrowly exceeds Cloudflare Pages Free's 20,000-file cap because Pagefind emits roughly one index fragment per page. Mitigation options are to deploy on Pages Pro with `PAGES_WRANGLER_MAJOR_VERSION=4`, reduce Pagefind shard/file output if supported by the selected Pagefind version, split the catalog into multiple deployments, or move search to a hosted/external index while keeping the static pages.
