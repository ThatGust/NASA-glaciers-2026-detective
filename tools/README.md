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


## Lane 2: MODIS and rivers - verified on 14 November 2026

Run these commands from app/ with Node.js 24 or later:

```sh
node tools/fetch_modis.mjs
node tools/fetch_rivers.mjs
node tools/validate_extras.mjs
node tools/validate_extras.mjs --cache
npm test
```

The fetchers reuse getJson from power_api.mjs solely as a URL cache/retry helper; importing it makes no POWER requests. This lane made **no requests to power.larc.nasa.gov**, read no .env file, added no dependency and made no commit. Only the requested new scripts/data, append-only lane notes and AI-log entry were written, plus ignored tools/.cache/ evidence. Existing engine, UI, catalog, demo and other agents' working changes were left untouched. No git pull was performed because it could change protected files in the shared, dirty working tree.

### MODIS result

- **8 nonconstant NPP series, 25 years each (2001-2025), 200 annual values.** Kept IDs: chimborazo, zongo, kilimanjaro, puncak-jaya, congo, daintree, cape_good_hope, cape_horn.
- All **27 non-ocean catalog places** were attempted. Of these, 17 returned only nonvegetated land-cover/fill codes and two had no geographic coverage. No constant or short series is bundled.
- The live [ORNL products list](https://modis.ornl.gov/rst/api/v1/products) omits **MOD16A3GF**, so the conditional ET variable is not included. The script supports it if the service adds it; its official annual ET band is ET_500m, raw range 0-65500, scale 0.1, kg/m2/yr, excluding codes above the valid range.
- [MOD17A3HGF](https://doi.org/10.5067/MODIS/MOD17A3HGF.061), band Npp_500m: native point pixel, raw range -30000 through 32700 inclusive, scale 0.0001, output kg C/m2/yr. The [NASA MOD17 guide, section 4.2](https://modis-land.gsfc.nasa.gov/pdf/MOD17C61UsersGuideV11Mar112021.pdf) identifies nonvegetated codes 32761-32767; all are excluded. Negative valid NPP is retained. Annual composite dates come from the API; requests contain at most ten dates, and current/incomplete years are excluded.

| Response at the catalog point | Place IDs |
|---|---|
| 32764 (25 years) | coropuna, quelccaya, perito-moreno, columbia, jakobshavn, aletsch |
| 32765 (25 years) | huascaran, khumbu, gobi, atacama, sahara |
| 32766 (25 years) | amazon, cape_byron, north_pole |
| 32762 (25 years) | arequipa, tokyo, london |
| HTTP 400: no geographic coverage | vostok, south_pole |

Codes observed here are 32762 (urban), 32764 (perennial snow/ice), 32765 (barren/sparse vegetation) and 32766 (water). A named glacier point returning valid productivity is a MODIS model/land-cover pixel result, **not evidence that glacier ice grows plants**. Likewise, the supplied Amazon rainforest point returning water is not a statement about the whole rainforest. All existing coordinates and their citations are preserved; no replacement points or spatial averages were invented.

### River result and limitations

**17 cited locations, 28 complete calendar years each (1997-2024), 476 annual means.** The request spans 1984-2025, but this live **consolidated_v4** response contains no finite values for 1984-1996 and only 151 valid days in 2025. These entire years are excluded. The advertised 1984 start in the [Flood API documentation](https://open-meteo.com/en/docs/flood-api) therefore does not describe the usable consolidated_v4 record returned here. No seamless forecast values fill those gaps. Calendar days are used directly in GMT; engine.annualFromDaily is intentionally not used because it interprets timestamps as the END of a 24-hour window and shifts them back one day.

The series are daily arithmetic means over complete calendar years, including leap days. Every original day must be present exactly once and finite/nonnegative. analyze is imported from the existing engine for verification; no statistics implementation was copied or edited. GloFAS is a Copernicus model, **not NASA data and not a gauge observation**.

All selected coordinates cite a Wikipedia revision, GeoNames RDF or published GRDC station catalogue/report. Ten rivers use cited upstream gauges after failed or implausible mouth probes; attempted_mouth retains those original coordinates, snapped cells and outcomes. Remaining mouths are used as published. Chili uses its GeoNames endpoint near the Yura confluence at Palca, where the river becomes Vitor, rather than mislabelling the Quilca ocean mouth. Station-coordinate facts were transcribed from the cited sources checked on 14 November 2026; the ignored GTN-R workbook preserves that catalogue snapshot. In particular, its Huatiapa row has an obviously incompatible latitude (-10.00789444); that location was **not used** for Majes-Camana.

Every place has snapped coordinates, a published mean/source, reference_note and quality flags. The long-term model mean is weighted by days across retained years; published km3/year values are converted using a 365.25-day unit year and ft3/s with the exact cubic-foot conversion. A ratio outside **0.5-2** is an explicitly labelled screening heuristic. It cannot establish accuracy, and reference periods, delta branches, upstream/downstream sites, abstraction and regulation may differ.

**Six mean mismatches are retained and flagged, not hidden or replaced:**

| River / selected site | Model mean (m3/s) | Published reference (m3/s) | Interpretation |
|---|---:|---:|---|
| Amazon River (Obidos - Porto gauge) | 1.192 | [172,100](https://en.wikipedia.org/w/index.php?title=Amazon_River&oldid=1383931063) | Published reference is for this named station; historical periods differ from the model record. |
| Mississippi River (Vicksburg gauge) | 0.753 | [20,911.991](https://en.wikipedia.org/w/index.php?title=Mississippi_River&oldid=1385369731) | Published reference is for this named station; historical periods differ from the model record. |
| Mekong River (Mukdahan gauge) | 6,394.405 | [16,000](https://en.wikipedia.org/w/index.php?title=Mekong&oldid=1383712959) | Published reference is downstream river/delta flow, not this upstream gauge; comparisons are approximate. |
| Rhine River (Rees gauge) | 0.098 | [2,900](https://en.wikipedia.org/w/index.php?title=Rhine&oldid=1383853229) | Published reference is downstream river/delta flow, not this upstream gauge; comparisons are approximate. |
| Majes-Camana River (mouth) | 0.096 | [68.03](https://repositorio.promperu.gob.pe/server/api/core/bitstreams/e0d56ca0-5150-4543-84c9-94c2b7033b03/content) | PROMPERU regional export plan, page 87, reports a Camana river annual mean of 68.03 m3/s; a basin reference, not a colocated or period-matched gauge validation. |
| Chili River (terminus near Palca, Peru) | 62.252 | [15.6](https://app.ingemmet.gob.pe/biblioteca/pdf/CPG15-029.pdf) | INGEMMET (2010) reports 15.60 m3/s annual mean at upstream Charcani, citing ANA (2010); not a colocated or period-matched validation. |

Amazon, Mississippi, Rhine and Majes-Camana have implausibly tiny flows for the intended rivers, even at the cited coordinates: the model cell evidently does not represent the intended main channel. **Do not present these as validated whole-river trends.** Mekong and Chili also fail the screen but use references from different river sections. The eleven remaining locations are within the broad ratio screen, which is not proof of correctness; Lena, Mackenzie and Parana still carry reference-location warnings. No coordinate offsets were tuned to match a reference discharge, and no river values were substituted with published numbers.

The free [Open-Meteo API terms](https://open-meteo.com/en/terms) permit non-commercial use within its rate limits; [CC BY 4.0 attribution rules](https://open-meteo.com/en/licence) require credit, a licence link, disclosure of modifications and an **adjacent link to Open-Meteo wherever the data are displayed**. rivers.json.terms preserves those requirements and Copernicus/GloFAS attribution. The GloFAS-specific licence PDF linked by Open-Meteo returned 404; the accessible API data licence is recorded explicitly. No UI integration was made; a later integrator must render both attribution and quality warnings.

### Reproducibility, failures and timings

- Successful original JSON response bodies, URLs and retrieval timestamps are stored by the existing SHA-256 URL cache under tools/.cache/. The GeoNames RDF and original GRDC catalogue/report are also cached. Reruns read these responses and resume any unfinished request; remove only the relevant cached response if a fresh retrieval is needed. The final modis_report.json and rivers_report.json contain coverage, exclusions, request provenance, timings and engine results. modis_initial_report.json preserves the first acquisition pass.
- ORNL returned intermittent HTTP 502s and timeouts. The existing helper retries up to four attempts with exponential backoff and a 90-second per-request timeout; download workers are limited to three. The first pass treated the service's explicit no-data HTTP 400 responses at South Pole and Vostok as errors; the fetcher now distinguishes those geographic exclusions from transient failures, and the cache-only rebuild succeeded.
- The separate, parallel river probes briefly hit HTTP 429; final downloads are sequential with a ten-second pause after uncached requests and reuse the same retry helper. No error response was converted to a number. Wikipedia/GeoNames coordinate evidence and published-mean facts remain separate from the model values.
- **Measured MODIS acquisition pass: 1345.5 s (22.4 min)**; successful cached rebuild: 0.075 s. The first successful 17-river build took **178.7 s**, after earlier cached probes; the final cache-only rebuild took **0.709 s**. These are process timings, not a controlled cold-network benchmark.
- **Validation passed:** node tools/validate_extras.mjs --cache checked both JSON files, 25 cited series, equal lengths, strictly increasing years, finite values, units, organization labels, the six mismatch flags, all non-ocean MODIS attempts, exact reproduction from cached raw values and finite results from analyze. Synthetic self-checks cover NPP/ET fill and scale, constant series, duplicate years/days, complete leap years and missing days. The default validator also works without the cache.
- **npm test: all 19 tests passed.** No browser/UI check, field calibration or period-matched gauge validation was performed. UI integration, root context/PDF regeneration and root source notices remain outside this write scope; this lane's source/licence details are appended to tools/THIRD_PARTY_NOTICES.md.
