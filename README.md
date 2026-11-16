# Signal or Noise

**An Earth & Moon trend detective** · NASA Space Apps Challenge 2026 · Challenge: "Be An Earth System Trend Detective!" · Arequipa, Peru

Signal or Noise lets anyone pick a NASA Earth-science variable and a place on a 3D globe, and get an honest verdict on whether it is really changing: **Confirmed**, **Likely** or **Not yet known**. When a trend is not yet significant, a "clock" estimates how many more years of data would be needed to confirm it. When it is, it says since when it has been known.

## Global monitor

The first screen shows **the whole planet**: 2,592 cells of 5° × 5° (land and ocean), each with its own trend test for 15 NASA POWER variables (1981–2025, or 2001–2025 for CERES products). Cells are colored by how fast the variable rises or falls, and faded where the trend is not confirmed; verdicts are adjusted for testing thousands of cells at once (Benjamini-Hochberg). Eight large regions (the whole planet, land, oceans, tropics, mid-latitudes, Arctic, Antarctic) are area-weighted means that open as cases. Any cell can be investigated in detail. Built with `node tools/build_grid.mjs`.

## How it works

1. **Open a case.** Choose a variable (temperature, precipitation, soil moisture, humidity, solar radiation, wind…) and a place: click a dot on the globe (glaciers, deserts, rainforests, cities, coasts, ocean, polar regions), any other point, or type coordinates.
2. **Evidence.** The app downloads the monthly series from NASA POWER, averages each year to remove the seasonal cycle, and plots it with its trend line.
3. **Verdict.** A Mann-Kendall test corrected for autocorrelation (Hamed & Rao, 1998) decides the verdict; Sen's slope gives how much it changes per decade.
4. **Case file.** Every result can be downloaded with its data, source and method.

Two more ways to investigate:

- **Scan a place.** Test every variable at once and see which ones are changing. Because many tests raise the chance of a false alarm, the verdicts are adjusted with the Benjamini-Hochberg procedure.
- **Compare two places.** The same variable can trend in opposite directions in different regions. The app states a direction only when both trends are at least "likely".

Each case also runs three detective tests:

- **Your hunch.** Before seeing the data, you can write down what you expect, as scientists do with a hypothesis.
- **A second method.** A linear regression t-test (with the effective sample size for autocorrelation, Santer et al. 2000) double-checks the Mann-Kendall verdict.
- **A prediction test.** A trend fitted to the older years must predict the last 15 years better than "nothing changes".

Demonstrations play as short guided tours, and the place list suggests where a detective could start for each kind of place (deserts, cities, glaciers…).

There is no server: the page calls NASA POWER and NASA GIBS directly from the browser.

## Languages

The interface is available in **English**, **Español**, **Português**, **Français**, **Русский**, and **中文 (Simplified Chinese)**. Choose a language beside the Earth/Moon switch. The current case, answers, score, tour and classroom session stay in place when switching.

Language selection follows this order: a supported `?lang=en|es|pt|fr|ru|zh` URL parameter, the saved choice, the browser language, then English. Regional browser tags such as `pt-BR` and `zh-CN` are supported. Storage is optional; denied storage does not prevent switching. Selecting a language updates the shareable URL and `<html lang>`.

`i18n_dictionary.js` contains hand-written translations of interface labels, teaching explanations, demo narration, Moon case text and data definitions. `i18n.js` applies those static phrases and numbered templates to text nodes and accessibility attributes, remembers their English originals, and uses `Intl.NumberFormat` for displayed decimals. Data values, source URLs, chart geometry and `engine.js` are unchanged. There is no runtime translation service or AI in the app.

Place/country names, Wikipedia descriptions, official mission and organization names, bibliographic source titles, photo credits and logos retain their original spelling and may remain in English. Downloaded scientific JSON retains its original field names and source metadata. NASA imagery/data credits and all source links remain available in every language.

To maintain translations, edit the six columns together (English, Spanish, Portuguese, French, Russian, Chinese), preserve every numbered placeholder, and run the tests below. New interface phrases need an entry; an unknown phrase stays readable in English. Keep appended explanations in separate text nodes so each complete sentence can use its translation template.

## Run it locally

```bash
python -m http.server 8766
```

Then open http://localhost:8766. (Opening `index.html` as a file does not work, because the globe's workers need HTTP.)

## Tests

```bash
npm test
```

The engine is checked against `pymannkendall` on real NASA POWER series (identical S, z and p), and the clock is checked by simulation (with the predicted number of years, the trend is detected about 90% of the time).

The i18n unit checks cover all dictionary keys/placeholders, language precedence, unavailable storage, verdicts and composed messages, and demo/Moon data text. With the server running on port 8766, run `node test/e2e/i18n.mjs` for switching, Russian URLs, saved preference, state preservation, tours, local classroom mode, all Moon cases, and Russian/French overflow checks at 1920×940, 1366×768 and 390×844. It uses one isolated headless Chrome and closes it in `finally`; screenshots and diagnostics are saved under ignored `.build-i18n/`.

The existing English audit is `node test/e2e/run.mjs`. Its target is hard-coded near the top; point it at port 8766 locally and restore that edit before committing. Known baseline failures are 079 and 126, with Firebase timing failures possible at 173/208. The i18n-specific audit blocks live POWER and Firebase module requests, uses bundled data and the existing local classroom fallback, and does not verify Firebase availability.

Development disclosure (15 November 2026): Codex drafted the static translations, implementation, tests and documentation. The translations have not had an independent native-speaker review. See the branch-local [AI use record](context/REGISTRO_USO_IA.md).

## Licenses and sources

Code: Apache License 2.0. Third-party software, data and references: see `THIRD_PARTY_NOTICES.md`.
