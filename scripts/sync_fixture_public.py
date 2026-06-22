#!/usr/bin/env python3
"""Mirror the canonical fixture export into Astro's public directory."""

from __future__ import annotations

import shutil
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "fixture"
TARGET = ROOT / "public" / "fixture"


def sync_fixture() -> None:
    """Copy fixture files into public/ for Astro dev and static builds."""
    if os.environ.get("TORCHLENS_SKIP_PUBLIC_FIXTURE") == "1":
        if TARGET.exists():
            shutil.rmtree(TARGET)
        print("Skipped public fixture sync; assets are treated as external URLs.")
        return
    if not SOURCE.exists():
        return
    if TARGET.exists():
        shutil.rmtree(TARGET)
    shutil.copytree(SOURCE, TARGET)


def main() -> None:
    """Run the fixture sync."""
    sync_fixture()
    if TARGET.exists():
        print(f"Synced {SOURCE.relative_to(ROOT)} to {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
