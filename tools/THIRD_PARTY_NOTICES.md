# Data-lane source notices

This notice supplements `../THIRD_PARTY_NOTICES.md` within the permitted data-lane write scope. The new scripts use Node.js standard modules and the project's existing statistics engine; no third-party software dependency was added.

| Material | Use and attribution | Terms / source |
|---|---|---|
| NASA POWER monthly point data and parameter definitions | Credit NASA Langley Research Center POWER Project; MERRA-2 meteorology from NASA GMAO; CERES SYN1deg radiation, clouds, and aerosol data. SRB is used only in source-boundary checks. Individual queries and retrieval dates are in the evidence JSON files. | [POWER data FAQ](https://power.larc.nasa.gov/docs/faqs/data/) and [NASA use guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/); publicly available NASA data, source attribution retained. |
| Wikipedia contributors: geographic coordinates and API page metadata | Per-place attribution URLs in `catalog.json`; page/revision metadata in `catalog_checks.json`. Only geographic facts and identifying metadata are extracted; no article narrative or images are copied. | Wikipedia content is available under [CC BY-SA 4.0, subject to Wikimedia's terms](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content). |
| Wikidata contributors: P625 coordinate claims | Kilimanjaro (`Q7296`) and Amazon rainforest (`Q177567`); exact claims and their source item URLs retained. | Structured data is [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). |
| WGMS Global Glacier Change Bulletin No. 5 (2020–2021), section 4.5, printed page 66 | Zongo's published geographic coordinate only, with citation; no mass-balance data, text passages, tables, or photos are copied into the catalog. | [Original bulletin](https://user.geo.uzh.ch/mzemp/Docs/WGMS_GGCB_05.pdf); extracted coordinate is a geographic fact. No redistribution license for the whole bulletin is asserted. |

The project's Apache 2.0 license applies to its own scripts; it does not replace the source terms above. NASA sources supply all numerical trend metrics. WGMS, Wikipedia, and Wikidata supply geographic reference facts only.
