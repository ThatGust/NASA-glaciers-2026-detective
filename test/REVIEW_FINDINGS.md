# R2 — Functionality and interactivity review

Reviewed on 14 November 2026. **What this change does:** this report reviews the existing application; it changes no application behavior. It traces the Earth/Moon investigation game, classroom lifecycle and every Firestore write made by the client.

**Result: 27 findings — 25 confirmed and 2 unconfirmed.** No confirmed blocker. There are 10 confirmed major findings, 15 confirmed minor findings, and two mobile-layout concerns requiring browser verification. Findings are sorted by severity. Paths and line numbers refer to the reviewed snapshot, relative to `app/`.

## Method and limits

- Read all of `index.html`, `main.js`, `classroom.js`, `engine.js` and `firestore.rules`, plus connected data, the existing tests and the tides builder. The actual place list is 919 catalog places plus eight accepted rivers, or **927** places.
- Ran all **22 existing tests: passed**. Also ran ephemeral Node/VM probes against the actual functions and event handlers, with in-memory DOM/storage/network/timer doubles. No test script or fixture was written to disk. The doubles verify control flow and emitted HTML, not real browser rendering or accessibility announcements.
- No configured Chrome DevTools browser or Firestore emulator was available. No production room was created, joined or changed. Firestore compatibility and authorization conclusions below come from tracing the supplied rules; deployed rules/configuration were not verified. `data/classroom.json` is absent in this checkout, so the default classroom backend is local.
- In the reproductions below, use a disposable local session unless Firebase/emulator setup is explicitly mentioned. Synthetic fixtures are test inputs, not observations. No source edits, commits, `.env` reads or external service writes were made. Only this report and one AI-use log row are written.

## Major findings

### R2-001 — Flat records become a highly significant lunar signal

- **Severity:** major. **Status:** confirmed by direct engine execution and a real bundled input.
- **Location:** `engine.js:421–438`; caller `main.js:1037–1044`.
- **What happens:** constant or exactly linear values have zero residual variance after detrending. Correlation becomes `NaN`; every placebo comparison is false, so the function returns the smallest possible p-value and `verdict: 'signal'`. The UI can display a Moon-like signal with `NaN%` of the ups and downs explained.
- **Reproduce:** Moon → Rain and air temperature → Kilimanjaro → Snow depth → Test. Its bundled 1981–2025 snow-depth values are all zero. Directly running `lunarTest` on that record returns `p = 0.001`, `share = NaN`, `correlation = NaN`. Amazon, Congo, Daintree and Cape Byron also have flat bundled snow-depth records.
- **Minimal fix:** validate lengths/finite values and reject zero detrended variance before correlation/placebos. Return an explicit flat/no-signal status that the UI handles without awarding a signal point. Add one flat-series regression test.

### R2-002 — Old requests can overwrite a newer case and force navigation

- **Severity:** major. **Status:** confirmed with deferred fetch promises.
- **Location:** `main.js:332–370`, `main.js:1025–1052`; related asynchronous navigation at `classroom.js:133–139`.
- **What happens:** investigation, scan and lunar handlers have no operation token, cancellation or in-flight guard. After an `await`, they still change shared state, content and routes even if the user started another case or left the page. The Earth hunch is read after fetching, rather than with the original selection; pending comparison state is also read after fetching.
- **Reproduce:** choose uncached coordinates A and submit; immediately choose uncached coordinates B and submit. Resolve B before A using network delay or deferred fetches: B opens, then A replaces it. The VM probe reproduced B at `(3.456, 4.567)` being overwritten by A at `(1.234, 2.345)`. Alternatively, start a slow lunar test and open another Moon case before it resolves; the old result is written into the new case. An old `finishCase` report can likewise navigate back to Player after another action has started.
- **Minimal fix:** snapshot selection, hunch and comparison/mission identity before awaiting; invalidate a request generation on new actions/navigation; discard stale completions. Disable duplicate submits while the active operation owns the controls, restoring them in `finally`.

### R2-003 — Unrelated activities can add classroom mission points

