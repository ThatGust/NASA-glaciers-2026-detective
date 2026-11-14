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

## Earthdata lane 3 — atmosphere and water (14 November 2026)

`tools/fetch_earthdata.mjs` builds `data/grid_atmos.json`: **12 NASA variables, 2,592 cells in exactly `grid.json` order, eight regions, 5,163,702 bytes (5.16 MB)**. All twelve `cellSeries` variables fit under 8 MB. Existing app files were not edited by this lane; integration is a separate task. Source and permission details are appended to `tools/THIRD_PARTY_NOTICES.md`.

From `app/`, using the existing `app/.env.earthdata` file with `EARTHDATA_USER` and `EARTHDATA_PASSWORD`:

```sh
node tools/fetch_earthdata.mjs --self-test
node tools/fetch_earthdata.mjs --sample
node tools/fetch_earthdata.mjs --omi
node tools/fetch_earthdata.mjs
node tools/fetch_earthdata.mjs --validate
npm test
```

Authentication is performed only inside the script. Credentials and authentication responses are never logged or cached; the bearer token stays in memory. Raw CMR, DDS, DAS, coordinate and monthly ASCII responses use SHA-256 URL filenames under the already ignored `tools/.cache/earthdata/`. Re-running resumes those responses; `report.json` there records timings, failures, coverage and global slopes. Cache entries are snapshots: revisions require removing the relevant cached response or deliberately refreshing this lane's cache. Validation and self-tests need no login/network. `--sample` checks the first January of each product. There are no added dependencies or commits.

### Acquisition, geometry and processing

