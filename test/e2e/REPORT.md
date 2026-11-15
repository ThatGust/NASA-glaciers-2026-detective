# Signal or Noise — interaction audit R1

Run: 2026-11-15T03:37:25.250Z → 2026-11-15T03:44:10.098Z. Node v24.13.1; Chrome/157.0.8103.51. Target: http://localhost:8765/index.html.

**207 PASS / 2 FAIL.** One isolated Chrome process; maximum three app tabs (host plus two players). Live POWER is intercepted before transmission: 1 requests failed through Fetch.failRequest. Reused the existing server; never started or stopped a server.

Cleanup: `{"closed_tabs":3,"total_tabs":3,"owned_chrome_stopped":true,"existing_server_untouched":true}`. Source hashes: [run evidence](run-2026-11-15T03-37-25-249Z/results.json). Catalog/image data can change concurrently; this runner does not modify or freeze them. Changed source hashes: none.

Tests use public hash routes for setup and real pointer/keyboard events for actions; select values dispatch their normal change event. No private app functions, synthetic scientific series, or mocked successful NASA responses are injected. Visibility assertions include viewport and scroll-container clipping. Transparent radio inputs are clicked through their visible labels. Initialization waits for attached demo controls, which may belong to an inactive home view. Internal vertical panel scrolling is allowed. PASS means the stated visible assertion passed; warnings and browser resource errors remain attached per step. Uncaught JavaScript exceptions also fail the step. Every failed step attempts a foreground-only screenshot; any capture failure is stated explicitly. Per-step aborts and CDP timeouts bound all waits.

All scenarios are ordered by blocker, major, minor, with failures first within each severity. Horizontal layout overflow is minor; interaction failures and score farming are major. Unverified headless picking is labelled a limitation rather than a proven application defect.

Initial timeout diagnosis: **test-script error**. `index.html:69` intentionally gives `.chip input` opacity 0 and disables its pointer events; `main.js:299` wraps each variable radio in a visible label. Waiting for a visible `#variables input` can never succeed. The runner clicks that label and asserts the checked state/definition. Player initialization also checks attached controls rather than visibility of the inactive home view.

## PASS · blocker · 001 Infrastructure and app bootstrap

- **Expected:** Server answers; one Chrome opens; home and demo buttons are visible.
- **Actual:** Is the Earth really changing here?  Be a detective: pick a place, test NASA data, get an honest verdict.  See the planet's trends Investigate a place Play in class  Or watch a solved case:  Same variable, opposite directions: precipitation A confirmed trend at Coropuna Not yet known at Cape of Good Hope
- **Tab / duration:** infrastructure / 3829 ms
- **Console errors/exceptions:** `browser-error`: Failed to load resource: the server responded with a status of 404 (File not found) (http://localhost:8765/data/classroom.json) · `browser-error`: Failed to load resource: the server responded with a status of 404 (File not found) (http://localhost:8765/favicon.ico)
- **Screenshot:** not needed (PASS)

## FAIL · major · 079 Verdict answer likely: close, one reveal and no double score

- **Expected:** Visible close feedback and verdict; only 1 points, including repeated clicks.
- **Actual:** Expected values to be strictly equal:  0 !== 1 
- **Tab / duration:** main / 7251 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/079.png)
- **Failure state:** `{"url":"http://localhost:8765/index.html#/verdict","view":"view-verdict","text":"STEP 3 OF 3 · THE VERDICT\n\n🔍 Your verdict: is this change real, or could it be chance?\n\n● Real change\n◐ Signs, not sure\n○ Can't tell yet\n\n≈ Close (already scored). The tests say \"Not yet known\": the ups and downs are too big for the change to stand out yet.\n\n○ Not yet known\n\nToo early to tell this apart from normal ups and downs.\n\nClues (click each one to investigate)\n🔍 The clock\n🔍 Ask a second test\n🔍 Test it on the past\n🔍 Check the alibi: El Niño\n🔍 Question a second witness\nThe statistics\nBack\nSpot the real one\nCompare\nCase file"}`

## PASS · major · 002 Home: open case

- **Expected:** Investigate a place opens the case form with catalog cards.
- **Actual:** 1 / 232 · 927 places
- **Tab / duration:** main / 226 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 006 Keyboard home: main controls and visible focus

- **Expected:** Tab reaches #view-home a[href="#/global"], #view-home a[href="#/case"], #view-home a[href="#/class"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 3 Tab presses. [{"id":"global-link","tag":"A","text":"See the planet's trends","ring":true,"matched":["#view-home a[href=\"#/global\"]"]},{"id":"","tag":"A","text":"Investigate a place","ring":true,"matched":["#view-home a[href=\"#/case\"]"]},{"id":"","tag":"A","text":"Play in class","ring":true,"matched":["#view-home a[href=\"#/class\"]"]}]
- **Tab / duration:** main / 319 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 007 Home: classroom button and Back

- **Expected:** Play in class opens host/join controls; Back returns home.
- **Actual:** Classroom host/join and home visible.
- **Tab / duration:** main / 1529 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 008 Home: Skip and brand navigation

- **Expected:** Skip opens the case picker and the brand returns home.
- **Actual:** Skip → case → brand → home.
- **Tab / duration:** main / 1348 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 009 Demo 0: start and Next — Same variable, opposite directions: precipitation

- **Expected:** Tour overlay opens; Next advances its visible step counter and view.
- **Actual:** 1/5 · Two places, one variable. From 1981 to 2025, precipitation rose 0.081 mm/day per decade at Coropuna (p = 0.001) but fell 0.32 mm/day per decade at Salonga (p = 0.008). One variable, two regions, opposite trends. → 2/5 · The evidence: one value per year, so the seasons cancel out. The dashed line is the trend.
- **Tab / duration:** main / 1379 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 010 Demo 0: Pause

- **Expected:** Pause changes to Play and prevents auto-advance over the normal 9-second interval.
- **Actual:** Paused for 9.4 seconds: 2/5 · The evidence: one value per year, so the seasons cancel out. The dashed line is the trend.
- **Tab / duration:** main / 9941 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 011 Demo 0: resume and Exit

- **Expected:** Play changes to Pause; Exit removes the tour overlay.
- **Actual:** Tour resumed and exited.
- **Tab / duration:** main / 1327 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 012 Demo 0: every remaining step and Close

- **Expected:** Every tour step has text and an active view; final Close hides the tour.
- **Actual:** 1/5 · Two places, one variable. From 1981 to 2025, precipitation rose 0.081 mm/day per decade at Coropuna (p = 0.001) but fell 0.32 mm/day per decade at Salonga (p = 0.008). One variable, two regions, opposite trends. | 2/5 · The evidence: one value per year, so the seasons cancel out. The dashed line is the trend. | 3/5 · The verdict: several tests check whether the change could be chance. Each ✓ is a check passed. | 4/5 · The case file keeps the data, the source and the method, so anyone can check it. | 5/5 · Your turn: pick a place and a variable, make a hunch, and investigate.
- **Tab / duration:** main / 5615 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 013 Demo 1: start and Next — A confirmed trend at Coropuna

- **Expected:** Tour overlay opens; Next advances its visible step counter and view.
- **Actual:** 1/4 · The evidence: one value per year, so the seasons cancel out. The dashed line is the trend. From 1981 to 2025, air temperature at Coropuna rose 0.24 °C per decade (p < 0.001). With data up to 2006, the trend was already significant, and it has stayed significant every year since. → 2/4 · The verdict: several tests check whether the change could be chance. Each ✓ is a check passed.
- **Tab / duration:** main / 3465 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 014 Demo 1: Pause

- **Expected:** Pause changes to Play and prevents auto-advance over the normal 9-second interval.
- **Actual:** Paused for 9.4 seconds: 2/4 · The verdict: several tests check whether the change could be chance. Each ✓ is a check passed.
- **Tab / duration:** main / 9583 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 015 Demo 1: resume and Exit

- **Expected:** Play changes to Pause; Exit removes the tour overlay.
- **Actual:** Tour resumed and exited.
- **Tab / duration:** main / 30 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 016 Demo 1: every remaining step and Close

- **Expected:** Every tour step has text and an active view; final Close hides the tour.
- **Actual:** 1/4 · The evidence: one value per year, so the seasons cancel out. The dashed line is the trend. From 1981 to 2025, air temperature at Coropuna rose 0.24 °C per decade (p < 0.001). With data up to 2006, the trend was already significant, and it has stayed significant every year since. | 2/4 · The verdict: several tests check whether the change could be chance. Each ✓ is a check passed. | 3/4 · The case file keeps the data, the source and the method, so anyone can check it. | 4/4 · Your turn: pick a place and a variable, make a hunch, and investigate.
- **Tab / duration:** main / 4018 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 017 Demo 2: start and Next — Not yet known at Cape of Good Hope