- **Severity:** major. **Status:** confirmed by the classroom VM probe and the real `award` caller chain.
- **Location:** `classroom.js:120–130`, `classroom.js:154–159`; callers `main.js:537`, `main.js:980`, `main.js:1048`.
- **What happens:** starting a mission sets `inCase = true`, but leaving the mission does not clear it. `addPoints` checks neither the current route nor which case generated the award. Any ordinary investigation, Moon quiz or lunar test can contribute to the current mission score. A demo can also replace the mission's case while leaving mission progress active.
- **Reproduce:** join a room and start a mission case. Use the persistent Moon button, open Coral spawning and answer correctly. Enter `#/player` in the address bar: the mission score increased even though no mission question was answered. Reopening Moon quizzes can keep adding points. The probe also confirmed points being accepted while the route was Home.
- **Minimal fix:** attach awards to an explicit mission case/answer ID and accept only awards belonging to the active mission case. Suspend or end mission scoring when another activity replaces it.

### R2-004 — Refreshing or reopening an unfinished mission allows repeat scoring

- **Severity:** major. **Status:** confirmed with fresh classroom instances sharing only in-memory saved storage.
- **Location:** `classroom.js:66–67`, `classroom.js:127–137`; `main.js:540–568`, `main.js:1128–1133`.
- **What happens:** storage keeps the score and completed-case count, but not the active case's answered questions. Refresh restores earned points while `startNext` reopens the same unfinished case and `render` resets its answer guards. A student can collect its points repeatedly. Visiting `#/player` and pressing Start the next case again also reopens an unfinished case without a refresh.
- **Reproduce:** start mission case one, answer its Rising question correctly, and refresh before Next case. Enter `#/player` in the address bar and start the same case; answer Rising again. The saved mission score grows again while `done` remains zero. The probe reproduced retained points and another award after reinitialization.
- **Minimal fix:** persist answered question IDs for each mission case and make awards idempotent, or roll back uncommitted case points when restarting that case. Restore the matching answer UI rather than resetting it blindly.

### R2-005 — Double Join creates ghost players and resets the player's identity

- **Severity:** major. **Status:** confirmed against the actual local backend and join handler.
- **Location:** `classroom.js:98–108`, `classroom.js:143–144`.
- **What happens:** each join allocates another player and replaces `me` with a zero-score identity. Join remains enabled while a join is pending; pressing Enter can start another join too. Already joining the same room is not treated as a reconnect.
- **Reproduce:** enter a valid hosted code and double-click Join, or press Enter and immediately click Join. The probe produced players `1` and `2` in one room, but only player `2` remained the active identity; player `1` remained on the board. With Firebase latency, the older join may also finish last and replace the newer identity.
- **Minimal fix:** share one joining guard across click/Enter/QR paths, disable Join until completion, and resume an existing identity when reconnecting to its room instead of always allocating another player.

### R2-006 — Local joins can assign the same ID to two tabs

- **Severity:** major. **Status:** confirmed by deliberately interleaving the backend's storage reads/writes in memory.
- **Location:** `classroom.js:41–49`.
- **What happens:** the local backend increments a counter using an unprotected read/modify/write of the whole room. Different tabs can read the same counter, allocate the same ID, and overwrite each other's player entry. Reports also rewrite the whole room and can erase another tab's concurrent update. Firebase's transaction does not have this particular allocation race.
- **Reproduce:** host locally and join from two tabs concurrently. To reproduce deterministically, pause tab A after its room read, let tab B read/write its join, then resume A's write. The in-memory interleaving returned ID `1` to both callers and left only one player. Apply the same interleaving to two score reports to lose one update.
- **Minimal fix:** serialize local read/modify/write operations per room across tabs, for example with a supported Web Lock. Give a clear unsupported-mode message where that locking primitive is unavailable.

### R2-007 — Any Firebase client can change another detective's score/progress

