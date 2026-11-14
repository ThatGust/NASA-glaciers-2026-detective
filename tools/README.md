# Verified catalog and offline demonstrations

Checked on 14 November 2026 against NASA POWER monthly point API v2.10.0, using community `AG`. Outputs follow data-contract sections 6 and 9. Only `app/data/` and `app/tools/` were written, plus the requested AI-use log entry. The statistics engine and UI were not edited. No dependencies, commits, or pushes were added.

## Reproduce

From `app/`, with Node.js 24 or later:

```sh
node tools/build_catalog.mjs
node tools/find_demos.mjs
node tools/validate_data.mjs
npm test
```

The first two commands need internet on their first run. Requests are cached under `tools/.cache/` (ignored by Git); remove that directory to request fresh responses. The standalone validator needs no network or cache: it recalculates each demonstration from the original monthly values saved in `demo_checks.json`. Rebuilding may select different examples after NASA revisions or a new complete year becomes available.

## Catalog checks

- **15 usable variables, 30 places:** all 12 requested glaciers and three places each for desert, rainforest, city, coast, ocean, and polar environments. Place IDs retain the existing glacier IDs used by the UI.
- Each of the 16 candidates, including discovered `IMERG_PRECTOT`, was requested **alone** at the published Coropuna coordinate for **1981–1982, 1999–2000, 2001–2002, and 2023–2024**. `catalog_checks.json` retains the URLs, retrieval times, response headers, monthly values, and errors; each catalog variable also has `source_periods`. `POWER` in a header denotes processing, rather than a second observing product.
- `power_definition` is copied verbatim from each [per-parameter endpoint](https://power.larc.nasa.gov/api/system/manager/parameters/T2M), selecting its `MONTHLY` definition. The separate `definition` is a student-facing paraphrase. API units are preserved, including `C`, `1`, and `dimensionless`.
- The supplied [parameter-list URL](https://power.larc.nasa.gov/api/system/manager/parameters?user=x) returned **422**, requiring `community` and `temporal`. The [qualified monthly AG list](https://power.larc.nasa.gov/api/system/manager/parameters?user=x&community=AG&temporal=MONTHLY) returned **1,388 entries** and advertised `IMERG_PRECTOT`.

| Variables | 1981–1982 | 1999–2000 | 2001–2002 | 2023–2024 | Retained product / start |
|---|---|---|---|---|---|
| T2M, TS, PRECTOTCORR, EVLAND, GWETTOP, GWETROOT, SNODP, QV2M | MERRA2 | MERRA2 | MERRA2 | MERRA2 | MERRA2 / 1981 |
| T2M_MAX, T2M_MIN, RH2M, WS2M | MERRA2 + POWER | MERRA2 + POWER | MERRA2 + POWER | MERRA2 + POWER | MERRA2 / 1981 |
| ALLSKY_SFC_SW_DWN, CLOUD_AMT | HTTP 422: unavailable before 1984 | SRB | SYN1DEG | SYN1DEG | SYN1DEG / 2001 |
| AOD_55 | HTTP 422 | Empty sources, all fill | SYN1DEG | SYN1DEG | SYN1DEG / 2001 |
| IMERG_PRECTOT | Empty sources, all fill | Empty sources, all fill | Empty sources, all fill | Empty sources, all fill | Excluded: no usable monthly product |

The [monthly API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/) independently identifies the SRB-to-SYN1DEG boundary as **1 January 2001**, and meteorology as MERRA-2 from **1 January 1981**. Full-record, single-parameter probes confirm the first complete retained year. No usable candidate had a current source beginning after 2005. No earlier SRB values are spliced into demonstrations.

### Ocean masks and request limit

Each candidate was also queried alone for 2023–2024 at the **user-specified open-ocean sampling point (0°, −140°)**. This is a chosen test location, not a claimed coordinate of a named feature.

- `EVLAND`, `GWETROOT`, and `SNODP` return only −999 there and are marked `land_only: true`.
- `GWETTOP` returns **constant 1**, rather than fill. It is also marked land-only because its official definition describes soil; the catalog note explicitly records this exception. Ocean values must not be interpreted as soil moisture.
- Other retained candidates have valid values at this point. This is a single-point check, not a claim of complete global coverage.
- Live requests for **10, 11, 20, 21, and 25 distinct valid parameters succeeded** and returned that many parameter objects. **26 failed with HTTP 422 and an explicit maximum of 25.** The documentation currently says 20, and contract section 7 / the existing engine say 10. The downloader keeps batches of **10**, within all three limits, and groups requests by product/start year to avoid ambiguous source headers. The engine was not changed.

### Coordinate provenance

Every place has a `coord_source` URL. `catalog_checks.json` records the Wikipedia page, revision ID, and primary coordinate returned by its coordinate API. Where that API omitted coordinates, it records the linked Wikidata P625 claim instead (Kilimanjaro and Amazon rainforest). Those locations cite Wikidata directly. Zongo uses **16.25° S, 68.17° W**, published in [WGMS Global Glacier Change Bulletin No. 5, section 4.5, printed page 66](https://user.geo.uzh.ch/mzemp/Docs/WGMS_GGCB_05.pdf). The English Wikipedia glacier page was missing; no substitute valley coordinate was used.

These are published representative point or summit coordinates, not glacier outlines. Salonga National Park represents the Congo rainforest. POWER values describe the source grid cell at a point, not a field observation of a glacier, a whole biome, or a whole city.

## Offline demonstrations

`find_demos.mjs` imports the existing `analyze` and `annualSeriesFromPower` functions from `../engine.js`. It requests all 15 catalog variables at all 30 places through **2025**, the last completed year. It uses the contract's unweighted mean of months 1–12, drops incomplete/fill years, ignores POWER month 13, and never includes the current year. The 90 requests cover **450 variable/place combinations**: **415 analyzed, 13 flat, 18 with fewer than eight usable years, and 4 invalid engine results**.

Selection uses complete retained product windows, with no tuning of start/end years: prefer an opposite-sign precipitation pair with both raw p-values below 0.10; prefer Coropuna air temperature for the confirmed example; choose an unknown case with the smallest positive finite `yearsNeeded`. Each `why` sentence is built from its computed result. These are curated exploratory examples chosen from many tests; their raw p-values are not a correction for that search. They are not the engine's BH-adjusted place-scan verdicts.

| Example | Variable / period | Engine result |
|---|---|---|
| Opposite directions | PRECTOTCORR, 1981–2025 | Coropuna **+0.0813 mm/day per decade**, p = **0.001204**; Salonga **−0.319 mm/day per decade**, p = **0.007678**; both confirmed |
| Confirmed, known since | T2M at Coropuna, 1981–2025 | **+0.237 °C per decade**, p = **2.42 × 10⁻¹³**; known since **2006** |
| Not yet known | AOD_55 at Cape of Good Hope, 2001–2025 | **+0.00338 per decade**, p = **0.1065**; **9 additional years**, conditional on the current slope and AR(1) noise model |

The first pair and confirmed example each bundle 45 annual values per series; the unknown case bundles 25. All four series work without downloading NASA data. The 9-year estimate is a statistical extrapolation, not a guaranteed future confirmation date. “Known since” uses this downloaded record's retrospective, sustained-significance definition; it does not assert that a historical forecast existed in 2006.

## Failures and validation

- Monthly `IMERG_PRECTOT` was advertised but returned only fill and no source, including at the ocean point. It is excluded rather than attributed to an invented source or start year. [NASA's meteorology page](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/) describes usable IMERG as daily UTC; adding a separate daily-to-annual pipeline is outside this task.
- The unmodified engine produced non-finite p-values for **Aletsch / PRECTOTCORR, Arequipa / T2M, Cape Byron / EVLAND, and Pacific / PRECTOTCORR**. They are recorded as `invalid-result` and excluded from selection; no values or results were substituted. This downloader does not fix that engine limitation.
- Wikipedia briefly returned HTTP 429 during individual coordinate requests. The final builder uses one batched coordinate request, cached evidence, and bounded retries. Firecrawl was unavailable because its CLI was unauthenticated; direct public APIs and public source pages were used.
- `validate_data.mjs` parses both deliverables, checks contract fields, unique IDs, environment counts, coordinate bounds/citations, complete requested glacier coverage, finite values, strictly increasing years, equal years/values lengths, current-product start years, and all three demo predicates. It recalculates the annual values from saved original monthly data and verifies exact equality with each bundled series and computed result. Validation passed.
- `npm test` passed **all 10 existing engine tests**. No browser/UI check was performed for this data-only task. Root context PDFs and the root notices file were not regenerated or edited because the write scope permits only these two app directories and one AI-log line; [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) records this lane's sources and terms locally.

## Evidence files

- `catalog_checks.json`: candidate definitions, period/source probes, full-record start probes, ocean tests, coordinates, parameter-list discovery, and request-limit responses.
- `demo_checks.json`: every request URL and source header, all 450 analysis statuses, failures, selected results, and original monthly values for each bundled demo series.
- `.cache/`: original API responses for reproducibility; ignored by Git and not required to play or validate demos.
