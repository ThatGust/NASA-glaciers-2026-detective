# Third-party notices

This project's own code is released under the Apache License 2.0 (see `LICENSE`). It uses or adapts the following third-party material.

## Software

| Component | Use | License |
|---|---|---|
| [CesiumJS](https://github.com/CesiumGS/cesium) 1.124.0, loaded from the jsDelivr CDN | 3D globe | Apache License 2.0 |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 by Kazuhiko Arase, loaded from the jsDelivr CDN | QR code for classroom sessions | MIT License |
| [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) © 2026 Bilawal Sidhu and contributors | Style variables (colors, fonts, glass panels), adapted in `index.html` | MIT License (notice below) |
| [Inter](https://fonts.google.com/specimen/Inter) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), via Google Fonts | Typography | SIL Open Font License 1.1 |
| [pymannkendall](https://github.com/mmhs013/pyMannKendall) (test reference only, not shipped) | Cross-check of the statistics engine in `test/reference.py` | MIT License |

### MIT License notice for God's Eye View

```
MIT License

Copyright (c) 2026 Bilawal Sidhu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Data

| Source | Use | Terms |
|---|---|---|
| [NASA POWER](https://power.larc.nasa.gov/) (NASA Langley Research Center), monthly point API: MERRA-2 (NASA GMAO) meteorology and CERES SYN1deg solar radiation | Live time series for every case | NASA open data; cite NASA POWER |
| [Meteomatics Weather API](https://www.meteomatics.com/en/api/getting-started/) (NASA Space Apps 2026 Global Offer), precomputed annual values in `data/witnesses.json` when present: ERA5 reanalysis (ECMWF / Copernicus Climate Change Service), CHIRPS v3 (Climate Hazards Center, UC Santa Barbara), NASA GHRSST sea surface temperature | Second witness for temperature and precipitation; extra variables (sea surface temperature, frost, hot and heavy-rain days) | Meteomatics terms; ERA5: Copernicus licence, cite C3S/ECMWF; CHIRPS: cite Funk et al. (2015); GHRSST: cite NASA PO.DAAC |
| [NOAA CPC Oceanic Niño Index](https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt) and [NOAA NCEI ERSST v5 PDO index](https://www.ncei.noaa.gov/pub/data/cmb/ersst/v5/index/ersst.v5.pdo.dat), annual means in `data/indices.json` | Alibi test: does a trend survive once El Niño or the PDO is removed? | U.S. Government public domain; cite NOAA |
| [MODIS MOD17A3HGF](https://doi.org/10.5067/MODIS/MOD17A3HGF.061) net primary productivity (NASA), via the [ORNL DAAC MODIS web service](https://modis.ornl.gov/rst/api/v1/), annual values in `data/modis.json` | Plant carbon gain at catalog places | NASA open data; cite the product DOI and ORNL DAAC |
| River discharge from the GloFAS reanalysis (Copernicus Emergency Management Service) via the [Open-Meteo Flood API](https://open-meteo.com/en/docs/flood-api), annual means in `data/rivers.json` | River discharge at 11 rivers that pass a quality screen | [CC BY 4.0](https://open-meteo.com/en/licence): credit Open-Meteo with a link next to the data; values modified (annual means); [Open-Meteo terms](https://open-meteo.com/en/terms) (non-commercial use) |
| NASA GES DISC via Earthdata (OPeNDAP), monthly: [MERRA-2 M2TMNXSLV 5.12.4](https://doi.org/10.5067/AP1B0BA5PD2K) (GMAO), [AIRS3STM 7.0](https://doi.org/10.5067/UBENJB9D3T2H) (Aqua AIRS project), [GLDAS_NOAH10_M 2.1](https://doi.org/10.5067/LWTYSMP3VM5Z) (Rodell et al. 2004); annual cell values in `data/grid_atmos.json` | Global maps of temperature at three heights, ozone, water vapor, runoff, evaporation and soil water; AIRS (satellite) as second witness of MERRA-2 | NASA open data; cite each product DOI and GES DISC |
| [NASA Worldview Snapshots](https://wvs.earthdata.nasa.gov/) (GIBS): MODIS/VIIRS true colour and Blue Marble Next Generation images in `img/places/` | One satellite image per place | NASA imagery, public domain; per-image layer, date and bounding box in `img/places/CREDITS.md` |
| Place descriptions in `data/place_facts.json` | One short factual sentence per place, written for students | Facts paraphrased from the cited Wikipedia revision of each place (CC BY-SA 4.0); climate numbers from NASA POWER |
| [NASA Moon Trek](https://trek.nasa.gov/moon/): LRO WAC global mosaic (303 ppd, v02) map tiles | Moon globe imagery | NASA open data; credit NASA/GSFC/Arizona State University (LROC) and NASA Moon Trek |
| Lunar feature coordinates and one-line notes (Wikipedia coordinate data, globe=moon) | Moon place markers | Coordinates are facts; descriptions paraphrased from Wikipedia (CC BY-SA 4.0) |
| [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/GIS_Downloads), Moon feature center points (LOLA 2011), in `data/moon_features.json` | Official names of lunar seas, mountains, valleys, craters and landing sites on the Moon map | U.S. public domain (USGS); names approved by the International Astronomical Union |
| [NOAA CO-OPS](https://tidesandcurrents.noaa.gov/) verified monthly mean high and low water at 8 long-record tide gauges, annual mean tidal range in `data/tides.json` | Positive control of the lunar test: the 18.6-year cycle in ocean tides | U.S. Government public domain; cite NOAA/NOS/CO-OPS |
| [NASA GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api), Blue Marble Shaded Relief and Bathymetry | Globe imagery | NASA open data |

Place coordinates come from Wikipedia (CC BY-SA 4.0), Wikidata (CC0) and the WGMS Global Glacier Change Bulletin No. 5; each place cites its source in `data/catalog.json`. Details: `tools/THIRD_PARTY_NOTICES.md`.

## References for the methods

- Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. *JASA*, 63, 1379–1389. doi:10.1080/01621459.1968.10480934
- Hamed, K. H., & Rao, A. R. (1998). A modified Mann-Kendall trend test for autocorrelated data. *Journal of Hydrology*, 204, 182–196. doi:10.1016/S0022-1694(97)00125-X
- Weatherhead, E. C., et al. (1998). Factors affecting the detection of trends. *JGR: Atmospheres*, 103(D14), 17149–17161. doi:10.1029/98JD00995
- Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate. *JRSS B*, 57(1), 289–300. doi:10.1111/j.2517-6161.1995.tb02031.x
- Santer, B. D., et al. (2000). Statistical significance of trends and trend differences in layer-average atmospheric temperature time series. *JGR: Atmospheres*, 105(D6), 7337–7356. doi:10.1029/1999JD901105
- Buja, A., et al. (2009). Statistical inference for exploratory data analysis and model diagnostics. *Phil. Trans. R. Soc. A*, 367, 4361–4383. doi:10.1098/rsta.2009.0120
- Meeus, J. (1998). *Astronomical Algorithms* (2nd ed.), eq. 47.7 (longitude of the Moon's mean ascending node). Willmann-Bell.
- Marriott, F. H. C., & Pope, J. A. (1954). Bias in the estimation of autocorrelations. *Biometrika*, 41, 390–402. doi:10.1093/biomet/41.3-4.390
- Peng, D., Hill, E. M., Meltzner, A. J., & Switzer, A. D. (2019). Tide gauge records show that the 18.61-year nodal tidal cycle can change high water levels by up to 30 cm. *JGR: Oceans*, 124, 736–749. doi:10.1029/2018JC014695
- Kaye, C. A., & Stuckey, G. W. (1973). Nodal tidal cycle of 18.6 yr: its importance in sea-level curves of the east coast of the United States. *Geology*, 1(3), 141–144.
- Gilbert, R. O. (1987). *Statistical Methods for Environmental Pollution Monitoring*. Van Nostrand Reinhold.