- **Severity:** major. **Status:** confirmed from the complete supplied rule predicates; not exercised against deployed Firebase.
- **Location:** `firestore.rules:7–20`; `classroom.js:10–30`.
- **What happens:** there is no authentication or ownership check. Player IDs are public and predictable. Any client can increment another player's score by up to ten per write or set their `done` to five; repeated score increases have no ceiling. The rules also permit creating unallocated nonpositive IDs because they check only `id <= room.next`, not positive membership/ownership. These predicates do not enforce a fair classroom leaderboard.
- **Reproduce:** in an emulator configured with these rules, create a room and player `1`, then use a second unauthenticated client to update that player's score from `0` to `10` and `done` from `0` to `5`. Those writes satisfy every update predicate. Repeat the score update for further increases. No such write was made to a real service during this review.
- **Minimal fix:** use anonymous authentication, record a player owner UID, and restrict each player document to that UID; separately protect room-host operations. Validate positive integer IDs and bounded integer progress/score. If the score must resist cheating by its own player as well, client-provided totals need authoritative validation.

### R2-008 — External data reaches HTML sinks without escaping

- **Severity:** major. **Status:** confirmed data path and emitted HTML; no claim that the current bundled sources contain an attack.
- **Location:** `main.js:299–300`, `main.js:478–504`, `main.js:520–523`, `main.js:1003`; related sinks `main.js:616`, `main.js:679`, `main.js:740–787`.
- **What happens:** escaping is applied to place cards, but the same external catalog place names are inserted raw into case-file cells and comparison headings. Variable metadata, witness/index text and loaded quiz strings also reach `innerHTML` without escaping. A hostile upstream string can become elements/event handlers; ordinary markup characters can corrupt output too.
- **Reproduce:** in a disposable response override or in-memory fixture, give a catalog place the name `<img src=x onerror=alert(1)>`, then open its case file or comparison. The probe confirmed that this exact element was emitted into `record.innerHTML`, rather than escaped text. Likewise, a loaded Moon quiz question/option containing markup is inserted verbatim at line 1003. The probe did not execute a browser payload.
- **Minimal fix:** escape external scalar fields at each interpolation, or create nodes and assign `textContent`. Keep intentional, project-authored markup such as the fixed discharge notice separate; escaping an entire already-assembled table cell would also escape its intended formatting.

### R2-009 — A room-code collision erases a local room or rejects a Firebase host

- **Severity:** major. **Status:** confirmed from both backend implementations and their rules. Requires a code collision.
- **Location:** `classroom.js:16`, `classroom.js:40`, `classroom.js:71`, `classroom.js:83–85`; `firestore.rules:11–12`.
- **What happens:** hosting generates a short code once, without checking whether it is already in use. Locally, `createRoom` overwrites all existing players/counters. With Firebase, `setDoc` on an existing room is an update, and resetting its counter/creation fields violates the update rule, so hosting rejects instead. The two backends fail differently.
- **Reproduce:** in a disposable test, force the code generator to return an existing code: create a room, join a student, then host again with that code. The local backend replaces its players with `{}`. With these rules in an emulator, the equivalent second `setDoc` is denied.
- **Minimal fix:** implement atomic create-if-absent semantics and retry with another generated code on collision. Never reset an existing room as part of hosting.

### R2-010 — A failed final report permanently disagrees with the leaderboard

- **Severity:** major. **Status:** confirmed with a backend write failure injected in the classroom VM.
- **Location:** `classroom.js:133–139`, `classroom.js:154–158`; local/Firebase report methods at `classroom.js:29`, `classroom.js:49`.
- **What happens:** points and completed-case count are saved locally before reporting. Report failures are swallowed or logged, and finishing still navigates to Player. There is no pending-sync flag, retry or resubmission on reconnect/render. A failed final write can leave a student seeing Mission complete while the host sees an older score/case count.
- **Reproduce:** play the last mission case, reject the score/progress writes, then allow writes again and return to Player. In the probe, saved state was `{score: 1, done: 5}` while the host-side player remained `{score: 0, done: 4}`; rendering Player did not repair it. A local room that has disappeared is worse: its report method silently returns success.
- **Minimal fix:** keep a pending latest state until the backend acknowledges it; show an unsynced/error status and provide a retry/reconnect path, including after refresh. Do not silently treat a missing room as a successful report.

