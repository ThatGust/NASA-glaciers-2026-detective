# Signal or Noise — implemented use cases

Source review: **14 November 2026**. This is an as-built model of the browser application, for design review and public project documentation. It describes existing behavior, including its limits; it is not a roadmap or a claim that every deployment has every integration enabled.

## Diagrams and rendering

| Diagram | Editable source | Vector | 1200 px image |
|---|---|---|---|
| Public project-page story | [PlantUML](page_overview.puml) | [SVG](page_overview.svg) | [PNG](page_overview.png) |
| Technical platform overview | [PlantUML](00_overview.puml) | [SVG](00_overview.svg) | [PNG](00_overview.png) |
| Explore the Earth | [PlantUML](01_explore_earth.puml) | [SVG](01_explore_earth.svg) | [PNG](01_explore_earth.png) |
| Investigate a case | [PlantUML](02_investigate_case.puml) | [SVG](02_investigate_case.svg) | [PNG](02_investigate_case.png) |
| Global monitor | [PlantUML](03_global_monitor.puml) | [SVG](03_global_monitor.svg) | [PNG](03_global_monitor.png) |
| Moon | [PlantUML](04_moon.puml) | [SVG](04_moon.svg) | [PNG](04_moon.png) |
| Game and classroom | [PlantUML](05_game_classroom.puml) | [SVG](05_game_classroom.svg) | [PNG](05_game_classroom.png) |

For a public project page, use **page_overview**, the simplified learning journey, with this caption: **“Explore Earth and Moon, test evidence, and play a five-case classroom mission. NASA data power the investigations; a shared classroom leaderboard requires optional Firebase configuration.”** Link the detailed diagrams for methodology and limits. The public story has no use-case IDs or UML relationship stereotypes. The technical overview retains those for review; both omit optional clue-level detail.