- **Expected:** Tour overlay opens; Next advances its visible step counter and view.
- **Actual:** 1/4 · The evidence: one value per year, so the seasons cancel out. The dashed line is the trend. From 2001 to 2025, aerosol optical depth at Cape of Good Hope rose 0.0034 per decade (p = 0.106): not significant yet. If the trend and the noise stay the same, about 9 more years of data would settle it. → 2/4 · The verdict: several tests check whether the change could be chance. Each ✓ is a check passed.
- **Tab / duration:** main / 2770 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 018 Demo 2: Pause

- **Expected:** Pause changes to Play and prevents auto-advance over the normal 9-second interval.
- **Actual:** Paused for 9.4 seconds: 2/4 · The verdict: several tests check whether the change could be chance. Each ✓ is a check passed.
- **Tab / duration:** main / 11420 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 019 Demo 2: resume and Exit

- **Expected:** Play changes to Pause; Exit removes the tour overlay.
- **Actual:** Tour resumed and exited.
- **Tab / duration:** main / 1153 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 020 Demo 2: every remaining step and Close

- **Expected:** Every tour step has text and an active view; final Close hides the tour.
- **Actual:** 1/4 · The evidence: one value per year, so the seasons cancel out. The dashed line is the trend. From 2001 to 2025, aerosol optical depth at Cape of Good Hope rose 0.0034 per decade (p = 0.106): not significant yet. If the trend and the noise stay the same, about 9 more years of data would settle it. | 2/4 · The verdict: several tests check whether the change could be chance. Each ✓ is a check passed. | 3/4 · The case file keeps the data, the source and the method, so anyone can check it. | 4/4 · Your turn: pick a place and a variable, make a hunch, and investigate.
- **Tab / duration:** main / 5326 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 021 Case kind chip: All

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["coropuna","quelccaya","huascaran","zongo"],"count":"1 / 232 · 927 places"}
- **Tab / duration:** main / 788 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 022 Case kind chip: Glaciers

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["coropuna","quelccaya","huascaran","zongo"],"count":"1 / 11 · 44 places"}
- **Tab / duration:** main / 1977 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 023 Case kind chip: Polar

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["north_pole","south_pole","vostok","alert"],"count":"1 / 4 · 13 places"}
- **Tab / duration:** main / 193 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 024 Case kind chip: Tundra

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["yamal","alaska_north_slope","baffin_island","sumapaz_paramo"],"count":"1 / 3 · 9 places"}
- **Tab / duration:** main / 1184 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 025 Case kind chip: Volcanoes

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["el_misti","etna","mauna_loa","ubinas"],"count":"1 / 91 · 363 places"}
- **Tab / duration:** main / 1195 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 026 Case kind chip: Deserts

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["atacama","sahara","gobi","medanos_de_coro_national_park"],"count":"1 / 7 · 26 places"}
- **Tab / duration:** main / 1193 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 027 Case kind chip: Savannas

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["serengeti","cerrado","sahel","parana_flooded_savanna"],"count":"1 / 2 · 7 places"}
- **Tab / duration:** main / 1221 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 028 Case kind chip: Rainforests

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["amazon","congo","daintree","central_suriname_nature_reserve"],"count":"1 / 4 · 13 places"}
- **Tab / duration:** main / 3015 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 029 Case kind chip: Wetlands

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["pantanal","sundarbans","okavango","complejo_de_humedales_del_abanico_del_rio_pastaza"],"count":"1 / 5 · 18 places"}
- **Tab / duration:** main / 567 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 030 Case kind chip: Lakes

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["lake_titicaca","aral_sea","lake_chad","lake_baikal"],"count":"1 / 46 · 184 places"}
- **Tab / duration:** main / 1223 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 031 Case kind chip: Rivers

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["amazon_river","mississippi_river","lena_river","mackenzie_river"],"count":"1 / 16 · 63 places"}
- **Tab / duration:** main / 1162 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 032 Case kind chip: Coasts

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["cape_good_hope","cape_horn","cape_byron","cabo_frio"],"count":"1 / 6 · 24 places"}
- **Tab / duration:** main / 1121 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 033 Case kind chip: Coral reefs

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["great_barrier_reef","glovers_reef","elphinstone_reef","amazon_reef"],"count":"1 / 2 · 7 places"}
- **Tab / duration:** main / 1160 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 034 Case kind chip: Oceans

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["pacific","atlantic","indian","caribbean_sea"],"count":"1 / 6 · 23 places"}
- **Tab / duration:** main / 1707 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 035 Case kind chip: Cities

- **Expected:** The selected chip is pressed; all visible place cards match its kind.
- **Actual:** {"pressed":"true","ids":["arequipa","tokyo","london","greater_buenos_aires"],"count":"1 / 34 · 133 places"}
- **Tab / duration:** main / 639 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 036 Case country filter: Peru

- **Expected:** Choosing Peru shows only Peruvian places; clearing restores the larger list.
- **Actual:** 1 / 11 · 41 places
- **Tab / duration:** main / 999 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 037 Case search: name

- **Expected:** Searching Coropuna shows its place card, and no unrelated cards.
- **Actual:** 1 / 1 · 1 places
- **Tab / duration:** main / 1334 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 038 Case card: photo and credit popup

- **Expected:** Clicking Coropuna opens an onscreen popup with loaded photo, name and attribution/source.
- **Actual:** Nevado Coropuna (Peru) · Photo: Edubucher, CC BY-SA 3.0, via Wikimedia Commons · source
- **Tab / duration:** main / 2138 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 039 Case search: lat, lon + Enter

- **Expected:** Enter selects the exact typed coordinates and shows Selected point in the popup.
- **Actual:** {"lat":"12.3456","lon":"45.6789"}
- **Tab / duration:** main / 707 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 040 Case pager: Next and Previous

- **Expected:** Next changes cards/page count; Previous restores the exact first cards.
- **Actual:** coropuna,quelccaya,huascaran,zongo → chimborazo,perito-moreno,columbia,jakobshavn → coropuna,quelccaya,huascaran,zongo
- **Tab / duration:** main / 2976 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 041 Case variable chip and definition: T2M

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Air temperature: The average air temperature two meters above the ground.
- **Tab / duration:** main / 753 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 042 Case variable chip and definition: T2M_MAX

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Monthly highs: The highest hourly air temperature in each month, measured two meters above the surface.
- **Tab / duration:** main / 401 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 043 Case variable chip and definition: T2M_MIN

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Monthly lows: The lowest hourly air temperature in each month, measured two meters above the surface.
- **Tab / duration:** main / 457 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 044 Case variable chip and definition: TS

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Ground temperature: The temperature of the surface itself, rather than the air above it.
- **Tab / duration:** main / 302 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 045 Case variable chip and definition: PRECTOTCORR

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Rain and snow: The average water falling as rain and snow each day, with a correction for measurement bias.
- **Tab / duration:** main / 884 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 046 Case variable chip and definition: EVLAND

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Evaporation: The water that returns to the air from land and plants each day.
- **Tab / duration:** main / 887 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 047 Case variable chip and definition: GWETTOP

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Topsoil moisture: How wet the upper soil layer is, from zero for dry to one for saturated.
- **Tab / duration:** main / 1176 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 048 Case variable chip and definition: GWETROOT

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Root soil moisture: How wet the soil around plant roots is, from zero for dry to one for saturated.
- **Tab / duration:** main / 480 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 049 Case variable chip and definition: SNODP

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Snow depth: The depth of snow covering the land surface.
- **Tab / duration:** main / 379 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 050 Case variable chip and definition: RH2M

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Humidity: The water vapor in the air as a percentage of what it could hold at that temperature.
- **Tab / duration:** main / 366 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 051 Case variable chip and definition: QV2M

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Water vapor: The mass of water vapor in each kilogram of air two meters above the ground.
- **Tab / duration:** main / 437 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 052 Case variable chip and definition: ALLSKY_SFC_SW_DWN

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Sunlight: The solar energy reaching the surface each day, including the effect of clouds.
- **Tab / duration:** main / 498 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 053 Case variable chip and definition: CLOUD_AMT

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Cloud cover: The percentage of the sky covered by clouds.
- **Tab / duration:** main / 538 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 054 Case variable chip and definition: WS2M

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Wind: How fast the wind blows two meters above the ground.
- **Tab / duration:** main / 811 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 055 Case variable chip and definition: AOD_55

- **Expected:** The variable radio is checked and its visible definition matches catalog metadata.
- **Actual:** Haze (dust and smoke): How much airborne dust, smoke, and other particles weaken light at a wavelength of 550 nanometers.
- **Tab / duration:** main / 380 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 063 Keyboard case: main controls and visible focus