### R2-011 — Mobile header may cover both world-switch buttons

- **Severity:** major. **Status:** **unconfirmed in a real browser**; overlapping placement is evident from CSS.
- **Location:** `index.html:27–36`, `index.html:147–157`, `index.html:180–187`.
- **What happens:** the world switch is centered at the same top offset and stacking level as the left brand and the score. The mobile rule moves the score to the right but does not reserve space for the centered switch. On a narrow viewport, the brand/score can overlap the Earth/Moon buttons; the later score element can intercept taps.
- **Reproduce:** at 320 px and 360 px viewport widths, test Earth and Moon with both the Rookie score and a long rank/large score. Check their actual bounding rectangles and which element receives taps. No browser layout/tap test was available here, so the exact obscured area remains unconfirmed.
- **Minimal fix:** put the world switch on its own responsive row or reserve an explicit nonoverlapping header layout.

## Minor findings

### R2-012 — Hosting errors reject without a visible recovery state

- **Severity:** minor. **Status:** confirmed with an injected storage failure.
- **Location:** `classroom.js:83–95`, `classroom.js:142`; Firebase watch `classroom.js:30`.
- **What happens:** unlike Join, Host has no error handler. A quota/security error, failed Firebase write, or unavailable BroadcastChannel rejects the event listener without explaining the failure. The snapshot listener also has no error callback, so a Firebase watch failure does not reach the host UI.
- **Reproduce:** reject `localStorage.setItem` in a disposable test and press Host a session. The probe caught an unhandled `QuotaExceededError` and an empty status. For the watch path, deny/listener-fail reads in an emulator and check the unchanged board.
- **Minimal fix:** wrap host creation/subscription in `try/catch/finally`, show an accessible host status and restore controls. Pass an error callback to `onSnapshot`.

### R2-013 — A comparison survives replacement by another activity

- **Severity:** minor. **Status:** confirmed by rendering another case after Compare.
- **Location:** `main.js:341–347`, `main.js:396–402`, `main.js:507–513`; replacement callers `main.js:691–694`, `main.js:799`, `main.js:1128–1133`.
- **What happens:** Compare sets `compareWith`, but opening a lead, demo, region or mission does not clear it. A later unrelated submission with the same variable can unexpectedly compare against the abandoned original case.
- **Reproduce:** investigate A, choose Compare, then navigate Home and open a solved case or classroom case instead. Return to New case and submit the original variable at C. The comparison can still be A versus C. The VM confirmed that rendering a new case leaves `compareWith` set.
- **Minimal fix:** clear comparison state whenever starting a case/activity outside the explicit comparison flow; capture the intended comparison per request.

### R2-014 — Moon explanations remain hidden after visiting a quiz-only case

- **Severity:** minor. **Status:** confirmed by the real `openLunarCase` function in the VM.
- **Location:** `main.js:995–1007`, `main.js:1038–1052`.
- **What happens:** a non-testable case sets `lunar-note.hidden = true`. Opening a testable case clears its text but never unhides it. The test writes the result/caveat/error into that still-hidden element. Answering a quiz happens to unhide it, which masks the problem for tides but not for the rain/glacier cases without quizzes.
- **Reproduce:** Moon → Coral spawning, without answering → Back → Rain and air temperature → Test. The numeric headline/chart can appear, but the explained share, swing, causality caveat or failure reason stays hidden.
- **Minimal fix:** reset the note's visibility explicitly on every case opening and when presenting test results/errors.

### R2-015 — Leaving a demo does not cancel its navigation timer

- **Severity:** minor. **Status:** confirmed with controlled timers and the actual route/tour functions.
- **Location:** `main.js:274–289`, `main.js:709–726`.
- **What happens:** only Exit demo/normal tour completion clears the timer. Navigating Home, Moon, Classroom, or with browser Back leaves it active; the old timer later changes the hash and interrupts the new activity.
- **Reproduce:** start a solved-case tour with normal motion enabled, immediately navigate Home or Moon without pressing Exit demo, then wait for its next step. The VM timer changed Home to `#/verdict`.
- **Minimal fix:** stop the tour on navigation outside its owned step, while distinguishing its own scheduled route changes. Clear it when starting any non-demo activity.

