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

## Run it locally

```bash
python -m http.server 8765
```

Then open http://localhost:8765. (Opening `index.html` as a file does not work, because the globe's workers need HTTP.)

## Tests

```bash
npm test
```

The engine is checked against `pymannkendall` on real NASA POWER series (identical S, z and p), and the clock is checked by simulation (with the predicted number of years, the trend is detected about 90% of the time).

## Licenses and sources

Code: Apache License 2.0. Third-party software, data and references: see `THIRD_PARTY_NOTICES.md`.