- **Expected:** Tab reaches #place-search, #country, #case-form button[type="submit"], #scan with a visible focus outline or ring.
- **Actual:** Reached all controls; 22 Tab presses. [{"id":"place-search","tag":"INPUT","text":"","ring":true,"matched":["#place-search"]},{"id":"country","tag":"SELECT","text":"All countries\nAfghanistan\nAlbania\nAlgeria\nAndorra\nAngola\nAnt","ring":true,"matched":["#country"]},{"id":"","tag":"BUTTON","text":"Investigate","ring":true,"matched":["#case-form button[type=\"submit\"]"]},{"id":"scan","tag":"BUTTON","text":"Scan everything here","ring":true,"matched":["#scan"]}]
- **Tab / duration:** main / 884 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 064 Evidence direction: good, one reveal and no double score

- **Expected:** Visible good feedback, one revealed statistic, and repeated clicks add no points.
- **Actual:** ✓ Good eye! +1 point. The ups and downs hide any steady change. · -0.011 mm/day per decade · points 0→1
- **Tab / duration:** main / 6955 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 065 Evidence direction: close, one reveal and no double score

- **Expected:** Visible close feedback, one revealed statistic, and repeated clicks add no points.
- **Actual:** ≈ Close: the line does tilt that way, but the change is too small to tell apart from normal ups and downs. No points this time. · -0.011 mm/day per decade · points 1→1
- **Tab / duration:** main / 5892 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 066 Evidence direction: miss, one reveal and no double score

- **Expected:** Visible miss feedback, one revealed statistic, and repeated clicks add no points.
- **Actual:** ✗ Not quite. Follow the dashed line from 1981 to 2025: it stays almost flat compared with the ups and downs. Detectives learn from misses! · -0.011 mm/day per decade · points 1→1
- **Tab / duration:** main / 4533 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 070 Keyboard evidence: main controls and visible focus

- **Expected:** Tab reaches [data-trend="up"], #view-evidence a[href="#/projection"], #view-evidence a[href="#/verdict"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 7 Tab presses. [{"id":"","tag":"BUTTON","text":"↗ Rising","ring":true,"matched":["[data-trend=\"up\"]"]},{"id":"","tag":"A","text":"Projection","ring":true,"matched":["#view-evidence a[href=\"#/projection\"]"]},{"id":"","tag":"A","text":"See the verdict","ring":true,"matched":["#view-evidence a[href=\"#/verdict\"]"]}]
- **Tab / duration:** main / 393 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 071 Evidence: data table and sources details

- **Expected:** Opening Data and sources shows all yearly rows and a source caption.
- **Actual:** 45 annual rows; Rain and snow (Precipitation, PRECTOTCORR): annual mean. Trend: Sen's slope. Source: NASA POWER · MERRA-2.
- **Tab / duration:** main / 931 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 072 Projection: uncertainty band or No projection

- **Expected:** Projection renders a real band with a range, or explicitly says No projection with a reason.
- **Actual:** No projection; polygons=0; This trend is not reliable enough to extend: the change is not clear yet.
- **Tab / duration:** main / 551 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 076 Keyboard projection: main controls and visible focus

- **Expected:** Tab reaches #view-projection a[href="#/evidence"], #view-projection a[href="#/verdict"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 2 Tab presses. [{"id":"","tag":"A","text":"Back","ring":true,"matched":["#view-projection a[href=\"#/evidence\"]"]},{"id":"","tag":"A","text":"See the verdict","ring":true,"matched":["#view-projection a[href=\"#/verdict\"]"]}]
- **Tab / duration:** main / 433 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 077 Projection: Back and browser history back/forward

- **Expected:** Page.navigateToHistoryEntry restores evidence and then projection without losing the case.
- **Actual:** History back → evidence; forward → projection; Back → evidence.
- **Tab / duration:** main / 2823 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 078 Verdict answer unknown: good, one reveal and no double score

- **Expected:** Visible good feedback and verdict; only 2 points, including repeated clicks.
- **Actual:** ✓ Great call! +2 points: the ups and downs are too big for the change to stand out yet. · score 1→3
- **Tab / duration:** main / 7349 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 080 Verdict answer confirmed: miss, one reveal and no double score

- **Expected:** Visible miss feedback and verdict; only 0 points, including repeated clicks.
- **Actual:** ✗ The tests disagree: the ups and downs are too big for the change to stand out yet. Open the clues to see why. · score 3→3
- **Tab / duration:** main / 5715 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 081 Verdict: every clue opens

- **Expected:** Each clue button hides and its explanation becomes visible exactly once.
- **Actual:** 5 clue explanations opened.
- **Tab / duration:** main / 1713 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 082 Verdict: statistics details

- **Expected:** The statistics disclosure opens with numerical slope, p and methods.
- **Actual:** Years analyzed: 45 (1981–2025), one mean per year to remove the seasonal cycle. Sen's slope: -0.011 mm/day/decade (95% interval: -0.17 to +0.15). Mann-Kendall test with the Hamed & Rao (1998) autocorrelation correction: p = 0.902; Kendall's τ = -0.02. Second test: linear regression t-test with the effective sample size for autocorrelation (Santer et al. 2000): -0.012 mm/day/decade (95% interval -0.18 to +0.15), p = 0.887. Verdict (Mann-Kendall): confirmed if p < 0.05; likely if p < 0.10; otherwise not yet known. Prediction test: trend fitted to 1981–2010; skill on 2011–2025 versus the training mean = -0.87 (mean absolute error). Alibi, El Niño (ONI) (NOAA Climate Prediction Center): explains
- **Tab / duration:** main / 482 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 086 Keyboard verdict: main controls and visible focus

- **Expected:** Tab reaches #lineup-start, #compare-start, #view-verdict a[href="#/record"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 5 Tab presses. [{"id":"lineup-start","tag":"BUTTON","text":"Spot the real one","ring":true,"matched":["#lineup-start"]},{"id":"compare-start","tag":"BUTTON","text":"Compare","ring":true,"matched":["#compare-start"]},{"id":"","tag":"A","text":"Case file","ring":true,"matched":["#view-verdict a[href=\"#/record\"]"]}]
- **Tab / duration:** main / 398 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 087 Case file: open and download

- **Expected:** Case file has provenance rows; Page.setDownloadBehavior allows a valid JSON download.
- **Actual:** run-2026-11-15T03-37-25-249Z/downloads/case_PRECTOTCORR_32.315_-90.9058.json; 45 rows; verdict=unknown
- **Tab / duration:** main / 2337 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 091 Keyboard record: main controls and visible focus

- **Expected:** Tab reaches #download, #view-record a[href="#/verdict"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 2 Tab presses. [{"id":"","tag":"A","text":"Back","ring":true,"matched":["#view-record a[href=\"#/verdict\"]"]},{"id":"download","tag":"BUTTON","text":"Download","ring":true,"matched":["#download"]}]
- **Tab / duration:** main / 41 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 092 Case file: Back

- **Expected:** Back returns to the same verdict.
- **Actual:** ○ Not yet known
- **Tab / duration:** main / 1241 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 093 Lineup: pick and one result only

- **Expected:** Nine series appear; selecting a series reveals the real one; repeat selection changes nothing.
- **Actual:** The real one was number 3. It hides easily among the shuffled ones: its trend is hard to tell from chance, which is exactly what a "Not yet known" verdict means.
- **Tab / duration:** main / 1413 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 097 Keyboard lineup: main controls and visible focus

- **Expected:** Tab reaches #lineup-grid [data-i="0"], #view-lineup a[href="#/verdict"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 10 Tab presses. [{"id":"","tag":"BUTTON","text":"1","ring":true,"matched":["#lineup-grid [data-i=\"0\"]"]},{"id":"","tag":"A","text":"Back","ring":true,"matched":["#view-lineup a[href=\"#/verdict\"]"]}]
- **Tab / duration:** main / 412 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 098 Lineup: Back

- **Expected:** Back restores verdict.
- **Actual:** Verdict visible.
- **Tab / duration:** main / 571 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 099 Compare: start, pick second bundled place and result

- **Expected:** Compare banner opens; second place produces two charts and a comparison summary without POWER.
- **Actual:** Air temperature: Nevado Coropuna (Peru) vs. Jakobshavn Glacier (Greenland); Same direction: air temperature rises in both places, at 0.24 and 0.53 °C per decade.
- **Tab / duration:** main / 8299 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 103 Keyboard compare: main controls and visible focus

- **Expected:** Tab reaches #view-compare a[href="#/case"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 1 Tab presses. [{"id":"","tag":"A","text":"New case","ring":true,"matched":["#view-compare a[href=\"#/case\"]"]}]
- **Tab / duration:** main / 38 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 104 Compare: New case