### R2-016 — Refreshing a host loses the room and leaderboard subscription

- **Severity:** minor. **Status:** confirmed with a new classroom instance.
- **Location:** `classroom.js:67–68`, `classroom.js:83–95`; route guard `main.js:279`.
- **What happens:** host code/subscription are only in memory. `#/host` has no host-session guard or restoration path. Refresh shows a host page with blank code/QR/board, although the old room remains open and students can continue reporting into it.
- **Reproduce:** host, have a student join, and refresh the host tab at `#/host`. The new instance has an empty host code and no watch. Back → Host creates another room rather than recovering the old one.
- **Minimal fix:** persist the host code, validate it and reattach the watch after refresh; otherwise redirect a host route without a room to Classroom with a recovery message. Define an explicit end-session action if rooms should close.

### R2-017 — A bad QR code can display the previous room; switching rooms does not update the QR query

- **Severity:** minor. **Status:** confirmed for the failed-QR path in the classroom VM; successful-switch path traced through both callers.
- **Location:** `classroom.js:67`, `classroom.js:98–108`, `classroom.js:149–151`; `main.js:278–280`.
- **What happens:** saved `me` remains active while automatic joining is attempted. If a different QR room is invalid, the failed join leaves the old identity active and its error on the hidden Classroom screen, while `#/player` shows the old room. Also, a successful manual join never updates/removes an old `?room=` query; refreshing can autojoin that old room again and reset progress.
- **Reproduce:** join TEST, then open the same tab at `?room=ZZZZ#/player` with no ZZZZ room. The probe kept `active === true` and displayed TEST while the join error was elsewhere. For the second path, enter via a QR link for A, manually join B, then refresh: startup still reads A from the query.
- **Minimal fix:** await/validate the requested QR join before allowing Player, show its failure in the visible route, and consume or update the room query when a join succeeds.

### R2-018 — The previous hunch is reused and rendering itself awards points

- **Severity:** minor. **Status:** confirmed by calling the actual render function twice.
- **Location:** `main.js:338`, `main.js:475–481`; hunch inputs `index.html:337–342`.
- **What happens:** New case/Back never reset the hunch radio selection. The old hunch is silently attached to later investigations, and `render` awards it without recording that it has already been credited. Rendering the same correctly guessed case twice adds another point.
- **Reproduce:** make a correct Rising hunch for a case, investigate, then use New case and investigate again without choosing a fresh hunch. The old Rising selection is still active and is credited again. The VM observed another point from a second render of the same hunch/case.
- **Minimal fix:** reset the hunch when explicitly opening a new case, snapshot it on submit, and move its award out of rendering into an idempotent answer/analysis-completion action.

### R2-019 — A witness downgrade turns a missing clock into zero/one more year

- **Severity:** minor. **Status:** confirmed with a synthetic opposite-trend witness; no contradictory example was found among the current bundled principal/witness pairs checked.
- **Location:** `main.js:413`, `main.js:375–380`, `main.js:452–455`.
- **What happens:** a confirmed result has `yearsNeeded: null`. A contradictory witness changes the verdict to likely, but preserves that null. `clockText` treats `null <= 1` as true, and the checklist treats `Math.max(1, null)` as one, inventing an imminent confirmation estimate for a dataset disagreement.
- **Reproduce:** feed `withWitness` a confirmed real case and a witness with negated values over the same years, then render the result. The probe returned `verdict: 'likely'`, `yearsNeeded: null`, `knownSince: null`; the two clock branches then claim one or two more years.
- **Minimal fix:** handle the downgraded/disagreement state explicitly and suppress the clock unless it has a valid computed estimate. More observations of the principal alone do not resolve a contradictory witness.

### R2-020 — Focus is lost on the verdict route and after several keyboard actions