- **MERRA-2 M2TMNXSLV 5.12.4:** 540 months, January 1981–December 2025; T850, T500, T250, TO3 and TQV. Read coordinate variables verify latitude `[5:10:355]` and longitude **`[4:8:572]`**. Longitude index 572, not 571, is 177.5 degrees east; the latter endpoint would lose the last column.
- **AIRS3STM 7.0:** 276 months, January 2003–December 2025. AIRS-only ascending `_A` fields are used throughout: `Temperature_A`, `TotO3_A`, `TotH2OVap_A`, plus their counts. The coordinate arrays run 87.5 to -87.5 degrees after `[2:5:177][2:5:357]` selection and are reordered to the existing south-to-north grid. `StdPressureLev_ascending` verifies zero-based indices **2 = 850, 5 = 500, 8 = 250 hPa**; temperatures use `[2:3:5]`. T250_AIRS was not requested and is not added. HDF field attributes omit units; the [AIRS V7 L3 User Guide, Table 1 and section 2.5.1](https://docserver.gesdisc.eosdis.nasa.gov/public/project/AIRS/V7_L3_User_Guide.pdf) supplies them. Counts must be positive; no ascending/descending or AIRS/AMSU splice is made.
- **GLDAS_NOAH10_M 2.1:** 312 months, January 2000–December 2025, with `[2:5:147][2:5:357]`. Read coordinates verify centers -57.5 to 87.5 degrees; other southern rows and all `grid.json` ocean cells stay null. The file has 614 usable land sampling points. No version 2.0 values are used.
- Each month uses **one combined strided global data request per product**, never a point-request loop. Three year workers each await one request at a time. Successful records contain **1,128 monthly subsets**; metadata/coordinate probes are additional. The retired hydro1/goldsmr4 endpoints are not used.
- For each cell/variable, a year is the unweighted mean of twelve valid months. Missing requests, non-finite data, declared fill (-9999 or MERRA-2's approximately 1e15), or AIRS zero counts invalidate that cell-year. Fill is tested before conversion, and either missing runoff component invalidates their sum. Negative evaporation is retained. No gaps are interpolated. Current-year 2026 data are excluded.
- Temperature is **K - 273.15**, ozone stays **Dobson units (DU)**, and column water stays **kg/m2**. For GLDAS, **RUNOFF = (Qs_acc + Qsb_acc) x 8 mm/day**, **EVAP = Evap_tavg x 86400 mm/day**, while **SOILMOI retains kg/m2**. Monthly `_acc` fields average three-hour accumulations; they are not monthly totals. See the [GLDAS-2 README, sections 3.3 and 3.5(5–6), printed pages 21–25](https://docserver.gesdisc.eosdis.nasa.gov/public/project/hydrology/README_GLDAS2.pdf).
- `analyze` and per-variable, across-cell `benjaminiHochberg` are imported from the unedited engine. Eligibility and verdict thresholds match `build_grid.mjs`: at least eight annual observations, non-flat record, q < .05 confirmed / q < .10 likely / otherwise unknown. Calculations precede rounding; slopes use four significant digits, q three. The unrounded q sets the verdict, so rounding can place an exported q exactly on a threshold.
- `areaWeightedMean` uses the builder's eight region definitions, existing ocean flags and cosine-latitude weights, retaining matching longest records within each region. All global records span their full product windows here. Flat cells are excluded from regional means as in the builder; this excludes 20 constant SOILMOI cells. GLDAS ocean/Antarctic series are absent rather than zero.
- Compact `cellSeries` stores three-significant-digit values only for cells with every year in the declared `[first,last]` window; other cells are null because value-only arrays cannot identify skipped years. Trends can still use complete annual observations in a partly missing record. Such trend cells number **8 T850, 142 T850_AIRS, 25 TO3_AIRS and 128 TQV_AIRS**. The existing engine treats successive retained observations as successive lags in its autocorrelation correction; gapped-cell uncertainty has that limitation. Regional curves use fixed matching records.

### Measured run and checks

The successful acquisition/build pass took **769.019 s (12.8 minutes)**, including earlier cached probes: MERRA-2 **346.62 s**, AIRS **182.44 s**, GLDAS **190.83 s**, with analysis/setup in the remaining time. This is not a controlled cold-cache benchmark. The final warm-cache build took **32.133 s** (monthly processing 2.899 / 1.707 / 0.816 s), with the same output size and all twelve global slopes. **No terminal monthly request failures** occurred in either successful pass. An earlier run was interrupted after a parser assertion: Hyrax encodes latitude in row labels rather than a separate coordinate array. The parser was corrected, tested and successfully resumed from cached raw responses; no output from that interrupted attempt was used.

**Validation passed:** all trend arrays and present cell-series arrays have 2,592 entries; values/q are finite; years strictly increase; annual/value lengths agree; source coordinates map exactly to the existing cell order; GLDAS masks hold; all eight region containers exist; JSON is below 8,000,000 bytes. Synthetic checks cover DAP Grid/HDF rows, malformed numbers, temperature-independent water conversions, runoff fill propagation, ocean/southern masks and missing-month annual rejection. **All 19 `npm test` tests passed.**

### Global-mean sanity checks

These are Sen slopes of the engine's area-weighted regional curves, not means of cell slopes. “Global” means the retained sampling footprint; GLDAS means land only. Counts below exclude incomplete and flat regional members.

| Variable | Years | Global-mean change per decade | Regional cells |
|---|---|---:|---:|
| T850 | 1981–2025 | +0.2091 C | 2334 |
| T500 | 1981–2025 | +0.2384 C | 2592 |
| T250 | 1981–2025 | +0.2206 C | 2592 |
| TO3 | 1981–2025 | -0.4054 DU | 2592 |
| TQV | 1981–2025 | +0.2573 kg/m2 | 2592 |
| T850_AIRS | 2003–2025 | +0.1511 C | 2230 |
| T500_AIRS | 2003–2025 | +0.04069 C | 2592 |
| TO3_AIRS | 2003–2025 | +0.2952 DU | 2551 |
| TQV_AIRS | 2003–2025 | +0.1402 kg/m2 | 2464 |
| RUNOFF | 2000–2025 | -0.09633 mm/day | 614 |
| EVAP | 2000–2025 | +0.07260 mm/day | 614 |
| SOILMOI | 2000–2025 | -0.3956 kg/m2 | 594 |

Temperature signs agree with [NASA/JPL's AIRS lower-troposphere warming visualization](https://airs.jpl.nasa.gov/resources/232/airs-temperature-anomaly-trends-in-the-lower-troposphere-and-upper-stratosphere-2002-2020/). [Steiner et al. (2020), abstract](https://doi.org/10.1175/JCLI-D-19-0998.1) reports approximately 0.25–0.35 K/decade tropospheric warming, with different periods, layers and sampling. This is a scale comparison, not a matching benchmark. **AIRS is substantially weaker here:** over the common 2003–2025 period MERRA-2 gives +0.2740 C/decade at 850 hPa and +0.3090 at 500 hPa, versus AIRS +0.1511 and +0.04069. These satellite witnesses check the same quantities but do not establish quantitative agreement or full statistical independence. The source of the magnitude difference was not resolved; no drift correction or tuning was applied. AIRS sampling/quality caveats remain applicable.

Ozone needs extra caution: [Wargan et al. (2017)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5842360/) documents MERRA-2's October 2004 switch from SBUV to OMI/MLS. The 1981–2025 slope crosses that observing-system change and is not a clean recovery estimate. On 2003–2025 MERRA-2 gives +2.001 DU/decade, while AIRS gives +0.2952, with raw global p = 0.673 (unknown). AIRS water vapor likewise has raw global p = 0.113 (unknown); its positive sign alone does not corroborate MERRA-2. Increasing vapor has the expected direction from [NASA's water-vapor feedback explanation](https://science.nasa.gov/earth/climate-change/steamy-relationships-how-atmospheric-water-vapor-amplifies-earths-greenhouse-effect/), without validating this record's magnitude. These regional p-values are separate from cell BH verdicts. No like-for-like published global benchmark was established for the three GLDAS sampled-land slopes; they are model results, not validated global observations.

**OMI search:** the [cached CMR query](https://cmr.earthdata.nasa.gov/search/collections.json?keyword=OMI%20ozone&page_size=200) returned 175 collections. No monthly OMI L3 total-column grid matched. `TrCO3_Monthly_OMIMLS` is tropospheric ozone; `OMTO3d`, `OMTO3e` and `OMDOAO3e` are daily; `MSO3L3zm5` is a merged multi-satellite zonal mean. None is substituted for the requested product, so **OMI_O3 is omitted**. A newly appearing monthly collection makes the script stop for an explicit adapter rather than silently ignore it.

No browser/UI integration, external field calibration, full-resolution global averaging or independent magnitude validation was performed. Root context/PDF updates are outside this lane's explicit write scope; the requested single AI-use log row is appended separately.

## Places, facts and satellite images (data lane 4)

Completed 14 November 2026: **18 additions, 48 catalog places, 65 fact records and 65 satellite images**. All original places/IDs are preserved; river facts live only in data/place_facts.json.

| Environment | New places |
|---|---|
| lake | Lake Titicaca; Aral Sea; Lake Chad |
| volcano | El Misti (Arequipa); Mount Etna; Mauna Loa |
| savanna | Serengeti; Cerrado; Sahel |
| tundra | Yamal Peninsula; Alaska North Slope; Baffin Island |
| coral_reef | Great Barrier Reef at Davies Reef; Glover's Reef; Elphinstone Reef |
| wetland | Pantanal; Sundarbans; Okavango Delta |

- Coordinate evidence for additions is embedded in catalog.json. Davies Reef uses the [published reef coordinate](https://pmc.ncbi.nlm.nih.gov/articles/PMC5971101/). Original provenance files and demos.json were preserved.
- Facts use **NASA POWER grid elevation**, 1991–2020 means of annual series, and engine.analyze T2M trends for 1981–2025. Contextual descriptions have at most 14 words and cite Wikipedia revisions (CC BY-SA 4.0); Zongo cites Huayna Potosí and Chili cites Arequipa. All 30 original POWER records were reused; 35 new combined records were acquired. Uncached POWER requests and retries are serialized at least 2.1 seconds apart, with HTTP 429 backoff.
- **Images total 1,661,330 bytes (1.66 MB)**; largest **54,454 bytes**. All are 480×320 JPEGs below 70,000 bytes. [Credits](../img/places/CREDITS.md) record source URLs, layer, date, bounds, projection and the cloud heuristic. The [single contact sheet](.cache/contact_sheet.html) and selection manifest are Git-ignored. These are real NASA Worldview/GIBS images; no image-generation model was used.
- Clear daily views could not be established for every feature. Historical composites are used for quelccaya, zongo, chimborazo, perito-moreno, columbia, jakobshavn, aletsch, khumbu, puncak-jaya, congo, london, cape_horn, south_pole, vostok, congo_river, niger_river, yenisei_river and ganges_river. They illustrate places, not current glacier outlines. **Elphinstone remains near the MODIS resolution limit** after unsuccessful HLS selection attempts. Arctic cloud/ice separation remains unverified.
- **Integrator review:** replaced only the 20 named images; all **45 unlisted image hashes stayed unchanged**. Non-polar bounds were retained; the three coast/reef cases tried 12 more date/layer combinations. North Pole uses EPSG:3413 / VIIRS on 5 August 2025; South Pole and Vostok use EPSG:3031 / Blue Marble Next Generation. Credits and the contact sheet were regenerated.
- Passed: validate_data.mjs --cache (including exact reproduction of all 65 facts), fetch_place_images.mjs --check (dimensions/size/decode/projection), validate_extras.mjs (25 existing series), and all **19 npm tests**. The MODIS cache-coverage audit was not expanded to new places. UI integration was not tested. The protected Earthdata files/cache and .env files were not touched; UI and engine files were not edited. No commits or pushes were made by this agent.

Reproduce from app/ (Node.js 24+ and existing Python/Pillow/pyproj):

~~~sh
node tools/build_catalog.mjs --places-only
node tools/place_facts.mjs
node tools/fetch_place_images.mjs
node tools/fetch_place_images.mjs --review-fixes
node tools/validate_data.mjs --cache
node tools/fetch_place_images.mjs --check
node tools/validate_extras.mjs
npm test
~~~

The review command needs the ignored manifest from the full image command. NASA revisions/network availability may change selections; composite TIME is not a single acquisition date. Offline libraries: [Pillow 11.1.0, MIT-CMU](https://github.com/python-pillow/Pillow/blob/11.1.0/LICENSE) and [pyproj 3.7.2, MIT](https://github.com/pyproj4/pyproj/blob/3.7.2/LICENSE); no dependencies were added.

## Lane 5A: defined place universes (14 November 2026)

Acquisition in progress. Coverage applies to the **documented Wikidata query inventories**, not all places on Earth. `data/coverage.json` records each exact query, its retrieval time, the full member Q-IDs, N, selected members and percentage. Totals sum kind memberships and can count one feature in several universes. The pitch must retain this scope when quoting coverage.

```sh
node tools/build_universes.mjs
node tools/build_universes.mjs --select
node tools/place_facts.mjs
node tools/fetch_place_images.mjs
node tools/validate_data.mjs --cache
node tools/validate_extras.mjs
npm test
```

The universe builder uses a descriptive nonpersonal User-Agent, serialized requests at least 6.5 seconds apart, bounded retries and `Retry-After`. Exact responses and per-entity checkpoints live in `tools/.cache/wikidata/`. `--cache-only` forbids uncached Wikidata requests. The initial catalog/river baseline is saved there once. All existing IDs and sampling coordinates are preserved. Existing coordinate citations remain authoritative; new non-river points cite Wikidata P625, while rivers require a published mouth coordinate or an existing cited gauge. Existing rivers that the UI appends are counted separately to avoid duplicate markers; previously hidden rivers added to the catalog expose only NASA climate sampling, not an unvalidated discharge series.

Selection prioritizes published size or sitelink count, every represented continent, South American members, and the named Peruvian priorities plus Lake Baikal. Points within 5 km of an existing point are rejected and recorded, rather than shifted. Country and ISO codes come from current Wikidata country claims; continent uses the feature's P30, then country P30. Transcontinental countries can supply multiple continents. Size fields retain the largest nondeprecated, current-rank recorded value; these inventories mix measurement/census dates and administrative boundaries and must not be presented as uniform current surveys.

Facts checkpoint after each new place and reuse complete saved climate facts. New climate calls request only T2M and PRECTOTCORR, are serialized at least 2.1 seconds apart including retries, and stop uncached acquisition after sustained service failure. Explicit nulls carry a pending/unavailable status and reason; rerunning resumes acquisition. New descriptions are short Wikidata descriptions or simple type/country statements, linked to entity revisions. They are context, not NASA measurements.

Sources/licenses: [Wikidata CC0](https://www.wikidata.org/wiki/Wikidata:Licensing); existing pinned Wikipedia paraphrases remain [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); [NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/); real NASA Worldview/GIBS imagery credited in [CREDITS.md](../img/places/CREDITS.md). JPEGs are 360×240, at most 25,000 bytes, with seasonal cloud screening, Blue Marble Next Generation fallback and polar projections near the poles. Existing reviewed images were resized/recompressed from their original snapshots. No image was generated by AI.

AI-use record: Codex implemented and checked this data acquisition/selection pipeline, source-linked context and this report. The statistical engine, UI, demos, ground-photo folder and root context files are outside this lane's write scope. No .env files were read, dependencies added, commits made or pushes performed.


## Ground photographs (data lane 5B)

Initial pass on 14 November 2026: **59 places with photos; 6 without, out of 65 distinct catalog/river places**. **4 distinct candidate files rejected by license** (GFDL-only or FAL). Final JPEGs total **2,009,694 bytes**; largest **39,837 bytes**. Final expanded-catalog pass is **pending lane 5A's `data/catalog.ready` marker**; the downloader remains active and polls every 60 seconds.

Currently omitted: `zongo`, `pacific`, `atlantic`, `yamal`, `alaska_north_slope`, `chili`. No accepted, sufficiently attributable ground/aerial photograph of these actual places was established through their Wikidata/Wikipedia references. Missing entries are omitted from the manifest; no generic or synthetic substitute is used.

[Photo manifest](../data/place_photos.json) contains each relative file path, original title, Commons file page, plain-text author, license, license URL and one-line credit. The downloader prefers non-deprecated Wikidata P18 claims (preferred rank first), then Wikipedia's lead image, then other images on that same article that identify the place in Commons metadata. It uses catalog Wikidata IDs when available; otherwise Wikipedia pageprops resolves the item. Cited facts/published Wikipedia references provide a fallback when coordinates cite a gauge sheet or another non-Wikipedia source. Parent mountain/city photographs must explicitly identify Zongo/Chili to qualify.

Only public domain, CC0, CC BY and CC BY-SA are accepted, with their actual versions/jurisdictions retained. Reject insufficient width, non-photographic file types, maps, flags, logos, diagrams, artwork, satellite/rendered views and unsuitable subjects; known misleading lead photographs were excluded after contact-sheet review. Final copies are 480-pixel-wide JPEGs, at most 40,000 bytes each. Commons metadata and visual review establish contextual suitability, not current conditions or a measured trend. Follow the [photo attribution policy](THIRD_PARTY_NOTICES.md#lane-5b-wikimedia-commons-place-photographs), including the original title/source link, license link and disclosure of resizing/recompression.

Run from `app/`, using Node.js with built-in fetch and the existing Python/Pillow installation (no new dependency):

~~~sh
node tools/fetch_place_photos.mjs --self-test
node tools/fetch_place_photos.mjs
node tools/fetch_place_photos.mjs --validate
npm test
~~~

The full command processes current places first, waits for the marker, re-reads the final catalog and processes additions/changed records. API responses and thumbnail downloads are cached by URL under `tools/.cache/commons/`; state and per-candidate rejection reasons support restarts. Completed valid-sized outputs are reused; interrupted writes are staged inside the cache and renamed into place. Use one downloader instance. Requests are serialized at least 1.05 seconds apart (below two per second), with a descriptive non-personal User-Agent, retries, Retry-After handling and HTTP 429 backoff. No secrets or .env files are needed or read. The final command writes a machine-readable coverage report to `tools/.cache/commons/report.json`.

Passed for the initial set: in-script license/metadata/source self-checks, `--validate`, a separate Pillow decode/480-pixel width check of every listed JPEG, contact-sheet review, and all **19 npm tests**. UI integration was not tested. No commits or pushes were made.

AI-use record, 14 November 2026: Codex implemented the downloader/self-checks, retrieved and screened Wikimedia sources, reviewed contact sheets, generated the manifest/JPEG derivatives, ran validation/tests and documented attribution. No image-generation model was used. The root AI-use log and context/PDF files are outside this lane's explicit write scope.