- **Expected:** New case returns to picker.
- **Actual:** 1 / 1 · 1 places
- **Tab / duration:** main / 1449 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 105 Hunch: evidence and clue

- **Expected:** A correct no-change hunch is recorded and its explanation opens.
- **Actual:** 🔍 The clock 🔍 Ask a second test 🔍 Test it on the past 🔍 Check the alibi: El Niño 🔍 Question a second witness ✓ Your hunch was right
- **Tab / duration:** main / 4799 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 106 Evidence: Back

- **Expected:** Evidence Back returns to case picker.
- **Actual:** Picker visible.
- **Tab / duration:** main / 642 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 107 Scan everything: blocked POWER friendly message

- **Expected:** Fetch.failRequest blocks POWER; a friendly busy message stays visible on the case form.
- **Actual:** The scan could not be completed. NASA POWER is busy right now (too many requests). Wait a minute and try again, or pick a place from the list: their main series are stored in the app. · blocked=1
- **Tab / duration:** main / 909 ms
- **Console errors/exceptions:** `POWER blocked (expected)`: https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,T2M_MAX,T2M_MIN,TS,PRECTOTCORR,EVLAND,GWETTOP,GWETROOT,SNODP,RH2M&community=AG&longitude=45.6789&latitude=12.3456&start=1981&end=2025&format=JSON · `browser-error`: Failed to load resource: net::ERR_FAILED (https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,T2M_MAX,T2M_MIN,TS,PRECTOTCORR,EVLAND,GWETTOP,GWETROOT,SNODP,RH2M&community=AG&longitude=45.6789&latitude=12.3456&start=1981&end=2025&format=JSON)
- **Screenshot:** not needed (PASS)

## PASS · major · 108 Global: open and variable groups

- **Expected:** Both near-ground and upper-air/land-water groups contain options.
- **Actual:** [{"label":"Near the ground · NASA POWER","ids":["T2M","T2M_MAX","T2M_MIN","TS","PRECTOTCORR","EVLAND","GWETTOP","GWETROOT","SNODP","RH2M","QV2M","ALLSKY_SFC_SW_DWN","CLOUD_AMT","WS2M","AOD_55"]},{"label":"Higher in the sky, and land water · NASA","ids":["T850","T500","T250","TO3","TQV","T850_AIRS","T500_AIRS","TO3_AIRS","TQV_AIRS","RUNOFF","EVAP","SOILMOI"]}]
- **Tab / duration:** main / 528 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 109 Global variable group: Near the ground · NASA POWER

- **Expected:** The selected map has a heading, three finite area shares and a numeric colour legend.
- **Actual:** {"heading":"Air temperature: where is it changing?","scale":"Orange: rising · blue: falling · full colour = 0.63 °C/decade or more.","shares":[67,4,29],"regions":8}
- **Tab / duration:** main / 1115 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 110 Global variable group: Higher in the sky, and land water · NASA

- **Expected:** The selected map has a heading, three finite area shares and a numeric colour legend.
- **Actual:** {"heading":"Air temperature 1.5 km up: where is it changing?","scale":"Orange: rising · blue: falling · full colour = 0.50 °C/decade or more.","shares":[69,1,30],"regions":8}
- **Tab / duration:** main / 398 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 114 Keyboard global: main controls and visible focus

- **Expected:** Tab reaches #global-var, #regions button:first-child, #view-global a[href="#/home"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 11 Tab presses. [{"id":"global-var","tag":"SELECT","text":"Air temperature\nMonthly highs\nMonthly lows\nGround temperatur","ring":true,"matched":["#global-var"]},{"id":"","tag":"BUTTON","text":"Whole planet +0.21 °C/decade\n● Confirmed","ring":true,"matched":["#regions button:first-child"]},{"id":"","tag":"BUTTON","text":"All land areas +0.26 °C/decade\n● Confirmed","ring":true,"matched":["#regions button:first-child"]},{"id":"","tag":"BUTTON","text":"All oceans +0.19 °C/decade\n● Confirmed","ring":true,"matched":["#regions button:first-child"]},{"id":"","tag":"BUTTON","text":"Tropics +0.22 °C/decade\n● Confirmed","ring":true,"matched":["#regions button:first-child"]},{"id":"","tag":"BUTTON","text":"Northern mid-latitudes +0.29 °C/decade\n● Confirmed","ring":true,"matched":["#regions button:first-child"]},{"id":"","tag":"BUTTON","text":"Southern mid-latitudes +0.15 °C/decade\n◐ Likely","ring":true,"matched":["#regions button:first-child"]},{"id":"","tag":"BUTTON","text":"Arctic +0.43 °C/decade\n● Confirmed","ring":true,"matched":["#regions button:first-child"]},{"id":"","tag":"BUTTON","text":"Antarctic -0.013 °C/decade\n○ Not yet known","ring":true,"matched":["#regions button:first-child"]},{"id":"","tag":"A","text":"Back","ring":true,"matched":["#view-global a[href=\"#/home\"]"]}]
- **Tab / duration:** main / 607 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 115 Global region opens a bundled case

- **Expected:** A region button opens visible evidence with a chart and region name, without POWER.
- **Actual:** Air temperature 1.5 km up · The whole planet
- **Tab / duration:** main / 963 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 116 Global Back returns home

- **Expected:** Back on the global monitor returns home.
- **Actual:** Home visible.
- **Tab / duration:** main / 1048 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 117 Earth to Moon switch

- **Expected:** Moon panel and globe become visible; Earth globe hides and world buttons update.
- **Actual:** {"moon":"true","earth":"false","earthHidden":true,"moonHidden":false}
- **Tab / duration:** main / 3334 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 118 Moon layer toggle: Seas and lakes

- **Expected:** The visible layer chip toggles its pressed state off/on and restores the original setting.
- **Actual:** Restored seas=true
- **Tab / duration:** main / 814 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 119 Moon layer toggle: Mountains and valleys

- **Expected:** The visible layer chip toggles its pressed state off/on and restores the original setting.
- **Actual:** Restored mountains=true
- **Tab / duration:** main / 620 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 120 Moon layer toggle: Craters

- **Expected:** The visible layer chip toggles its pressed state off/on and restores the original setting.
- **Actual:** Restored craters=false
- **Tab / duration:** main / 1045 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 121 Moon layer toggle: Landing sites

- **Expected:** The visible layer chip toggles its pressed state off/on and restores the original setting.
- **Actual:** Restored landing=true
- **Tab / duration:** main / 421 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 125 Keyboard moon: main controls and visible focus

- **Expected:** Tab reaches #moon-cases button, #moon-layers [data-layer="seas"], #back-earth with a visible focus outline or ring.
- **Actual:** Reached all controls; 13 Tab presses. [{"id":"","tag":"BUTTON","text":"Ocean tides\nProven","ring":true,"matched":["#moon-cases button"]},{"id":"","tag":"BUTTON","text":"Coral spawning\nProven","ring":true,"matched":["#moon-cases button"]},{"id":"","tag":"BUTTON","text":"Rain and air temperature\nWeak effect","ring":true,"matched":["#moon-cases button"]},{"id":"","tag":"BUTTON","text":"★ Glaciers: the special case\nOpen question","ring":true,"matched":["#moon-cases button"]},{"id":"","tag":"BUTTON","text":"Seas and lakes","ring":true,"matched":["#moon-layers [data-layer=\"seas\"]"]},{"id":"back-earth","tag":"BUTTON","text":"Back to Earth","ring":true,"matched":["#back-earth"]}]
- **Tab / duration:** main / 43 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 127 Mobile Earth/Moon switch remains clickable

- **Expected:** At 390x844 both switch buttons are uncovered; real clicks move Moon ? Earth ? Moon.
- **Actual:** {"hits":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"screenshot":"run-2026-11-15T03-37-25-249Z/mobile-world-switch.png"}
- **Tab / duration:** main / 1455 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/mobile-world-switch.png)

## PASS · major · 128 Moon flat series: Kilimanjaro snow depth

- **Expected:** Bundled constant snow depth shows Nothing to test here, explains no annual variation and leaves no result chart.
- **Actual:** Nothing to test here ? Snow depth at Kilimanjaro does not vary from year to year (for example, no snow at all), so there are no ups and downs for the Moon to explain. Try another variable. ? screenshot=run-2026-11-15T03-37-25-249Z/moon-flat-series.png
- **Tab / duration:** main / 1290 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/moon-flat-series.png)

## PASS · major · 129 Moon–Earth case opens: tides