- **Severity:** minor. **Status:** confirmed from focus targets and node replacement; actual assistive-technology behavior not tested.
- **Location:** `main.js:284`, `main.js:183–190`, `main.js:231–240`, `main.js:571–574`; `index.html:403–404`.
- **What happens:** a normal verdict route tries to focus `#t3`, but that heading is inside the still-hidden verdict block. Revealing a clue hides the focused button without moving focus or announcing its replacement. Selecting a place/kind or Moon layer replaces the focused button through `innerHTML`; delegated listeners survive, but keyboard focus does not.
- **Reproduce:** use only Tab/Enter to open a normal verdict before answering it; inspect `document.activeElement` after navigation. Then reveal a clue or choose a place/filter with Enter and inspect focus again. In each path the target is hidden or removed rather than preserved.
- **Minimal fix:** keep a visible, focusable route heading outside the gated result; implement clue disclosure with `aria-expanded`/`aria-controls` and keep its button; restore focus to the matching replacement control or update existing nodes.

### R2-021 — Back/hash navigation can reuse another case's line-up

- **Severity:** minor. **Status:** confirmed by state/route tracing.
- **Location:** `main.js:279`, `main.js:650–673`; new-case render `main.js:424–481`.
- **What happens:** the line-up grid, answer index and result are global and only regenerated by the Spot the real one button. A new case resets neither the grid nor its answer. The route guard accepts any `current`, so returning to `#/lineup` can show case A's panels while the feedback consults case B's verdict.
- **Reproduce:** open A's line-up without answering, return to the verdict and open a new investigation B. Use browser history to revisit the old line-up, or enter `#/lineup` directly. The panels/answer remain A's; click feedback uses `current.r` from B. Directly visiting that hash before ever generating panels gives an empty game.
- **Minimal fix:** associate line-up state with a case identity, clear it on case replacement, and require/generated matching panels when entering the route.

### R2-022 — Kind filtering does not filter the globe dots

- **Severity:** minor. **Status:** confirmed from the complete event-handler path.
- **Location:** `main.js:186–190`, `main.js:223–240`.
- **What happens:** country and text handlers call `showDots`, but the kind handler only rebuilds chips/cards. The map keeps dots from excluded kinds, contrary to the shared-filter behavior described immediately above `showDots`.
- **Reproduce:** open the place picker with All selected, then choose Glaciers without editing text/country. Cards change, but the previously shown city/river/etc. dots remain. Changing the search or country afterward makes the kind filter suddenly apply to the dots.
- **Minimal fix:** call `showDots()` after changing the kind filter.

### R2-023 — Moon initialization/feature failures have no complete recovery path

- **Severity:** minor. **Status:** confirmed error-handling paths; actual WebGL failure not exercised.
- **Location:** `main.js:874–889`, `main.js:892–937`.
- **What happens:** world state and container visibility switch before Moon initialization succeeds. The catch only logs; it does not show a Moon failure message, clean up a partially initialized viewer or restore Earth. Errors after viewer assignment can leave a truthy broken viewer that prevents retry. `loadMoonFeatures(M)` is also started without awaiting/catching its promise, so post-fetch entity-creation failures bypass the surrounding synchronous catch.
- **Reproduce:** with Earth functioning, make the Moon Viewer constructor or initial entity setup throw in a disposable runtime double, then choose Moon twice. Inspect the hidden Earth container and any retained `moonViewer`. Separately reject the feature-loading promise or throw during its entity insertion; no visible recovery is attached to that promise. Missing JSON alone returns an empty feature list and is not an unhandled rejection.
- **Minimal fix:** on initialization failure destroy/reset any partial viewer, show an accessible Moon-specific error and an Earth/retry action; attach a rejection handler to asynchronous feature loading.

### R2-024 — The UI does not reproduce the positive-control audit's seeded p-values

