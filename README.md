# Trend Detective

**NASA Space Apps Challenge 2026 · Challenge: "Be An Earth System Trend Detective!" · Arequipa, Peru**

Trend Detective lets anyone pick a NASA Earth-science variable and a place on a 3D globe, and get an honest verdict on whether it is really changing: **Confirmed**, **Likely** or **Not yet known**. When a trend is not yet significant, a "clock" estimates how many more years of data would be needed to confirm it. When it is, it says since when it has been known.

## How it works

1. **Open a case.** Choose a variable (temperature, precipitation, solar radiation, humidity, wind, soil moisture) and a place: click the globe, pick a preset or type coordinates.
2. **Evidence.** The app downloads the monthly series from NASA POWER, averages each year to remove the seasonal cycle, and plots it with its trend line.
3. **Verdict.** A Mann-Kendall test corrected for autocorrelation (Hamed & Rao, 1998) decides the verdict; Sen's slope gives how much it changes per decade.
4. **Case file.** Every result can be downloaded with its data, source and method.

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