- **Expected:** The selected case has its own visible heading, introduction, and applicable controls or quiz.
- **Actual:** The Moon raises two bulges of ocean water, so most coasts get two high tides a day. Over 18.6 years the tides grow and shrink a little. Test it with 100 years of tide gauges.
- **Tab / duration:** main / 342 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 130 Moon tides: bundled run Boston tide gauge (1922–2025)

- **Expected:** The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.
- **Actual:** Moon-like signal (p = 0.001) · Tidal range at Boston, 1922–2025: the Moon's rhythm lines up with 90% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: -16.55 cm. A signal is not proof of cause. Source: NOAA CO-OPS tide gauge (monthly mean high and low water).
- **Tab / duration:** main / 205 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 131 Moon tides: bundled run The Battery tide gauge (1921–2025)

- **Expected:** The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.
- **Actual:** Moon-like signal (p = 0.001) · Tidal range at The Battery, 1921–2025: the Moon's rhythm lines up with 88% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: -9.78 cm. A signal is not proof of cause. Source: NOAA CO-OPS tide gauge (monthly mean high and low water).
- **Tab / duration:** main / 180 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 132 Moon tides: bundled run San Francisco tide gauge (1898–2025)

- **Expected:** The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.
- **Actual:** Moon-like signal (p = 0.001) · Tidal range at San Francisco, 1898–2025: the Moon's rhythm lines up with 39% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: -4.24 cm. A signal is not proof of cause. Source: NOAA CO-OPS tide gauge (monthly mean high and low water).
- **Tab / duration:** main / 241 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 133 Moon tides: bundled run Honolulu tide gauge (1912–2025)

- **Expected:** The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.
- **Actual:** Moon-like signal (p = 0.035) · Tidal range at Honolulu, 1912–2025: the Moon's rhythm lines up with 8% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: +0.93 cm. A signal is not proof of cause. Source: NOAA CO-OPS tide gauge (monthly mean high and low water).
- **Tab / duration:** main / 349 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 134 Moon tides: bundled run Seattle tide gauge (1899–2025)

- **Expected:** The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.
- **Actual:** Moon-like signal (p = 0.001) · Tidal range at Seattle, 1899–2025: the Moon's rhythm lines up with 93% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: -8.60 cm. A signal is not proof of cause. Source: NOAA CO-OPS tide gauge (monthly mean high and low water).
- **Tab / duration:** main / 253 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 135 Moon tides: bundled run Key West tide gauge (1926–2025)

- **Expected:** The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.
- **Actual:** Moon-like signal (p = 0.003) · Tidal range at Key West, 1926–2025: the Moon's rhythm lines up with 34% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: -1.04 cm. A signal is not proof of cause. Source: NOAA CO-OPS tide gauge (monthly mean high and low water).
- **Tab / duration:** main / 305 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 136 Moon tides: bundled run Portland tide gauge (1912–2025)

- **Expected:** The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.
- **Actual:** Moon-like signal (p = 0.001) · Tidal range at Portland, 1912–2025: the Moon's rhythm lines up with 88% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: -15.06 cm. A signal is not proof of cause. Source: NOAA CO-OPS tide gauge (monthly mean high and low water).
- **Tab / duration:** main / 241 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 137 Moon tides: bundled run Baltimore tide gauge (1903–2025)

- **Expected:** The tide-gauge test renders a numerical result, comparison chart and NOAA source without POWER.
- **Actual:** Moon-like signal (p = 0.001) · Tidal range at Baltimore, 1903–2025: the Moon's rhythm lines up with 29% of the year-to-year ups and downs (after removing the trend). From minor to major standstill: -1.53 cm. A signal is not proof of cause. Source: NOAA CO-OPS tide gauge (monthly mean high and low water).
- **Tab / duration:** main / 301 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 141 Keyboard lunar: main controls and visible focus

- **Expected:** Tab reaches #lunar-place, #lunar-var, #lunar-run, #view-lunar a[href="#/moon"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 9 Tab presses. [{"id":"lunar-place","tag":"SELECT","text":"Boston tide gauge (1922–2025)\nThe Battery tide gauge (1921–2","ring":true,"matched":["#lunar-place"]},{"id":"lunar-var","tag":"SELECT","text":"Tidal range","ring":true,"matched":["#lunar-var"]},{"id":"lunar-run","tag":"BUTTON","text":"Test","ring":true,"matched":["#lunar-run"]},{"id":"","tag":"A","text":"Back","ring":true,"matched":["#view-lunar a[href=\"#/moon\"]"]}]
- **Tab / duration:** main / 41 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 142 Moon–Earth case opens: corals

- **Expected:** The selected case has its own visible heading, introduction, and applicable controls or quiz.
- **Actual:** On many reefs, corals release their eggs together a few nights after a full moon. Moonlight is one of the clocks they use.
- **Tab / duration:** main / 431 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 143 Moon–Earth case opens: rain

- **Expected:** The selected case has its own visible heading, introduction, and applicable controls or quiz.
- **Actual:** Studies find tiny lunar effects on rain and air pressure. Can you see the 18.6-year rhythm in the climate of a place?
- **Tab / duration:** main / 229 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 144 Moon rain: bundled Coropuna run and guess

- **Expected:** A bundled glacier/climate test shows a chart, result, and guess feedback without any live POWER request.
- **Actual:** No lunar signal found (p = 0.246) · ✗ Your guess did not match the test. That is how real research goes!
- **Tab / duration:** main / 408 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 145 Moon–Earth case opens: glaciers

- **Expected:** The selected case has its own visible heading, introduction, and applicable controls or quiz.
- **Actual:** Does the Moon's 18.6-year rhythm leave a mark on the climate of glaciers? This is an open research question (the author's thesis). Test it with NASA data.
- **Tab / duration:** main / 323 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 146 Moon glaciers: bundled Coropuna run and guess

- **Expected:** A bundled glacier/climate test shows a chart, result, and guess feedback without any live POWER request.
- **Actual:** No lunar signal found (p = 0.246) · ✗ Your guess did not match the test. That is how real research goes!
- **Tab / duration:** main / 237 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 147 Discovery quiz tides: right and repeated click

- **Expected:** The correct choice produces visible Right feedback; repeating the click awards nothing further.
- **Actual:** ✓ Right! +1 point. Two: the Moon pulls a bulge of water toward it, and another bulge forms on the far side of the Earth.
- **Tab / duration:** main / 904 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 148 Discovery quiz tides: wrong after reopening

- **Expected:** A wrong choice gives visible Not this time feedback and no points.
- **Actual:** ✗ Not this time. Two: the Moon pulls a bulge of water toward it, and another bulge forms on the far side of the Earth.
- **Tab / duration:** main / 399 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 149 Discovery quiz tides: right again after reopening

- **Expected:** The right answer may be reviewed but cannot score again in the same page session.
- **Actual:** ✓ Right! Two: the Moon pulls a bulge of water toward it, and another bulge forms on the far side of the Earth.
- **Tab / duration:** main / 461 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 150 Discovery quiz corals: right and repeated click

- **Expected:** The correct choice produces visible Right feedback; repeating the click awards nothing further.
- **Actual:** ✓ Right! +1 point. A few nights after a full moon: moonlight helps thousands of corals spawn on the same night.
- **Tab / duration:** main / 627 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 151 Discovery quiz corals: wrong after reopening

- **Expected:** A wrong choice gives visible Not this time feedback and no points.
- **Actual:** ✗ Not this time. A few nights after a full moon: moonlight helps thousands of corals spawn on the same night.
- **Tab / duration:** main / 466 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 152 Discovery quiz corals: right again after reopening

- **Expected:** The right answer may be reviewed but cannot score again in the same page session.
- **Actual:** ✓ Right! A few nights after a full moon: moonlight helps thousands of corals spawn on the same night.
- **Tab / duration:** main / 407 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 153 Discovery quiz moon_recession: right and repeated click

- **Expected:** The correct choice produces visible Right feedback; repeating the click awards nothing further.
- **Actual:** ✓ Right! +1 point. The distance changes during each orbit. Long records let scientists separate those repeating changes from the slow outward drift.
- **Tab / duration:** main / 739 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 154 Discovery quiz moon_recession: wrong after reopening

- **Expected:** A wrong choice gives visible Not this time feedback and no points.
- **Actual:** ✗ Not this time. The distance changes during each orbit. Long records let scientists separate those repeating changes from the slow outward drift.
- **Tab / duration:** main / 536 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 155 Discovery quiz moon_recession: right again after reopening

- **Expected:** The right answer may be reviewed but cannot score again in the same page session.
- **Actual:** ✓ Right! The distance changes during each orbit. Long records let scientists separate those repeating changes from the slow outward drift.
- **Tab / duration:** main / 426 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 156 Discovery quiz new_craters: right and repeated click