- **Severity:** minor. **Status:** confirmed by running both generators on all eight actual tide-gauge series.
- **Location:** `main.js:1033–1037`; connected audit `tools/fetch_tides.mjs:102–104`, `tools/fetch_tides.mjs:119–120`.
- **What happens:** both paths use the same seed number but different pseudorandom algorithms. The audit uses an LCG; the UI uses a Mulberry-style generator. Within the UI results are repeatable, but its positive-control result is not the exact result verified by the data lane.
- **Reproduce:** test Honolulu with the UI generator and its centimetre conversion, then with the audit generator: UI `p = 0.035`, audit `p = 0.033`. Key West gives `0.003` versus `0.002`. All eight currently remain classified as signals; this is a reproducibility mismatch, not a demonstrated current verdict flip.
- **Minimal fix:** use one shared generator/seed contract for the audit and UI and test exact reproduction, preserving the existing per-case reset.

### R2-025 — Each search/filter render performs a quadratic place lookup

- **Severity:** minor. **Status:** confirmed with the actual 927-place list and a lookup-only benchmark.
- **Location:** `main.js:209–210`, `main.js:223–224`.
- **What happens:** `showDots` iterates all place entities and scans `PLACES` from the start for each entity. That is quadratic work in a hot input/route path. The current order requires **430,128 predicate evaluations per call**, before evaluating filters or updating Cesium entities.
- **Reproduce:** search or change country with all 927 entities present; instrument the inner `find` predicate. A five-call, lookup-only Node probe averaged about **13.6 ms per call on this machine**. This is not a browser/Cesium benchmark or a measured mobile delay.
- **Minimal fix:** build an ID-to-place map when the catalog changes, or attach the corresponding place to each entity, and perform constant-time lookup.

### R2-026 — A perfect straight trend gets a second-test p-value of one

- **Severity:** minor. **Status:** confirmed by direct engine execution.
- **Location:** `engine.js:299–305`; UI consequence `main.js:456–458`.
- **What happens:** when residual standard error is exactly zero, `linearTTest` sets `t = 0` even for a nonzero slope. That produces `p = 1` and a false second-test disagreement for an exactly linear trend.
- **Reproduce:** call `linearTTest(Array.from({length:45},(_,i)=>1981+i), Array.from({length:45},(_,i)=>i))`. The result has a positive slope and `p = 1`. `analyze` still confirms its Mann–Kendall trend, so rendering it claims the second test disagrees.
- **Minimal fix:** distinguish zero error/nonzero slope from zero error/zero slope; the former needs an infinite test statistic and zero two-sided p-value. Add that exact-line edge case to the existing t-test test.

### R2-027 — The lunar selector row may overflow narrow screens

- **Severity:** minor. **Status:** **unconfirmed in a real browser**; requires responsive layout verification.
- **Location:** `index.html:87–89`, `index.html:301–304`, `index.html:46`.
- **What happens:** the lunar controls force `flex-wrap: nowrap`, combine a full-width place select, a 180 px variable select and a Test button, and do not set shrinking/minimum-width rules for these controls. Long tide-station options may force horizontal overflow or put Test outside the visible panel.
- **Reproduce:** at 320 px and 360 px widths, open Ocean tides and select a long gauge label; then test the rain/glacier variable labels. Check `scrollWidth` and keyboard visibility of Test. No browser measurement was available here, so clipping is not claimed as observed.
- **Minimal fix:** stack or wrap lunar controls at the mobile breakpoint and give selects `min-width: 0` with flexible widths.

## Firestore write compatibility audit

The supplied rules do **not** reject the normal client payloads merely because the client uses `setDoc`/`updateDoc`. The problems are missing ownership, collisions, unvalidated restored identity and discarded failures. This table covers every backend write site; it is a static audit, not a deployed-rules test.