Java 21.0.7 and Graphviz were available locally, but a PlantUML command/JAR was not found in the checked app and tool locations. The task-authorized **public Kroki service** rendered all seven diagrams. Only the standalone diagram text was submitted, with no app source, credentials or personal data. [render_diagrams.mjs](render_diagrams.mjs) caches replies under the ignored `.render_cache/`, produces 1200 px wide SVG/PNG pairs, and records source hashes, dimensions and scaled text sizes in [render_manifest.json](render_manifest.json). Re-render with `node docs/diagrams/render_diagrams.mjs` from `app/`. The UML syntax and POST rendering method follow the official [PlantUML use-case documentation](https://plantuml.com/use-case-diagram) and [Kroki usage documentation](https://docs.kroki.io/kroki/setup/usage/).

## Scope, actors and notation

- **Explorer:** a student or curious citizen investigating alone. **Classroom player:** an anonymous numbered detective who joins a room and plays the mission. **Teacher/host:** the person creating a room and displaying its leaderboard. These are participation roles, not enforced account permissions. A player or teacher can also use Explorer controls.
- **NASA POWER API:** live point-series retrieval when a matching bundled series is unavailable; Scan uses it directly. **NASA GIBS/Worldview and Moon Trek imagery:** Earth/Moon background imagery. Worldview place snapshots and credited ground photographs are already bundled; opening a card does not make a live Worldview request.
- **Bundled datasets:** a logical data supplier outside the interaction model, representing static NASA series, NOAA tides/indices, USGS/IAU nomenclature, facts, demos and mission files. It is not a separate live analysis server. Statistical computation runs in the browser's deterministic engine.
- **Firebase Firestore:** optional shared room storage and subscriptions. Without configuration, localStorage, storage events and BroadcastChannel support tabs in the same browser profile/origin. `data/classroom.json` was absent in this checkout; deployed configuration and Firestore rules were not verified.
- A solid actor line means participation. `<<include>>` points from a use case to behavior required to complete its successful goal. A learner can still abandon that goal midway. The mission includes case investigation, but its completion button does not enforce answering the direction/verdict questions. `<<extend>>` points from optional/conditional behavior to the base goal; labels give its guard or user action. These arrows do not encode screen order. For example, the projection **lesson** is always reachable from evidence; the future forecast band is conditional.
- Short use-case names are reused across diagrams with the same IDs. Supporting goals such as testing an association or publishing progress are initiated through their parent interaction, not separate menu items. The overview is intentionally selective; the five package diagrams contain all 48 IDs.

## Evidence and common paths

The required source files were read: [index.html](../../index.html), [main.js](../../main.js), [classroom.js](../../classroom.js), [README.md](../../README.md), [mission.json](../../data/mission.json), [moon_cases.json](../../data/moon_cases.json), plus relevant [engine.js](../../engine.js) functions. [source_snapshot.json](source_snapshot.json) records their hashes and the Git revision so concurrent work does not silently change what “as built” means. Concurrent application repairs detected during the auditor follow-up were read and incorporated; previous hashes are retained in that snapshot. Function names and element IDs below are the durable references; line links refer to that snapshot.

**Verification:** all seven final PNGs were visually inspected at their 1200 px width, including labels, relationship arrows and notes. The smallest scaled text is 12.21 px. [validation.json](validation.json) records passing checks for all 48 specifications, their 3–7 ordered steps, diagram coverage, reference names/IDs, valid image files, dimensions and unchanged inspected-source hashes. Recheck with `python docs/diagrams/validate_diagrams.py` from `app/`. No app tests or live backend operations were run in this documentation lane.

**Common navigation:** `route()` accepts the implemented hash views and sends an unknown view home. Evidence, projection, verdict, record and line-up require a current in-memory case; compare requires a second case, lunar requires a selected lunar case, and player requires a joined room. Missing state normally redirects to `#/case`; reloading a result URL does not reconstruct the result. A joined incomplete classroom mission now resumes on the player dashboard after reload. The brand and world buttons remain global escape routes. Source: [main.js:273](../../main.js#L273), `VIEWS`, `route()`; [index.html:184](../../index.html#L184), `.brand`, `#to-earth`, `#to-moon`.

**Bundled versus live data:** the current [catalog](../../data/catalog.json) has **919 places and 15 ordinary POWER variables**. [place_series.json](../../data/place_series.json) contains **927 place IDs**, including IDs outside that catalog: all 927 have T2M (air temperature) and PRECTOTCORR (precipitation), while eight other bundled variables cover only 24-30 places each. The 919 catalog IDs all have those two core series. Other point variables normally require live POWER. Arbitrary points, POWER map clicks and Scan use live requests; `seriesFor()` can reuse a bundle only on an exact catalog-coordinate/variable match. Atmosphere-grid clicks instead use stored cell series; missions, demos and regional means also have precomputed paths. The POWER actor labels say "live request (temperature and rain also bundled)" to avoid implying comprehensive offline coverage. Counts and hashes are recorded in [source_snapshot.json](source_snapshot.json).

**Common data error:** `seriesFor()` first tries a matching named place's bundled series, otherwise calls POWER. `powerError()` turns throttling/network-style failures into a busy message advising a retry or bundled place. There is no automatic POWER retry/backoff or cancellation in this UI. Engine `analyze()` requires at least eight observations; errors are shown by the initiating form. Source: [main.js:311](../../main.js#L311), `seriesFor()`, `powerError()`; [engine.js:111](../../engine.js#L111), `MIN_YEARS`, `analyze()`, `fetchPower()`.

## 1. Explore the Earth

### UC-01 — Browse Earth globe

**Actor:** Explorer; Classroom player in the Explorer role. **Goal:** orient on Earth and choose where to explore. **Trigger:** open the app, choose Earth, or follow Find a place.

1. The application initializes the Cesium Earth globe and GIBS background.
2. The user pans, zooms or rotates the globe.
3. On `#/case`, the user sees catalog dots and the place-selection controls.

**Alternatives/errors:** home has the globe but place picking is active on the case view. Cesium initialization failure reveals `#no3d`; catalog cards and typed coordinates remain available. Live imagery/CDN availability is separate from bundled series availability.

**Code:** [main.js:92](../../main.js#L92), Earth viewer initialization, click handler, `drawPlaceDots()`, `flyTo()`, `route()`; [index.html:181](../../index.html#L181), `#globe`, `#no3d`, `#view-case`.

### UC-02 — Filter places

**Actor:** Explorer. **Goal:** narrow the catalog by phenomenon and country. **Trigger:** choose a phenomenon chip or country.

1. The user opens the place-selection view.
2. The user selects a phenomenon and/or country.
3. The app combines those filters with the current search, updates visible dots and shows four matching cards per page.
4. The user pages through matches or selects a place.

**Alternatives/errors:** no matches produces an empty-state message. Choosing another filter resets pagination. Country matching supports places with multiple countries; it is not a continent filter.

**Code:** [main.js:181](../../main.js#L181), `renderKinds()`, `countriesOf()`, `fillCountries()`, `matches()`, `showDots()`, `renderPlaces()`; [index.html:331](../../index.html#L331), `#country`, `#kinds`, `#prev-page`, `#next-page`.

### UC-03 — Search places

**Actor:** Explorer. **Goal:** find a catalog place by text. **Trigger:** type in Search places.

1. The user enters a place name or matching catalog text.
2. The app combines text matching with active filters and resets the page.
3. The user selects a matching card or pages through the results.

**Alternatives/errors:** no match shows the catalog empty state. A coordinate-like entry is handled separately by UC-05 on Enter; this is not a worldwide geocoding service.

**Code:** [main.js:209](../../main.js#L209), `#place-search` input listener, `matches()`, `renderPlaces()`; [index.html:330](../../index.html#L330), `#place-search`.

### UC-04 — Inspect place card

**Actor:** Explorer. **Goal:** recognize a named place and read context before investigating. **Trigger:** select a catalog card or globe dot on the case view.

1. The app selects the place, sets its coordinates and flies toward it.
2. It opens the shared popup with name, country and short factual description.
3. It displays a credited ground photo when available, otherwise a bundled satellite snapshot.
4. The user reads available elevation/climate facts and continues to the case controls.

**Alternatives/errors:** missing fact fields are omitted. The popup is suppressed during a guided tour and outside the case view. Arbitrary points receive coordinates rather than a named photo. List thumbnails have a fallback; the ground-photo popup has no dedicated image-error recovery.

**Code:** [main.js:170](../../main.js#L170), `selectPlace()`, `showPop()`, card click listener; [index.html:193](../../index.html#L193), `#place-pop`, `#pop-img`, `#pop-name`, `#pop-facts`, `#pop-credit`.

### UC-05 — Select Earth point

**Actor:** Explorer. **Goal:** investigate coordinates beyond the named catalog. **Trigger:** click bare Earth on the case view or enter `latitude, longitude` and press Enter.

1. The user picks a globe position or types a coordinate pair.
2. The app validates typed latitude/longitude bounds or computes the picked coordinates.
3. It clears the named-place selection, moves the marker and displays the coordinate popup.
4. The user chooses a variable and presses Investigate to start UC-06.

**Alternatives/errors:** typed values outside ±90/±180 are silently ignored. Text not matching the coordinate pattern remains a search. Enter selects the point; it does not submit the investigation. Globe picking is unavailable if 3D initialization failed.

**Code:** [main.js:111](../../main.js#L111), Cesium click handler, `setPoint()`, `#place-search` keydown listener; [index.html:336](../../index.html#L336), hidden `#lat`, `#lon`.

## 2. Investigate a case

### UC-06 — Investigate case

**Actor:** Explorer; Classroom player through a mission. **Goal:** decide whether an observed change is supported by evidence. **Trigger:** press Investigate, open a ranked result/region, or start a mission case.

1. The app obtains a place/point, variable and optional hunch, or accepts a preconfigured bundled case.
2. It loads the corresponding annual series and runs `analyze()`.
3. It renders evidence, source context and available witness information (UC-09).
4. The learner may call the direction and inspect supporting clues.
5. The learner opens the verdict screen and reveals the verdict (UC-11).

**Alternatives/errors:** POWER busy, unavailable data and too-short records use the initiating form's error path. Missions/demos/regions supply data directly and skip manual selection. Users can navigate away before completing the goal. The normal verdict is revealed after a verdict call; demos reveal it directly.

**Code:** [main.js:334](../../main.js#L334), `#case-form` submit, `seriesFor()`, `render()`, classroom `openCase` callback at 1139; [engine.js:114](../../engine.js#L114), `analyze()`; [index.html:327](../../index.html#L327), `#case-form`.

### UC-07 — Choose variable

**Actor:** Explorer. **Goal:** select which environmental measurement to test. **Trigger:** select a variable radio on the case form.

1. The app fills available POWER variables, ordering suggestions for the selected environment.
2. The user selects one variable.
3. The app shows its plain-language definition and retains it for submission.

**Alternatives/errors:** the app keeps the prior variable when possible, otherwise defaults to T2M. Missions and stored cases preselect their variable. Extra MODIS/river variables come through Scan or other stored paths, not this normal radio list.

**Code:** [main.js:295](../../main.js#L295), `fillVariables()`, variable change listener; [index.html:338](../../index.html#L338), `#variables`, `#var-def`.

### UC-08 — Record hunch

**Actor:** Explorer. **Goal:** state an expectation before inspecting the evidence. **Trigger:** select a hunch on the case form.

1. The user selects up, down, no trend or unsure.
2. Submission stores that selection with the current case.
3. The evidence/verdict rendering can compare the hunch with the result and award a correct-hunch point.

**Alternatives/errors:** unsure/default is allowed and earns no hunch point. This is a fixed choice, not a free-text note. Missions and demos do not require this step. The renderer checks a per-case hunch flag; the global score has no durable answer ledger. See gaps.

**Code:** [main.js:334](../../main.js#L334), submit handler, `render()` hunch block, `award()`; [index.html:341](../../index.html#L341), hunch radio group.

### UC-09 — Inspect evidence

**Actor:** Explorer; Classroom player. **Goal:** examine the observed series before accepting a conclusion. **Trigger:** a case finishes loading or the user follows Evidence/Back.

1. The app plots annual observations and fitted trend.
2. The learner reads variable, place, period and source caption.
3. The learner opens the data/source details table and reads available witness context.
4. The learner continues to Projection or Verdict, or returns to select another case.

**Alternatives/errors:** the headline statistic is initially hidden in a normal game until the direction call; the chart and details remain accessible. A missing current case redirects to selection. A missing witness is described rather than fabricated.

**Code:** [main.js:428](../../main.js#L428), `render()`, `chart()`, `dataTable()`, `resetGame()`; [index.html:355](../../index.html#L355), `#view-evidence`, `#stat-row`, `#chart`, `#witnesses`, source details.

### UC-10 — Call direction

**Actor:** Explorer; Classroom player. **Goal:** identify up, down or no clear trend from evidence. **Trigger:** press a direction choice on Evidence.

1. The learner examines the series.
2. The learner chooses one of the three direction buttons.
3. The app locks the choice for this rendering, gives feedback and reveals the statistics.
4. An exact answer earns one point.

**Alternatives/errors:** direction is optional; navigation to Verdict remains available. An unknown verdict is treated as no clear direction for scoring. Demos bypass the question and show evidence directly.

**Code:** [main.js:544](../../main.js#L544), `resetGame()`, direction handler at 552; [index.html:358](../../index.html#L358), `#ask-trend`, `#trend-feedback`.

### UC-11 — Get verdict

**Actor:** Explorer; Classroom player. **Goal:** learn how strongly the data support the trend. **Trigger:** open Verdict and make a verdict call.

1. The learner chooses a confidence category on the Verdict view.
2. The app compares that call with its computed verdict and awards two points for an exact call or one for an adjacent category.
3. It reveals the verdict, explanatory checks and statistical details.
4. The learner opens clues or continues to other case activities.

**Alternatives/errors:** demos reveal the verdict without a call. A credible contradictory witness can lower Confirmed to Likely before display. Missing current state redirects to the case form. Other case actions remain accessible even before the verdict call.

**Code:** [main.js:411](../../main.js#L411), `withWitness()`, `render()`, verdict handler at 563; [index.html:395](../../index.html#L395), `#ask-verdict`, `#verdict-feedback`, `#verdict-block`, `#checks`.

### UC-12 — Inspect clock

**Actor:** Explorer; Classroom player. **Goal:** understand when the trend became detectable under the app's test. **Trigger:** open the clock clue after verdict reveal.

1. The app supplies the clock clue for the current analysis.
2. The learner opens the clue.
3. It explains the detection year or the applicable uncertainty/adjusted-scan condition.

**Alternatives/errors:** an adjusted scan, a marginal result, or a trend not established within the record has a different explanation. The clock is not a date selector or a causal start-date estimate.

**Code:** [main.js:379](../../main.js#L379), `clockText()`, `render()` checks, clue handler at 575; [index.html:410](../../index.html#L410), `#checks`.

### UC-13 — Cross-check methods

**Actor:** Explorer; Classroom player. **Goal:** see whether a second statistical test agrees. **Trigger:** open the second-test clue.

1. The primary analysis supplies its trend result.
2. The learner opens the second-test clue.
3. The app describes agreement/disagreement with its linear-regression t-test.

**Alternatives/errors:** disagreement is shown as evidence to consider, not hidden. This checks another method on the same observations; it is distinct from UC-16's independent dataset.

**Code:** [main.js:428](../../main.js#L428), `render()` second-test check, clue handler; [engine.js](../../engine.js), `linearTTest()`; [index.html:410](../../index.html#L410), `#checks`.

### UC-14 — Check prediction skill

**Actor:** Explorer; Classroom player. **Goal:** assess whether a trend fitted to earlier years predicts held-out years. **Trigger:** open the prediction clue or read the prediction explanation on Projection.

1. The engine separates the final 15 observations from the earlier training record.
2. It compares trend-prediction error with a training-mean baseline.
3. The learner reads the skill/error explanation and its implications for projection.

**Alternatives/errors:** fewer than 23 observations cannot leave eight training observations plus 15 held-out observations, so no prediction clue is added. This is retrospective checking, not a new live observation feed.

**Code:** [main.js:428](../../main.js#L428), `render()` prediction check, `renderProjection()` prediction explanation at 593; [engine.js:311](../../engine.js#L311), `predictionTest()`; [index.html:388](../../index.html#L388), `#learn-test`.

### UC-15 — Check climate alibi

**Actor:** Explorer; Classroom player. **Goal:** consider whether El Niño/PDO variation explains part of the apparent change. **Trigger:** open an available alibi clue.

1. The app aligns bundled NOAA climate indices with the case years.
2. It computes the applicable alibi check.
3. The learner opens and reads the result with the case verdict.

**Alternatives/errors:** the clue is not added when index alignment/checks are unavailable. A displayed association is a statistical comparison, not proof of causation or a live NOAA request.

**Code:** [main.js:428](../../main.js#L428), `render()` ENSO/PDO checks and startup `INDICES`; [engine.js](../../engine.js), `alibiTest()`; [index.html:410](../../index.html#L410), `#checks`.

### UC-16 — Compare data witness

**Actor:** Explorer; Classroom player. **Goal:** check the result against another dataset where available. **Trigger:** read witness context or open the witness clue.

1. The app looks for supplied witness series or a bundled witness matching the selected place/variable.
2. It compares witness and primary results.
3. It describes agreement, contradiction or the absence of a second dataset.
4. A credible contradiction can lower Confirmed to Likely and clear the detection year.

**Alternatives/errors:** missing/unusable witness data leave a one-dataset explanation. A second method on the primary series is UC-13, not an independent witness. Availability differs between stored region, point and comparison paths.

**Code:** [main.js:411](../../main.js#L411), `withWitness()`, `witnessText()`, `render()`; [index.html:372](../../index.html#L372), `#witnesses`, `#checks`.

### UC-17 — Read projection lesson

**Actor:** Explorer; Classroom player. **Goal:** understand what extrapolation can and cannot establish. **Trigger:** follow Projection from Evidence.

1. The app opens the projection view for the current case.
2. The learner reads the fixed lesson and the result of the prediction gate.
3. The learner reads the inline prediction-test explanation or returns to Evidence/Verdict.

**Alternatives/errors:** a failed gate still shows the lesson and observed series with a “No projection” explanation. It does not make the screen unreachable. Missing current state redirects to case selection.

**Code:** [main.js:583](../../main.js#L583), `renderProjection()`; [index.html:378](../../index.html#L378), `#view-projection`, `#proj-note`, `#learn-test`.

### UC-18 — View future projection

**Actor:** Explorer; Classroom player. **Goal:** inspect the app's conditional trend extrapolation to 2040. **Trigger:** open Projection for an eligible case.

1. The app checks that `predictionTest()` exists, its skill exceeds 0.1, and the verdict is not `unknown`.
2. It extends the fitted trend and uncertainty band to 2040.
3. The learner reads the endpoint/range together with the projection lesson.

**Alternatives/errors:** skill at or below 0.1, insufficient prediction-test data, or an unknown verdict produces UC-17's no-projection path. Passing this gate is not a causal model or a promise of forecast accuracy.

**Code:** [main.js:583](../../main.js#L583), `renderProjection()`, `TO_YEAR`, eligibility condition; [engine.js:381](../../engine.js#L381), `projection()`; [index.html:381](../../index.html#L381), `#proj-stat`, `#proj-chart`.

### UC-19 — Spot real series

**Actor:** Explorer; Classroom player. **Goal:** test whether the real record stands out among shuffled alternatives. **Trigger:** press Spot the real one from Verdict.

1. The app creates nine panels: the real series and eight block-shuffled alternatives.
2. It randomizes the real panel's position.
3. The learner selects one panel.
4. The app locks the selection and reveals the correct panel with feedback.

**Alternatives/errors:** this activity does not award score points. Reopening can create a new line-up. Without a current case the route guard returns to selection.

**Code:** [main.js:653](../../main.js#L653), line-up creation and click handler, `blockShuffle()`; [index.html:423](../../index.html#L423), `#view-lineup`, `#lineup-grid`, `#lineup-result`.

### UC-20 — Compare places

**Actor:** Explorer; Classroom player in the Explorer role. **Goal:** compare the same measurement at two point locations. **Trigger:** press Compare from an eligible case.

1. The app retains the first case and opens the place form with a comparison banner.
2. The learner selects another point/place using the same variable.
3. The app retrieves/analyzes the second series and displays both charts.
4. It describes whether supported directions agree or differ.

**Alternatives/errors:** Cancel clears the pending comparison. Changing the variable causes a normal investigation instead. Cases with no point coordinates or a non-POWER variable hide Compare. Unknown results withhold a direction claim; data failures remain on the form. New case exits comparison; there is no dedicated Back to first case control.

**Code:** [main.js:446](../../main.js#L446), Compare visibility; [main.js:511](../../main.js#L511), compare handlers, submit branch, `renderCompare()`; [index.html:326](../../index.html#L326), `#compare-banner`, `#compare-cancel`, `#view-compare`.

### UC-21 — Scan variables

**Actor:** Explorer. **Goal:** find promising measurements at a point while accounting for multiple tests. **Trigger:** press Scan everything here.

1. The app requests all ordinary variables from POWER for the point.
2. It adds matching bundled MODIS/river extras where available.
3. The engine analyzes/ranks the candidates with its multiple-testing adjustment.
4. The learner selects a ranked row to open that variable's evidence.

**Alternatives/errors:** Scan uses live POWER even at a place with ordinary bundled case series. A busy/API failure is displayed on the form. Empty/flat/no-data results get explanatory text rather than invented leads. The opened result retains its adjusted scan analysis.

**Code:** [main.js:360](../../main.js#L360), scan handler, `renderLeads()`, lead click handler; [engine.js:223](../../engine.js#L223), `fetchPowerMany()`, `scan()`; [index.html:349](../../index.html#L349), `#scan`, `#view-leads`, `#leads-list`.

### UC-22 — Inspect case file

**Actor:** Explorer; Classroom player. **Goal:** inspect the current case's summary and checks. **Trigger:** follow Case file from Verdict or a tour.

1. The app opens the record view for the current case.
2. The learner reads its location, change, verdict, checks, witnesses and method summary.
3. The learner returns to Verdict, starts a new case, or downloads the record.

**Alternatives/errors:** the link is available before the verdict game is answered. A result is held in memory; a fresh deep link without it redirects to selection.

**Code:** [main.js:487](../../main.js#L487), `render()` statistical and record tables; [index.html:451](../../index.html#L451), `#view-record`, `#record`.

### UC-23 — Download case file

**Actor:** Explorer; Classroom player. **Goal:** retain a machine-readable copy of the current analysis. **Trigger:** press Download on Case file.

1. The app builds JSON containing variable, place, coordinates, result and annual series.
2. It creates a browser download blob/link.
3. The browser offers the case JSON file.

**Alternatives/errors:** browser save behavior is external to the app. This export omits the second comparison case, full witness series, hunch, prediction/alibi objects and detailed acquisition provenance; it is not a complete session archive. No server upload occurs.

**Code:** [main.js:644](../../main.js#L644), download handler; [index.html:456](../../index.html#L456), `#download`.

### UC-24 — Play guided demo

**Actor:** Explorer. **Goal:** learn the investigation flow using a prepared example. **Trigger:** select a demo on Home.

1. The app reads the selected bundled demo and analyzes its series.
2. It renders its case, and comparison if supplied, with game prompts bypassed.
3. It starts a guided sequence through the relevant views and explanations.
4. The learner follows the tour or takes control through UC-25.

**Alternatives/errors:** demo source series do not require live POWER; loading still requires app assets. Demos award no normal direction/verdict/hunch points. Available examples come from the loaded demo file, not user-authored tours.

**Code:** [main.js:680](../../main.js#L680), demo click handler, `playTour()`, `resetGame(c.demo)`; [index.html:222](../../index.html#L222), `#demo-list`, `#tour`.

### UC-25 — Control guided tour

**Actor:** Explorer. **Goal:** control the pace or leave a demo tour. **Trigger:** press Pause/Play, Next or Exit while a tour is visible.

1. The learner pauses automatic advancement or resumes it.
2. Next advances the tour and routes to the relevant view.
3. Exit stops the timer and hides the overlay, leaving the current view available.

**Alternatives/errors:** reduced motion starts with no automatic advancement. The manual resume handler nevertheless schedules a timer; this should be reviewed. Skipping the initial camera flight is a separate existing global control.

**Code:** [main.js:711](../../main.js#L711), `playTour()`, tour button handlers; [index.html:202](../../index.html#L202), `#tour-pause`, `#tour-next`, `#tour-stop`.

## 3. Global monitor

### UC-26 — Map global trends

**Actor:** Explorer; Classroom player in the Explorer role. **Goal:** see where a selected measurement changes across Earth. **Trigger:** open the global-monitor link.

1. The app loads its precomputed grid and selects a map variable.
2. It colors cells by slope and varies opacity by verdict.
3. It displays area-weighted directional summaries, explanatory text and big-region buttons.
4. The learner explores the globe, changes variable or opens a location/region.

**Alternatives/errors:** no base grid hides the Home global link and the route guard returns to selection. Later-loaded atmosphere variables expand the menu. Failed 3D still leaves the region list, but no equivalent 2D cell map. This map is not computed through a live global POWER query.

**Code:** [main.js:734](../../main.js#L734), `gridSet()`, `fillGlobal()`, `drawGrid()`, `area()`; [index.html:226](../../index.html#L226), `#view-global`, `#global-summary`, `#regions`.

### UC-27 — Change map variable

**Actor:** Explorer. **Goal:** compare the geography of different measurements. **Trigger:** change the Global variable selector.

1. The user selects a loaded variable.
2. The app chooses the corresponding grid dataset.
3. It redraws cell colors, summaries, legend text and region buttons.

**Alternatives/errors:** atmosphere variables appear only after their asynchronous bundle loads. The list contains available precomputed products, not every variable that Scan can request.

**Code:** [main.js:739](../../main.js#L739), `fillGlobal()`, `#global-var` change listener, `drawGrid()`; [index.html:230](../../index.html#L230), `#global-var`.

### UC-28 — Investigate big region

**Actor:** Explorer. **Goal:** inspect a region-average series behind the map. **Trigger:** select a big-region button.

1. The app finds the stored mean series for the region and variable.
2. It analyzes the series and attaches a corresponding witness where supported.
3. It opens the ordinary evidence/verdict flow with the region label.

**Alternatives/errors:** the case has no point latitude/longitude and cannot start Compare places. This uses the stored regional mean, not a single city or a newly drawn user polygon.

**Code:** [main.js:795](../../main.js#L795), `#regions` click handler, `render()`; [index.html:234](../../index.html#L234), `#regions`.

### UC-29 — Investigate map location

**Actor:** Explorer. **Goal:** open evidence for a clicked part of the map. **Trigger:** click Earth while the global view is active.

1. The app computes the clicked latitude/longitude.
2. For a POWER grid variable, it selects the point and submits the ordinary point form.
3. For the atmosphere grid, it finds the nearest stored cell and analyzes that cell's series.
4. It opens Evidence for the resulting case.

**Alternatives/errors:** a POWER click may use a bundle or live API and is not guaranteed to reproduce the precomputed displayed grid cell. A missing stored atmosphere series leaves a visible map note. A stored cell has no point-comparison coordinates. No 3D picking is available without a working globe.

**Code:** [main.js:807](../../main.js#L807), `openCell()`, `openStoredCell()`, case form submission; [index.html:235](../../index.html#L235), `#global-note`.

## 4. Moon

### UC-30 — Switch world

**Actor:** Explorer; Classroom player in the Explorer role. **Goal:** move between Earth exploration and Moon content. **Trigger:** press Moon or Earth in the world switch.

1. The app changes the hash view and calls `setWorld()`.
2. Moon selection lazily initializes the lunar globe with Moon Trek LRO imagery and feature markers.
3. The user explores Moon content or switches back to Earth/Home.

**Alternatives/errors:** the Moon globe's initialization catch logs a warning; it does not provide a dedicated lunar map fallback. Textual case links remain separate from picking a feature. Changing worlds does not sign out of a classroom room.

**Code:** [main.js:831](../../main.js#L831), `MOON_TILES`, `setWorld()`, world button handlers at 939; [index.html:182](../../index.html#L182), `#moon-globe`, `#to-moon`, `#to-earth`, `#back-earth`.

### UC-31 — Toggle lunar layers

**Actor:** Explorer. **Goal:** choose which gazetteer feature groups are shown. **Trigger:** press a toggle button in Moon layers.

1. The app loads bundled lunar features and groups their marker types.
2. The user toggles seas/lakes, mountains/valleys, craters or landing sites.
3. The app shows/hides those groups' markers and labels.

**Alternatives/errors:** these are annotation layers, not alternative imagery rasters. Craters start off; the other groups start on. Ten separately defined landmark markers do not follow these toggles. Failed feature-file loading has no explicit user-facing retry message.

**Code:** [main.js:858](../../main.js#L858), `MOON_LAYERS`, `renderMoonLayers()`, `loadMoonFeatures()`; [index.html:287](../../index.html#L287), `#moon-layers`.

### UC-32 — Inspect lunar feature

**Actor:** Explorer. **Goal:** identify a lunar landmark and read its source information. **Trigger:** select a lunar marker.

1. The user clicks a fixed landmark or gazetteer marker.
2. The shared popup shows its name, coordinates and explanatory text.
3. Gazetteer cards add feature type, origin, diameter and naming year where present.
4. The user can follow the Gazetteer or Wikipedia source link.

**Alternatives/errors:** lunar cards have no place photo. Gazetteer and fixed markers can overlap; some labels only appear within distance limits. There is no dedicated keyboard-searchable lunar feature list in the read code.

**Code:** [main.js:833](../../main.js#L833), `MOON_PLACES`, `loadMoonFeatures()`, lunar Cesium click handler in `setWorld()`; [index.html:193](../../index.html#L193), shared `#place-pop`.

### UC-33 — Open Moon-Earth case

**Actor:** Explorer; Classroom player in the Explorer role. **Goal:** distinguish established lunar influence from a testable climate association. **Trigger:** choose a Moon-Earth case.

1. The app opens the case introduction and resets its prior result, guess and quiz.
2. It displays the case's available controls and explanation.
3. The learner reads the coral-spawning information/quiz or proceeds to a tidal, glacier or rain/climate test.

**Alternatives/errors:** coral spawning is informational plus quiz; it does not offer the annual-series test. Tides use a station and fixed tidal-range variable. Glaciers restrict the place list; the rain case permits all places and the six climate variables. Direct lunar view without a selected case redirects to selection.

**Code:** [main.js:845](../../main.js#L845), `MOON_CASES`, Moon case click handler, `openLunarCase()`; [index.html:283](../../index.html#L283), `#moon-cases`, `#view-lunar`, `#lunar-controls`.

### UC-34 — Test tidal control

**Actor:** Explorer. **Goal:** use an established lunar influence as a positive-control example. **Trigger:** choose the tides case, a station and Test.

1. The learner selects a station from the bundled NOAA tides file.
2. The app uses its annual tidal-range series, converting metres to centimetres.
3. It runs the common lunar association test (UC-37).
4. It displays the fitted-cycle comparison and statistical explanation.

**Alternatives/errors:** no live NOAA API call occurs. An absent station/variable now displays "Pick a place and a variable first." A too-short series uses the shared short-record explanation. A quiz is independently available for this case.

**Code:** [main.js:996](../../main.js#L996), `openLunarCase()` tides branch; [main.js:1032](../../main.js#L1032), `#lunar-run` handler; [index.html:305](../../index.html#L305), `#lunar-place`, `#lunar-var`, `#lunar-run`.

### UC-35 — Test glacier climate

**Actor:** Explorer. **Goal:** test a lunar-cycle association in climate at a glacier location. **Trigger:** choose the glacier case and press Test.

1. The learner chooses a glacier place and one of six offered climate variables.
2. The app loads a matching bundled series or calls NASA POWER.
3. It runs UC-37 and plots the detrended climate series and fitted cycle.
4. The learner reads uncertainty and the no-causation warning.

**Alternatives/errors:** this tests climate at the location, not observed glacier mass loss. POWER busy/network errors are shown. Fewer than 37 values gives the short-record message. A hunch is optional.

**Code:** [main.js:855](../../main.js#L855), `LUNAR_VARS`, `openLunarCase()`, lunar-run handler, `seriesFor()`; [index.html:305](../../index.html#L305), lunar place/variable controls.

### UC-36 — Test rain climate

**Actor:** Explorer. **Goal:** test whether a climate record supports the proposed lunar association. **Trigger:** choose the rain case and press Test.

1. The learner selects a catalog place and climate variable.
2. The app loads the bundle or obtains POWER observations.
3. It performs UC-37 and displays its cycle fit, signal category and explanation.
4. The learner compares the result with any recorded hunch.

**Alternatives/errors:** despite the rain-oriented case title, the UI offers the same six variables as the glacier case, including temperature, snow and humidity. Too-short/busy/error handling is the same as UC-35. It does not establish lunar causation of rainfall.

**Code:** [main.js:845](../../main.js#L845), rain `MOON_CASES` entry, `LUNAR_VARS`, `openLunarCase()`, lunar-run handler at 1032.

### UC-37 — Test lunar association

**Actor:** Explorer, through UC-34/35/36. **Goal:** compare a fitted lunar-period component with autocorrelated placebo records. **Trigger:** an executable lunar case submits its annual series.

1. The engine checks the record has at least 37 observations.
2. It detrends the series and fits its lunar-period component.
3. It compares the fit with 999 AR(1) placebos using the UI's fixed random seed.
4. It returns the signal/hint/none category, share, swing and placebo probability.
5. The UI plots the comparison and explains that association is not causation.

**Alternatives/errors:** too-short records stop the test with an explicit explanation. Flat or non-finite records now stop with "Nothing to test here"; data retrieval errors are caught by the lunar view. The code checks observation count, not calendar continuity/two complete elapsed cycles; this is a review question, not an added validation.

**Code:** [main.js:1032](../../main.js#L1032), lunar-run handler, `lunarChart()`; [engine.js:411](../../engine.js#L411), `LUNAR_MIN_YEARS`, `lunarTest()`; [index.html:310](../../index.html#L310), `#lunar-stat`, `#lunar-note`, `#lunar-chart`.

### UC-38 — Record lunar hunch

**Actor:** Explorer. **Goal:** predict whether the test will find a signal. **Trigger:** select Yes or No before Test.

1. The learner records a fixed yes/no guess.
2. The app retains the guess while loading and testing the series.
3. It compares the guess with the test category and awards one point if correct.
4. It resets the guess after the run.

**Alternatives/errors:** no guess is allowed. Only the `signal` result counts as yes; a hint is treated as no signal for scoring. The guess can be changed before the run, and repeating a test can earn another point.

**Code:** [main.js:989](../../main.js#L989), lunar-guess handler and lunar-run scoring block; [index.html:299](../../index.html#L299), `#lunar-guess`.

### UC-39 — Read Moon discovery

**Actor:** Explorer. **Goal:** learn from cited published observations about the Moon itself. **Trigger:** choose a Moon discovery card.

1. The app loads the chosen entry from `moon_cases.json`.
2. It opens the lunar view with its introduction, source-labeled facts, units and observation periods.
3. The learner reads the cited facts and can follow source links.
4. The learner can answer its quiz or return to Moon.

**Alternatives/errors:** the four entries cover recession, new craters, impact flashes and Apollo seismic reanalysis. They provide facts/quizzes, not interactive annual-series analyses or new trend calculations. The extra Learn more link in `#lunar-note` stays hidden until a quiz answer; fact-source links are already visible.

**Code:** [main.js:951](../../main.js#L951), `renderMoonOwn()`, own-case click handler, `openLunarCase()`; [moon_cases.json](../../data/moon_cases.json), four `cases`; [index.html:285](../../index.html#L285), `#moon-own`, `#lunar-facts`.

### UC-40 — Answer Moon quiz

**Actor:** Explorer; Classroom player in the Explorer role. **Goal:** check understanding of a lunar case's evidence. **Trigger:** select an answer in an available Moon quiz.

1. The learner reads the case facts or explanation.
2. The learner selects one offered answer.
3. The app locks that case opening's quiz, marks the result and shows the explanation.
4. A correct first attempt in the current page session earns one point; any answer reveals supporting note/learn-more content.

**Alternatives/errors:** quizzes exist for tides, corals and the four discoveries, not every climate test. A wrong answer still receives an explanation. Reopening resets the visible quiz, while a page-memory Set prevents another award for that quiz. Reloading resets that Set.

**Code:** [main.js:972](../../main.js#L972), `QUIZ`, quiz handler, `openLunarCase()` reset; [index.html:297](../../index.html#L297), `#lunar-quiz`, `#lunar-feedback`.

## 5. Game and classroom

### UC-41 — Track score and rank

**Actor:** Explorer; Classroom player. **Goal:** see progress through the app's evidence games. **Trigger:** earn points or open the app with a saved score.

1. The app loads the browser-local cumulative score.
2. Correct hunches, direction/verdict calls and eligible Moon answers add points.
3. The score display updates the rank at thresholds 0, 5, 12, 25 and 45.
4. If a keyed classroom mission answer is active and has not been scored before, its points also update the room player's session score.

**Alternatives/errors:** ranks are Rookie, Junior detective, Inspector, Chief inspector and Legendary detective. Storage failure leaves an in-memory score. The global local score and the room score are distinct. Demos and line-up do not award points; awards are client-side. Room answers are deduplicated by keys saved in session storage; the cumulative solo score has no durable answer ledger.

**Code:** [main.js:537](../../main.js#L537), `RANKS`, `showScore()`, `award()`; [classroom.js:197](../../classroom.js#L197), returned `addPoints()`; [index.html:190](../../index.html#L190), `#score`.

### UC-42 — Host session

**Actor:** Teacher/host. **Goal:** create a room and monitor anonymous detectives. **Trigger:** open Classroom and press Host a session.

1. The app selects the configured shared backend or the local fallback.
2. It generates a four-character room code, retrying collisions up to six times, and creates a new room.
3. It displays a join invite (UC-43).
4. It subscribes to players and displays the host leaderboard (UC-47).

**Alternatives/errors:** shared-backend initialization failure falls back locally. Later room creation/subscription failures have no dedicated caught UI error in `host()`. Exhausted collision retries show a creation message; no close-room action is implemented. Direct `#/host` is not guarded by a created room.

**Code:** [classroom.js:82](../../classroom.js#L82), `createClassroom()`, `host()`, `firebaseBackend()`, `localBackend()`; [index.html:246](../../index.html#L246), `#host-btn`, `#view-host`.

### UC-43 — Display join invite

**Actor:** Teacher/host. **Goal:** let players obtain the room's join address/code. **Trigger:** successful room creation.

1. The app displays the room's four-character code.
2. It constructs a URL containing `?room=CODE#/player`.
3. It displays that URL and generates its QR image for the host to show.

**Alternatives/errors:** QR generation failure leaves a textual join link/code. There is no dedicated Copy, email, send or print action. A QR opened on another device needs shared Firestore mode; the local fallback is limited to the same browser profile/origin.

**Code:** [classroom.js:91](../../classroom.js#L91), `joinUrl()`, `newCode()`, `host()` QR handling; [index.html:259](../../index.html#L259), `#host-code`, `#host-qr`, `#host-url`.

### UC-44 — Join session

**Actor:** Classroom player. **Goal:** enter a room as an anonymous numbered detective. **Trigger:** scan/open the join URL or submit a room code.

1. The player enters a code, or the query parameter triggers automatic joining.
2. The app normalizes and validates the four-character format.
3. The backend checks that the room exists/is open and allocates the next detective number.
4. The app saves the session identity and opens the player dashboard.

**Alternatives/errors:** wrong format, missing/closed room and backend errors display a join status. A local room is invisible on another browser/device. Rejoining the same code reuses the current identity, and concurrent join-button submissions are blocked. Failures route back to Classroom. Session storage can resume the identity in the same tab context; there is no account/login or recover-by-name flow. Automatic joining avoids repeating for the already selected room.

**Code:** [classroom.js:121](../../classroom.js#L121), `join()`, backend `join()`, session restore, query autojoin at 189; [index.html:249](../../index.html#L249), `#join-code`, `#join-btn`, `#join-status`, `#player-id`.

### UC-45 — Play five-case mission

**Actor:** Classroom player. **Goal:** complete the prepared investigation sequence with a room score. **Trigger:** press the next-case button on the player dashboard.

1. The app displays the detective number, room score and mission checklist.
2. The player starts the next unfinished case.
3. The app loads its bundled place, variable and annual series and opens Evidence.
4. The player investigates the bundled case using ordinary evidence/verdict controls (UC-06).
5. The player completes the case (UC-46), then repeats until all five are marked done.

**Alternatives/errors:** the fixed sequence is Coropuna temperature, Jakobshavn temperature, Lake Huron rain, Cape of Good Hope aerosols and Tokyo minimum temperature. It does not call POWER for those mission series or ask for a manual pre-case hunch. A missing mission file becomes an empty list rather than a recovery flow. A completed mission hides Next and directs the player to the host's display. The mission includes opening/investigating each bundled case (UC-06). This reuse relationship does not imply an answer gate: the code permits marking a case complete without answering either call.

**Code:** [classroom.js:86](../../classroom.js#L86), mission load, `renderPlayer()`, `startNext()`; [main.js:1139](../../main.js#L1139), classroom `openCase` callback; [mission.json](../../data/mission.json), `cases`; [index.html:268](../../index.html#L268), `#player-cases`, `#player-next`, `#player-finished`.

### UC-46 — Complete mission case

**Actor:** Classroom player. **Goal:** advance the mission checklist. **Trigger:** press the classroom next/finish control while a mission case is active.

1. The app checks that a player and active mission case exist.
2. It increments completed-case count and clears active-case state.
3. It saves the local session and returns to the player dashboard with the next case or completion message.
4. It publishes progress (UC-48), updating sync status if the write fails.

**Alternatives/errors:** answering direction/verdict is not a precondition enforced by `finishCase()`. Duplicate completion after active state clears is ignored. The local dashboard still advances on report failure and shows "not synced yet, retrying"; sync retries are scheduled from that dashboard.

**Code:** [classroom.js:159](../../classroom.js#L159), `showBar()`, `finishCase()`, mission button handlers; [index.html:189](../../index.html#L189), `#mission-bar`, `#mission-next` at 419.

### UC-47 — View live leaderboard

**Actor:** Teacher/host. **Goal:** display room participation and rankings. **Trigger:** a hosted room's subscription emits player changes.

1. The app receives players through local browser events or Firestore snapshots.
2. It sorts by descending score, then completed cases, then ascending detective number.
3. It displays the top ten and total joined count.
4. Further backend events refresh the display.

**Alternatives/errors:** shared mode spans devices only with working configuration/rules. Local mode is same-browser tabs. The player dashboard does not contain its own leaderboard; it directs learners to the host screen. Subscription errors/disconnection have no explicit stale-board indicator in this code.

**Code:** [classroom.js:37](../../classroom.js#L37), shared `watch()`, local `watch()`, `renderBoard()`, `host()` subscription; [index.html:262](../../index.html#L262), `#host-count`, `#host-board`.

### UC-48 — Publish mission progress

**Actor:** Classroom player; optional Firestore or local backend as supporting system. **Goal:** make the player's score/completion visible to the host. **Trigger:** points change while a mission case is active, or a mission case is completed.

1. The app updates the session's score or completed count and persists it in session storage.
2. It writes the player's current score and completion values to the selected backend.
3. A successful write clears the unsynced flag; a failure keeps the locally saved progress and marks it for retry.
4. The host's subscription receives a successful player change.

**Alternatives/errors:** report errors mark the player unsynced, show that state on the player dashboard and schedule another sync after three seconds; local missing-room reporting now throws an error. Backend choice is configuration, not a player setting. Values are produced by client code; deployed security rules and anti-tampering enforcement are outside this source verification.

**Code:** [classroom.js:37](../../classroom.js#L37), backend `report()` implementations, `sync()`, `finishCase()` at 172, returned `addPoints()` at 197.

## Gaps and questions

The following distinguish observed source behavior from matters requiring runtime or deployment verification. IDs are retained for traceability; entries repaired by concurrent application work are explicitly marked. They are review findings, not use cases drawn as implemented features.

| ID | Observed gap or unresolved question | Evidence / implication |
|---|---|---|
| G-01 | **Cross-device classroom is optional; this checkout is local.** Does the public deployment configure Firestore and suitable rules? | `createClassroom()` and absent `data/classroom.json`; [classroom.js:83](../../classroom.js#L83). Scanning a local host's QR on a phone cannot find that local room. Deployment/rules were not exercised. |
| G-02 | **Room lifecycle is still incomplete; collision handling was repaired during this follow-up.** There is no close, expiry, delete, reset, player removal or custom mission UI. | `createRoom()` now checks absence (Firestore transaction; local Web Lock when available), and `host()` retries six codes. [classroom.js:16](../../classroom.js#L16), [classroom.js:104](../../classroom.js#L104). Host Back still does not close the room. |
| G-03 | **Mission completion is not gated by investigation answers.** Unrelated activities no longer add room points. | `finishCase()` checks active-case state, while `addPoints()` now accepts only keys for that mission case and deduplicates them. [classroom.js:172](../../classroom.js#L172), [classroom.js:197](../../classroom.js#L197). Review what the completion count should mean. |
| G-04 | **Global scoring still lacks a durable answer ledger; room scoring now has deduplication.** Quiz awards are limited to the first attempt per page session, and the renderer checks a hunch flag. | `award()`, `quizScored`, `render()` and mission answer keys; [main.js:541](../../main.js#L541), [main.js:979](../../main.js#L979), [classroom.js:197](../../classroom.js#L197). Reloading resets page-memory guards; lunar hunch reruns can still award solo points. The line-up awards none. |
| G-05 | **Player sync failure now has status and retries; host recovery still needs review.** This gap was partially repaired during the follow-up. | `sync()` sets `unsynced`, `renderPlayer()` shows it and schedules a three-second retry. [classroom.js:141](../../classroom.js#L141), [classroom.js:149](../../classroom.js#L149). Host creation/subscription errors still lack equivalent caught recovery/stale-board UI. |
| G-06 | **Navigation has remaining soft dead ends.** Player still has no in-view Leave/Restart; completed players are sent to the host display. Direct `#/host` can be uninitialized. | [index.html:257](../../index.html#L257), [index.html:268](../../index.html#L268). The active mission banner now returns to the player view, and an incomplete joined mission resumes there after reload. [classroom.js:186](../../classroom.js#L186), [classroom.js:193](../../classroom.js#L193). Global brand/world controls also escape. |
| G-07 | **Scan differs from ordinary investigation offline behavior.** It always requests POWER first, even for bundled named places. | Bundle lookup and live return in `seriesFor()` at [main.js:314](../../main.js#L314) and [main.js:318](../../main.js#L318); Scan live call at [main.js:365](../../main.js#L365). No automatic retry/backoff; app/CDN assets also remain network dependencies. Avoid claiming the whole platform works offline. |
| G-08 | **Comparison has asymmetries.** Changing the variable abandons the comparison without a special explanation; region/non-POWER cases cannot compare; there is no Back to first case. | submit branch, Compare visibility and `renderCompare()`; [main.js:346](../../main.js#L346), [main.js:446](../../main.js#L446), [index.html:442](../../index.html#L442). The second comparison analysis bypasses normal `withWitness()` rendering; should witness downgrades be applied consistently? |
| G-09 | **A POWER map click is a new point investigation, not necessarily the visible cell's stored result.** Atmosphere clicks use a different stored-cell path. | `openCell()`, `openStoredCell()`; [main.js:807](../../main.js#L807). Clarify location/aggregation in the UI before making exact map-to-case claims. |
| G-10 | **3D has incomplete alternatives.** Earth keeps cards/typed coordinates and regions, but no fallback cell map; Moon has no feature list/search or dedicated initialization-error display. | Earth catch, `setWorld()` catch, lunar pick handler; [main.js:125](../../main.js#L125), [main.js:896](../../main.js#L896). Keyboard/screen-reader and mobile accessibility require runtime review; not proven by this document. |
| G-11 | **Moon layers do not control all lunar markers.** Ten hardcoded landmarks coexist with gazetteer markers and can duplicate features/landing positions. | `MOON_PLACES`, `MOON_LAYERS`, `loadMoonFeatures()`; [main.js:833](../../main.js#L833). Review source/coordinate differences and whether a toggle should hide every corresponding marker. |
| G-12 | **Moon discoveries are fact cards/quizzes, not executable trend cases.** Their extra Learn more link is hidden until a quiz answer. Corals are also informational. | `openLunarCase()`, quiz handler, `moon_cases.json`; [main.js:996](../../main.js#L996). Source links on facts remain available. A public description should distinguish reading published findings from rerunning observations. |
| G-13 | **Lunar record eligibility still needs scientific clarification.** The code requires 37 values; the repaired UI says "about two 18.6-year cycles." | [engine.js:411](../../engine.js#L411), [main.js:1048](../../main.js#L1048). 37 consecutive annual values span 36 years, not two full 18.6-year cycles (37.2 years); observation count alone does not establish elapsed coverage or continuity. No added continuity guard is assumed here. |
| G-14 | **Case download is a partial record.** It lacks the second comparison, full witness, hunch, alibi/prediction objects and detailed acquisition metadata. | Download object at [main.js:644](../../main.js#L644). Is this sufficient for the intended reproducibility/classroom handoff? No import/reopen flow exists. |
| G-15 | **Stale submissions now have a guard, but request cancellation is absent.** The original late-result gap was partially repaired during this follow-up. | Shared `op` tokens guard case, Scan and lunar responses; a mission case invalidates pending work. [main.js:333](../../main.js#L333), [main.js:363](../../main.js#L363), [main.js:1037](../../main.js#L1037), [main.js:1141](../../main.js#L1141). Network requests are not aborted. Navigation/selection changes without a new operation still merit browser review. |
| G-16 | **Typed coordinate bounds still fail quietly; lunar selection now has feedback.** Invalid typed coordinates return silently. | Coordinate condition at [main.js:217](../../main.js#L217); repaired lunar validation at [main.js:1036](../../main.js#L1036). The coordinate-handler comment suggests Enter investigates, but it only selects the point. Missing lunar place/variable now displays a prompt. |
| G-17 | **Data loading can fail without a specific recovery prompt.** Missing mission becomes an empty list; missing Moon features has no dedicated error/retry. | `loadJson()`, mission load, `loadMoonFeatures()`; [main.js:1087](../../main.js#L1087), [classroom.js:86](../../classroom.js#L86). Distinguish an empty dataset from failed loading. |
| G-18 | **Reduced-motion tour behavior is inconsistent.** Initial automatic advancement is suppressed, but manual Play schedules a timer. | `playTour()` and pause/play handler; [main.js:711](../../main.js#L711). Confirm the intended accessible behavior in a real browser. |
| G-19 | **Documentation and labels need alignment.** README describes a global-first journey while the current home is a hero with links; “write down” a hunch means fixed choices. Rain's lunar case permits six climate variables. | [README.md](../../README.md), [index.html:212](../../index.html#L212), `LUNAR_VARS` and `openLunarCase()`. This model follows the handlers and actual controls. |
| G-20 | **Classroom integrity remains a deployment question; local join serialization was added.** Scores/progress are client-authoritative. | Local create/join/report use `navigator.locks` when available, with an unlocked fallback in browsers lacking it. [classroom.js:47](../../classroom.js#L47). Deployed Firestore rules and anti-tampering behavior were not checked; no claim of secure competitive ranking is made. |
| G-21 | **Resolved during the follow-up: lunar explanatory text is now restored.** Informational cases still hide the extra note until a quiz answer, but opening/running a testable case explicitly shows it. | `openLunarCase()` restoration at [main.js:1019](../../main.js#L1019), lunar-run restoration at [main.js:1038](../../main.js#L1038), quiz restoration at [main.js:984](../../main.js#L984). The previous hidden-test-explanation sequence is no longer supported by this source snapshot. Browser confirmation remains outside this lane. |

No account registration, named profiles, chat/AI assistant, teacher-created missions, session closing, user-selectable backend, free-form hunch, custom date-window selector, always-available forecast, live NOAA tide retrieval, or annual-series Moon-discovery analysis was found in the inspected implementation. These must not be presented as current use cases. Browser behavior, deployed services and scientific validity beyond the implemented checks remain outside this static documentation review.


## Update · 15 November 2026

| ID | Use case | Actor | What happens |
|---|---|---|---|
| UC-49 | Choose language | Explorer, classroom player | A selector next to the Earth/Moon switch offers English, Español, Português, Français, Русский and 中文. The first language comes from `?lang=`, then the saved choice, then the browser language. Changing it never restarts a case, quiz or room. Translations are static, hand-written dictionaries (`i18n_dictionary.js`); no AI or machine translation runs in the app. |
| UC-50 | Set home country | Explorer | On the first visit a dialog asks "Where are you from?". The globe flies to that country; the answer is saved and can be changed with "Focus on a country" on the home sheet. It only moves the camera: places are never filtered. Players who join a room through a QR link are not asked. |
| UC-51 | Read author information | Explorer | "Information" in the brand bar opens the author panel: name, Computer Science, data analysis, previous hackathons, LinkedIn and e-mail links. |

Changed: classroom rooms (UC-42 to UC-48) now use the configured Firebase project (Firestore + anonymous sign-in), so players join from their own phones; the same-browser local mode remains only as a fallback.