- **Expected:** The correct choice produces visible Right feedback; repeating the click awards nothing further.
- **Actual:** ✓ Right! +1 point. A higher count than a model predicts does not prove impacts are becoming more frequent. Before-and-after images show that new craters formed.
- **Tab / duration:** main / 642 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 157 Discovery quiz new_craters: wrong after reopening

- **Expected:** A wrong choice gives visible Not this time feedback and no points.
- **Actual:** ✗ Not this time. A higher count than a model predicts does not prove impacts are becoming more frequent. Before-and-after images show that new craters formed.
- **Tab / duration:** main / 403 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 158 Discovery quiz new_craters: right again after reopening

- **Expected:** The right answer may be reviewed but cannot score again in the same page session.
- **Actual:** ✓ Right! A higher count than a model predicts does not prove impacts are becoming more frequent. Before-and-after images show that new craters formed.
- **Tab / duration:** main / 435 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 159 Discovery quiz impact_flashes: right and repeated click

- **Expected:** The correct choice produces visible Right feedback; repeating the click awards nothing further.
- **Actual:** ✓ Right! +1 point. A flash seen by separate telescopes is less likely to be a cosmic ray or camera glitch. Repeated checks make the evidence stronger.
- **Tab / duration:** main / 698 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 160 Discovery quiz impact_flashes: wrong after reopening

- **Expected:** A wrong choice gives visible Not this time feedback and no points.
- **Actual:** ✗ Not this time. A flash seen by separate telescopes is less likely to be a cosmic ray or camera glitch. Repeated checks make the evidence stronger.
- **Tab / duration:** main / 487 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 161 Discovery quiz impact_flashes: right again after reopening

- **Expected:** The right answer may be reviewed but cannot score again in the same page session.
- **Actual:** ✓ Right! A flash seen by separate telescopes is less likely to be a cosmic ray or camera glitch. Repeated checks make the evidence stronger.
- **Tab / duration:** main / 474 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 162 Discovery quiz apollo_moonquakes: right and repeated click

- **Expected:** The correct choice produces visible Right feedback; repeating the click awards nothing further.
- **Actual:** ✓ Right! +1 point. Better analysis can reveal missed events in old records. A larger catalog does not show that the Moon is shaking more often today.
- **Tab / duration:** main / 1031 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 163 Discovery quiz apollo_moonquakes: wrong after reopening

- **Expected:** A wrong choice gives visible Not this time feedback and no points.
- **Actual:** ✗ Not this time. Better analysis can reveal missed events in old records. A larger catalog does not show that the Moon is shaking more often today.
- **Tab / duration:** main / 472 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 164 Discovery quiz apollo_moonquakes: right again after reopening

- **Expected:** The right answer may be reviewed but cannot score again in the same page session.
- **Actual:** ✓ Right! Better analysis can reveal missed events in old records. A larger catalog does not show that the Moon is shaking more often today.
- **Tab / duration:** main / 433 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 165 Lunar case Back → Moon and Moon → Earth

- **Expected:** Back returns to Moon; Earth restores the home panel and Earth globe.
- **Actual:** Lunar → Moon → Earth/home.
- **Tab / duration:** main / 531 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 166 Moon Back to Earth button

- **Expected:** Back to Earth restores home and pressed Earth world switch.
- **Actual:** Earth/home visible.
- **Tab / duration:** main / 2582 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 167 Score farming: replay identical case twice

- **Expected:** A second identical completed case does not re-award the same direction/verdict points.
- **Actual:** Point gains: 0,0
- **Tab / duration:** main / 10736 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 168 Score chip and rank persist after reload