| Client write | Payload / target | Result under supplied rules |
|---|---|---|
| `classroom.js:16` create room | New `rooms/{code}` with `created`, `next: 0`, `open: true` | Allowed by lines 8–9. A repeated code is an update and is denied: it resets the counter/changes creation state rather than incrementing `next` by one. See R2-009. |
| `classroom.js:23` join transaction | Existing room, update only `next` to old value plus one | Allowed by lines 11–12. Concurrent Firebase joins retry transactionally; do not confuse this with the local read/modify/write race. The client checks `open`; the rule itself does not. |
| `classroom.js:26` create player | `players/{String(id)}` with matching numeric `id`, `score: 0`, `done: 0`, numeric `updated` | Allowed by lines 15–17 after the counter transaction has committed. A preexisting player document would instead invoke update restrictions and can reject. Allocation and player creation are separate operations, so a failed creation can also consume an ID. |
| `classroom.js:29`, called by `:138` and `:158` | Update `score`, `done`, `updated` on an existing player | Ordinary one/two-point awards, unchanged score on completion, and `done` from zero through five satisfy lines 18–20. Smaller/stale totals, an increase greater than ten, `done > 5`, or a missing player can reject. Writes do not carry an owner identity. Discarding a rejection leaves divergent local state (R2-010). |
| Room close/delete | No client write exists | No room-delete or `open`-changing update is allowed by these rules. Adding an End session button later also requires a matching rule change. No existing close write is falsely reported as rejected here. |

`watch` reads the players collection; the supplied rules allow these reads. Its missing error callback still matters for network/configuration/deployed-rule failures. Local `report` can recreate a missing player; Firebase `updateDoc` cannot. Restoring only `sessionStorage.me` does not validate or recreate a missing Firebase player.

## Checks that did not produce a finding

- Event delegation is used for regenerated place, clue, lead, line-up, Moon-layer and quiz children. No duplicate registration was found in a normal single module initialization; the VM observed at most one handler per element/event. The confirmed issue on replacement is focus, not lost child event listeners.
- Earth direction/verdict and lunar quiz handlers set their answered guard synchronously, before scoring. Repeating the same Earth direction click awarded once in the VM. `finishCase` clears `inCase` before awaiting, so rapid duplicate Next clicks do not directly advance twice. Re-entry, refresh and cross-activity paths are the failures described above.
- Local-storage score read/write failures are caught in `main.js`; session-storage helper failures are caught too. The unhandled host/backend write failure is separate. No storage containing real credentials was read.
- A newly rendered normal case clears the per-screen Earth answer guards; demo reveal/hide uses the current case object's `demo` flag. No blanket demo-flag leak was confirmed. `current`, `leads` and `lunarCase` existence guards prevent several empty routes, but do not validate the ownership of older activity-specific state.
- Main route headings generally have `tabindex="-1"`. The verdict heading is the exception in practice because its ancestor is hidden before answering. Place/clue/line-up controls are native buttons and do receive keyboard activation; line-up graphs themselves have no nonvisual data alternative, which still needs an accessibility-design check.
- Verdicts include words/symbols and maps include text legends, so their overall result meaning is not solely a color. The correct line-up gets a visual class, but miss feedback explicitly names its number. Actual contrast, screen-reader announcements and touch hit testing were not measured.
- Tide values are converted from metres to centimetres once; the returned swing is signed. The eight actual controls all returned signal under both tested generators. The chart uses different solid/dashed strokes. Several gauge series contain gaps; the effect of treating adjacent retained observations as consecutive AR(1) steps was not calibrated here and remains **unconfirmed**, rather than asserted to reverse a verdict.

## Snapshot and verdict

Reviewed SHA-256 hashes (recheck locations if another lane changes these files):

```text
index.html       296381b5142e3a43670868b9910e4d260abdea52462a18eccf7c1f6f9047e226
main.js          bf21961d444690a9d0deb1f591d33836b8087a61d16fc33f020c40cdbb34b4a0
classroom.js     0868c84067f160458e77b0c2da80fec484a013d654f7df1b57ad13ef4e3d9260
engine.js        b12f6becb309a0f4962b10a5dfe19e22d37ceadabb503bf8cc9694886b77c399
firestore.rules  e2316090b496b5d62dd9dd2fafbb341600d6e95f1bf5b82de65d254a238845e9
```

**Verdict:** fix R2-001 through R2-010 before relying on scientific lunar verdicts or a fair, recoverable classroom game. Browser-check R2-011 and R2-027 before the phone demo.

**Not checked:** real mobile/browser rendering, screen-reader behavior, real WebGL/GPU failures, deployed Firebase configuration/rules and Firebase emulator execution. Remaining risk: static/VM confirmation cannot replace those integration checks.
