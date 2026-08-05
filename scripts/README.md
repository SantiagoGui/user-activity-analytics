# scripts/

`analyze.py` was the script run against the real `activities.csv` (fetched from the
CDN URL in `backend/src/config.ts`) to discover the unquoted-JSON comma parsing
hazard documented in `docs/data-source.md`.

It expects `activities.csv` in the current directory (the path is hardcoded) — fetch
the CDN URL, save it there, then run `python analyze.py` from `scripts/`.