- **Expected:** Exact score/rank text survives a page reload and agrees with the public rank thresholds.
- **Actual:** 🕵 10 pts · Junior detective
- **Tab / duration:** main / 3722 ms
- **Console errors/exceptions:** `browser-error`: Failed to load resource: the server responded with a status of 404 (File not found) (http://localhost:8765/data/classroom.json)
- **Screenshot:** not needed (PASS)

## PASS · major · 172 Keyboard class: main controls and visible focus

- **Expected:** Tab reaches #host-btn, #join-code, #join-btn, #view-class a[href="#/home"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 4 Tab presses. [{"id":"host-btn","tag":"BUTTON","text":"Host a session","ring":true,"matched":["#host-btn"]},{"id":"join-code","tag":"INPUT","text":"","ring":true,"matched":["#join-code"]},{"id":"join-btn","tag":"BUTTON","text":"Join","ring":true,"matched":["#join-btn"]},{"id":"","tag":"A","text":"Back","ring":true,"matched":["#view-class a[href=\"#/home\"]"]}]
- **Tab / duration:** main / 46 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 173 Classroom: host session and QR

- **Expected:** Hosting shows a four-character code, usable room link, QR/fallback, and empty leaderboard.
- **Actual:** Code CS29; Local mode (no server configured): host and players must use tabs of this same browser.
- **Tab / duration:** main / 1777 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 177 Keyboard host: main controls and visible focus

- **Expected:** Tab reaches #host-url, #view-host a[href="#/class"] with a visible focus outline or ring.
- **Actual:** Reached all controls; 2 Tab presses. [{"id":"host-url","tag":"A","text":"http://localhost:8765/index.html?room=CS29#/player","ring":true,"matched":["#host-url"]},{"id":"","tag":"A","text":"Back","ring":true,"matched":["#view-host a[href=\"#/class\"]"]}]
- **Tab / duration:** main / 342 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 178 Classroom: player 1 joins via ?room=CODE

- **Expected:** First independent tab becomes Detective #1 and appears on the host board.
- **Actual:** 1 detective joined · 1. Detective #1 0 pts · 0/5 cases
- **Tab / duration:** main / 4539 ms
- **Console errors/exceptions:** `browser-error`: Failed to load resource: the server responded with a status of 404 (File not found) (http://localhost:8765/data/classroom.json)
- **Screenshot:** not needed (PASS)

## PASS · major · 179 Classroom: wrong room code

- **Expected:** A valid-looking nonexistent code reports an error visibly on the join screen.
- **Actual:** There is no open session with that code (local mode: the host must be open in this same browser).
- **Tab / duration:** main / 6077 ms
- **Console errors/exceptions:** `browser-error`: Failed to load resource: the server responded with a status of 404 (File not found) (http://localhost:8765/data/classroom.json)
- **Screenshot:** not needed (PASS)

## PASS · major · 180 Classroom: rapid double Join creates exactly one player

- **Expected:** Two consecutive native Join clicks create only Detective #2; the host has exactly two unique players.
- **Actual:** 1. Detective #1 0 pts · 0/5 cases 2. Detective #2 0 pts · 0/5 cases
- **Tab / duration:** main / 804 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 184 Keyboard player: main controls and visible focus

- **Expected:** Tab reaches #player-next with a visible focus outline or ring.
- **Actual:** Reached all controls; 1 Tab presses. [{"id":"player-next","tag":"BUTTON","text":"Start the next case","ring":true,"matched":["#player-next"]}]
- **Tab / duration:** player1 / 31 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 185 Classroom: join twice reuses existing detective

- **Expected:** Repeated Join in the same tab does not register another player or reset its identity.
- **Actual:** 2 detectives joined; player 1 reused.
- **Tab / duration:** main / 4044 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 186 Classroom: player reload mid-mission preserves progress

- **Expected:** Reload keeps detective identity, earned mission score and current case; returning to that case cannot duplicate its mission points.
- **Actual:** #1 · 1 pts · session CS29
- **Tab / duration:** player1 / 7870 ms
- **Console errors/exceptions:** `browser-error`: Failed to load resource: the server responded with a status of 404 (File not found) (http://localhost:8765/data/classroom.json)
- **Screenshot:** not needed (PASS)

## PASS · major · 187 Classroom player1: mission case 1 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✓ Good eye! (Already scored on this case.) The dashed trend line agrees with you. · ✓ Great call! +2 points: the tests say a change this clear would almost never come from chance. · Mission · case 1 of 5 · Detective #1 · 3 pts · ↩ mission
- **Tab / duration:** player1 / 5123 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 188 Classroom: replay both answers in the active mission case

- **Expected:** Reopening the current mission case and answering direction and verdict again preserves the earned mission score and completion count.
- **Actual:** Mission score unchanged: 3 pts · session CS29; both answers replayed twice; screenshot=run-2026-11-15T03-37-25-249Z/mission-replay.png
- **Tab / duration:** player1 / 7255 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground player1](run-2026-11-15T03-37-25-249Z/mission-replay.png)

## PASS · major · 189 Classroom player1: Next case 1

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 3 pts · session CS29 · completed 1/5
- **Tab / duration:** player1 / 140 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 190 Classroom player1: mission case 2 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✓ Good eye! +1 point. The dashed trend line agrees with you. · ✓ Great call! +2 points: the tests say a change this clear would almost never come from chance. · Mission · case 2 of 5 · Detective #1 · 6 pts · ↩ mission
- **Tab / duration:** player1 / 1837 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 191 Classroom player1: Next case 2

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 6 pts · session CS29 · completed 2/5
- **Tab / duration:** player1 / 618 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 192 Classroom player1: mission case 3 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✓ Good eye! +1 point. The dashed trend line agrees with you. · ✓ Great call! +2 points: there are signs, but chance could still explain them. · Mission · case 3 of 5 · Detective #1 · 9 pts · ↩ mission
- **Tab / duration:** player1 / 2624 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 193 Classroom player1: Next case 3

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 9 pts · session CS29 · completed 3/5
- **Tab / duration:** player1 / 893 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 194 Classroom player1: mission case 4 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✓ Good eye! +1 point. The ups and downs hide any steady change. · ✓ Great call! +2 points: the ups and downs are too big for the change to stand out yet. · Mission · case 4 of 5 · Detective #1 · 12 pts · ↩ mission
- **Tab / duration:** player1 / 1908 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 195 Classroom player1: Next case 4

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 12 pts · session CS29 · completed 4/5
- **Tab / duration:** player1 / 719 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 196 Classroom player1: mission case 5 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✓ Good eye! +1 point. The dashed trend line agrees with you. · ✓ Great call! +2 points: the tests say a change this clear would almost never come from chance. · Mission · case 5 of 5 · Detective #1 · 15 pts · ↩ mission
- **Tab / duration:** player1 / 2719 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 197 Classroom player1: Next case 5

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 15 pts · session CS29 · completed 5/5
- **Tab / duration:** player1 / 851 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 198 Classroom player2: mission case 1 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✗ Not quite. Follow the dashed line from 1981 to 2025: it goes up. Detectives learn from misses! · ✗ The tests disagree: the tests say a change this clear would almost never come from chance. Open the clues to see why. · Mission · case 1 of 5 · Detective #2 · 0 pts · ↩ mission
- **Tab / duration:** player2 / 3444 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 199 Classroom player2: Next case 1

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 0 pts · session CS29 · completed 1/5
- **Tab / duration:** player2 / 730 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 200 Classroom player2: mission case 2 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✗ Not quite. Follow the dashed line from 1981 to 2025: it goes up. Detectives learn from misses! · ✗ The tests disagree: the tests say a change this clear would almost never come from chance. Open the clues to see why. · Mission · case 2 of 5 · Detective #2 · 0 pts · ↩ mission
- **Tab / duration:** player2 / 2399 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 201 Classroom player2: Next case 2

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 0 pts · session CS29 · completed 2/5
- **Tab / duration:** player2 / 1350 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 202 Classroom player2: mission case 3 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✗ Not quite. Follow the dashed line from 1981 to 2025: it goes down. Detectives learn from misses! · ≈ Close, +1 point. The tests say "Likely": there are signs, but chance could still explain them. · Mission · case 3 of 5 · Detective #2 · 1 pts · ↩ mission
- **Tab / duration:** player2 / 2488 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 203 Classroom player2: Next case 3

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 1 pts · session CS29 · completed 3/5
- **Tab / duration:** player2 / 940 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 204 Classroom player2: mission case 4 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ≈ Close: the line does tilt that way, but the change is too small to tell apart from normal ups and downs. No points this time. · ✗ The tests disagree: the ups and downs are too big for the change to stand out yet. Open the clues to see why. · Mission · case 4 of 5 · Detective #2 · 1 pts · ↩ mission
- **Tab / duration:** player2 / 2111 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 205 Classroom player2: Next case 4

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 1 pts · session CS29 · completed 4/5
- **Tab / duration:** player2 / 1393 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 206 Classroom player2: mission case 5 answers

- **Expected:** Start next case opens bundled evidence; direction and verdict feedback/results appear without POWER.
- **Actual:** ✗ Not quite. Follow the dashed line from 1981 to 2025: it goes up. Detectives learn from misses! · ✗ The tests disagree: the tests say a change this clear would almost never come from chance. Open the clues to see why. · Mission · case 5 of 5 · Detective #2 · 1 pts · ↩ mission
- **Tab / duration:** player2 / 2747 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 207 Classroom player2: Next case 5

- **Expected:** Next case advances exactly one mission position and eventually shows Mission complete.
- **Actual:** 1 pts · session CS29 · completed 5/5
- **Tab / duration:** player2 / 344 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 208 Classroom: leaderboard order and live totals

- **Expected:** Host has exactly two players, sorted by score/done/id; correct player outranks wrong-answer player.
- **Actual:** [{"text":"1. Detective #1\n15 pts · 5/5 cases","id":1,"score":15,"done":5},{"text":"2. Detective #2\n1 pts · 5/5 cases","id":2,"score":1,"done":5}]
- **Tab / duration:** main / 16 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · major · 209 Classroom host Back and class Back

- **Expected:** Host Back opens classroom; classroom Back returns home.
- **Actual:** Host → class → home.
- **Tab / duration:** main / 2065 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## FAIL · minor · 126 Moon map: attempt foreground feature picking

- **Expected:** Clicking a rendered lunar marker opens its feature popup with name and source.
- **Actual:** NOT VERIFIED: 12 real clicks did not hit a lunar marker under headless SwiftShader; no private picking state was injected.
- **Tab / duration:** main / 3972 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/126.png)
- **Failure state:** `{"url":"http://localhost:8765/index.html#/moon","view":"view-moon","text":"THE MOON AND THE EARTH\n\nHow does the Moon affect the Earth?\n\nThe Moon pulls on the whole Earth. Some effects are proven, others are open questions. Pick a case.\n\nOcean tides\nProven\nCoral spawning\nProven\nRain and air temperature\nWeak effect\n★ Glaciers: the special case\nOpen question\nDiscoveries about the Moon itself\nThe Moon is drifting away\nMeasured with lasers\nNew craters still form\nSeen before and after\nFlashes reveal hidden impacts\nWatched from Earth\nOld records reveal Moon shakes\nRecorded by Apollo sensors\nOn the map\nSeas and lakes\nMountains and valleys\nCraters\nLanding sites\n\nOfficial names from the IAU/USGS Gazetteer of Planetary Nomenclature. Click a place to learn about it.\n\nBack to Earth"}`

## PASS · minor · 003 Layout home at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-home","scrollHeight":280,"clientHeight":280,"panelScrollWidth":638,"panelClientWidth":638,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":640,"right":1280,"top":610.40625,"bottom":892},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-home-1920x940.png"}
- **Tab / duration:** main / 5043 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-home-1920x940.png)

## PASS · minor · 004 Layout home at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-home","scrollHeight":280,"clientHeight":280,"panelScrollWidth":638,"panelClientWidth":638,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":363,"right":1003,"top":438.40625,"bottom":720},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-home-1366x768.png"}
- **Tab / duration:** main / 3616 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-home-1366x768.png)

## PASS · minor · 005 Layout home at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-home","scrollHeight":476,"clientHeight":476,"panelScrollWidth":356,"panelClientWidth":356,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":16,"right":374,"top":317.65625,"bottom":796},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-home-390x844.png"}
- **Tab / duration:** main / 1306 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-home-390x844.png)

## PASS · minor · 056 Case hunch: up

- **Expected:** The chosen hunch radio becomes checked.
- **Actual:** Checked up
- **Tab / duration:** main / 422 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · minor · 057 Case hunch: down

- **Expected:** The chosen hunch radio becomes checked.
- **Actual:** Checked down
- **Tab / duration:** main / 510 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · minor · 058 Case hunch: none

- **Expected:** The chosen hunch radio becomes checked.
- **Actual:** Checked none
- **Tab / duration:** main / 404 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · minor · 059 Case hunch: unsure

- **Expected:** The chosen hunch radio becomes checked.
- **Actual:** Checked unsure
- **Tab / duration:** main / 206 ms
- **Console errors/exceptions:** none
- **Screenshot:** not needed (PASS)

## PASS · minor · 060 Layout case at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-case","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-case-1920x940.png"}
- **Tab / duration:** main / 2797 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-case-1920x940.png)

## PASS · minor · 061 Layout case at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-case","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-case-1366x768.png"}
- **Tab / duration:** main / 3209 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-case-1366x768.png)

## PASS · minor · 062 Layout case at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-case","scrollHeight":759,"clientHeight":589,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-case-390x844.png"}
- **Tab / duration:** main / 1561 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-case-390x844.png)

## PASS · minor · 067 Layout evidence at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-evidence","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-evidence-1920x940.png"}
- **Tab / duration:** main / 2350 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-evidence-1920x940.png)

