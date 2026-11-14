"""Valores de referencia con pymannkendall para comparar con engine.js.
Uso: python reference.py  (requiere pymannkendall)"""
import json
import pathlib

import pymannkendall as mk

here = pathlib.Path(__file__).parent
series = json.loads((here / "fixtures.json").read_text(encoding="utf-8"))
ref = []
for s in series:
    r = mk.hamed_rao_modification_test(s["values"])
    ref.append({"name": s["name"], "p": r.p, "z": r.z, "s": r.s, "slope_per_year": r.slope})
(here / "reference.json").write_text(json.dumps(ref, indent=1), encoding="utf-8")
print(json.dumps(ref, indent=1))