## PASS · minor · 068 Layout evidence at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-evidence","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-evidence-1366x768.png"}
- **Tab / duration:** main / 3424 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-evidence-1366x768.png)

## PASS · minor · 069 Layout evidence at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-evidence","scrollHeight":690,"clientHeight":589,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-evidence-390x844.png"}
- **Tab / duration:** main / 2043 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-evidence-390x844.png)

## PASS · minor · 073 Layout projection at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-projection","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-projection-1920x940.png"}
- **Tab / duration:** main / 2959 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-projection-1920x940.png)

## PASS · minor · 074 Layout projection at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-projection","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-projection-1366x768.png"}
- **Tab / duration:** main / 2422 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-projection-1366x768.png)

## PASS · minor · 075 Layout projection at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-projection","scrollHeight":666,"clientHeight":589,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-projection-390x844.png"}
- **Tab / duration:** main / 1569 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-projection-390x844.png)

## PASS · minor · 083 Layout verdict at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-verdict","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-verdict-1920x940.png"}
- **Tab / duration:** main / 3190 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-verdict-1920x940.png)

## PASS · minor · 084 Layout verdict at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-verdict","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-verdict-1366x768.png"}
- **Tab / duration:** main / 2535 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-verdict-1366x768.png)

## PASS · minor · 085 Layout verdict at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-verdict","scrollHeight":763,"clientHeight":589,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-verdict-390x844.png"}
- **Tab / duration:** main / 1448 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-verdict-390x844.png)

## PASS · minor · 088 Layout record at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-record","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-record-1920x940.png"}
- **Tab / duration:** main / 1686 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-record-1920x940.png)

## PASS · minor · 089 Layout record at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-record","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-record-1366x768.png"}
- **Tab / duration:** main / 2430 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-record-1366x768.png)

## PASS · minor · 090 Layout record at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-record","scrollHeight":634,"clientHeight":589,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-record-390x844.png"}
- **Tab / duration:** main / 1316 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-record-390x844.png)

## PASS · minor · 094 Layout lineup at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-lineup","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-lineup-1920x940.png"}
- **Tab / duration:** main / 2967 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-lineup-1920x940.png)

## PASS · minor · 095 Layout lineup at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-lineup","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-lineup-1366x768.png"}
- **Tab / duration:** main / 2382 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-lineup-1366x768.png)

## PASS · minor · 096 Layout lineup at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-lineup","scrollHeight":506,"clientHeight":506,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":336.125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-lineup-390x844.png"}
- **Tab / duration:** main / 1577 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-lineup-390x844.png)

## PASS · minor · 100 Layout compare at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-compare","scrollHeight":838,"clientHeight":838,"panelScrollWidth":758,"panelClientWidth":758,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1144,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-compare-1920x940.png"}
- **Tab / duration:** main / 4898 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-compare-1920x940.png)

## PASS · minor · 101 Layout compare at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-compare","scrollHeight":666,"clientHeight":666,"panelScrollWidth":758,"panelClientWidth":758,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":590,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-compare-1366x768.png"}
- **Tab / duration:** main / 4063 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-compare-1366x768.png)

## PASS · minor · 102 Layout compare at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-compare","scrollHeight":619,"clientHeight":589,"panelScrollWidth":356,"panelClientWidth":356,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":358,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-compare-390x844.png"}
- **Tab / duration:** main / 2066 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-compare-390x844.png)

## PASS · minor · 111 Layout global at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-global","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-global-1920x940.png"}
- **Tab / duration:** main / 6684 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-global-1920x940.png)

## PASS · minor · 112 Layout global at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-global","scrollHeight":707,"clientHeight":666,"panelScrollWidth":483,"panelClientWidth":483,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-global-1366x768.png"}
- **Tab / duration:** main / 2443 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-global-1366x768.png)

## PASS · minor · 113 Layout global at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-global","scrollHeight":766,"clientHeight":589,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-global-390x844.png"}
- **Tab / duration:** main / 721 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-global-390x844.png)

## PASS · minor · 122 Layout moon at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-moon","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-moon-1920x940.png"}
- **Tab / duration:** main / 1948 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-moon-1920x940.png)

## PASS · minor · 123 Layout moon at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-moon","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-moon-1366x768.png"}
- **Tab / duration:** main / 1279 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-moon-1366x768.png)

## PASS · minor · 124 Layout moon at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-moon","scrollHeight":747,"clientHeight":589,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-moon-390x844.png"}
- **Tab / duration:** main / 257 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-moon-390x844.png)

## PASS · minor · 138 Layout lunar at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-lunar","scrollHeight":917,"clientHeight":838,"panelScrollWidth":483,"panelClientWidth":483,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-lunar-1920x940.png"}
- **Tab / duration:** main / 748 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-lunar-1920x940.png)

## PASS · minor · 139 Layout lunar at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-lunar","scrollHeight":917,"clientHeight":666,"panelScrollWidth":483,"panelClientWidth":483,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-lunar-1366x768.png"}
- **Tab / duration:** main / 645 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-lunar-1366x768.png)

## PASS · minor · 140 Layout lunar at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-lunar","scrollHeight":1043,"clientHeight":589,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-lunar-390x844.png"}
- **Tab / duration:** main / 298 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-lunar-390x844.png)

## PASS · minor · 169 Layout class at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-class","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-class-1920x940.png"}
- **Tab / duration:** main / 3778 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-class-1920x940.png)

## PASS · minor · 170 Layout class at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-class","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-class-1366x768.png"}
- **Tab / duration:** main / 3616 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-class-1366x768.png)

## PASS · minor · 171 Layout class at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-class","scrollHeight":453,"clientHeight":453,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":388.78125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-class-390x844.png"}
- **Tab / duration:** main / 2585 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-class-390x844.png)

## PASS · minor · 174 Layout host at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-host","scrollHeight":838,"clientHeight":838,"panelScrollWidth":758,"panelClientWidth":758,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1144,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-host-1920x940.png"}
- **Tab / duration:** main / 3052 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-host-1920x940.png)

## PASS · minor · 175 Layout host at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-host","scrollHeight":666,"clientHeight":666,"panelScrollWidth":758,"panelClientWidth":758,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":590,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-host-1366x768.png"}
- **Tab / duration:** main / 3787 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-host-1366x768.png)

## PASS · minor · 176 Layout host at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-host","scrollHeight":630,"clientHeight":589,"panelScrollWidth":356,"panelClientWidth":356,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":358,"top":253.203125,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-host-390x844.png"}
- **Tab / duration:** main / 2330 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground main](run-2026-11-15T03-37-25-249Z/layout-host-390x844.png)

## PASS · minor · 181 Layout player at 1920x940

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-player","scrollHeight":838,"clientHeight":838,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1920,"bodyWidth":1920,"width":1920,"height":940,"panel":{"left":1404,"right":1904,"top":64,"bottom":904},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-player-1920x940.png"}
- **Tab / duration:** player1 / 5258 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground player1](run-2026-11-15T03-37-25-249Z/layout-player-1920x940.png)

## PASS · minor · 182 Layout player at 1366x768

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-player","scrollHeight":666,"clientHeight":666,"panelScrollWidth":498,"panelClientWidth":498,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":1366,"bodyWidth":1366,"width":1366,"height":768,"panel":{"left":850,"right":1350,"top":64,"bottom":732},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-player-1366x768.png"}
- **Tab / duration:** player1 / 3505 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground player1](run-2026-11-15T03-37-25-249Z/layout-player-1366x768.png)

## PASS · minor · 183 Layout player at 390x844

- **Expected:** Panel stays within viewport, permits internal vertical scrolling, has no horizontal overflow, and Earth/Moon controls are uncovered.
- **Actual:** {"view":"view-player","scrollHeight":313,"clientHeight":313,"panelScrollWidth":388,"panelClientWidth":388,"overflowY":"auto","switches":[{"id":"to-earth","uncovered":true},{"id":"to-moon","uncovered":true}],"scrollWidth":390,"bodyWidth":390,"width":390,"height":844,"panel":{"left":0,"right":390,"top":528.875,"bottom":844},"screenshot":"run-2026-11-15T03-37-25-249Z/layout-player-390x844.png"}
- **Tab / duration:** player1 / 2373 ms
- **Console errors/exceptions:** none
- **Screenshot:** [foreground player1](run-2026-11-15T03-37-25-249Z/layout-player-390x844.png)


Protocol sources: [CDP Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/), [Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/), [Input](https://chromedevtools.github.io/devtools-protocol/tot/Input/). Application expectations were read from index.html, main.js and classroom.js. No application fixes or commits were made. Successful leads are outside this POWER-blocked run; no successful network fixture was fabricated.
