"""Check the documentation contract without running or changing the application."""
import hashlib
import json
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

root = Path(__file__).resolve().parent
app = root.parent.parent
doc = (root / 'USE_CASES.md').read_text(encoding='utf-8')
snapshot = json.loads((root / 'source_snapshot.json').read_text(encoding='utf-8'))
manifest = json.loads((root / 'render_manifest.json').read_text(encoding='utf-8'))
expected = {f'UC-{i:02}' for i in range(1, 49)}
sections = list(re.finditer(r'^### (UC-\d+) — ([^\n]+)\n(.*?)(?=^### |^## |\Z)', doc, re.M | re.S))
assert len(sections) == 48 and {s[1] for s in sections} == expected
sources = {}
for entry in snapshot['sources']:
    path = app / entry['file']
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == entry['sha256'], f"Source changed: {entry['file']}"
    sources[entry['file']] = raw.decode('utf-8')
for file, entry in snapshot['public_counts']['files'].items():
    assert hashlib.sha256((app / file).read_bytes()).hexdigest() == entry['sha256'], file
assert snapshot['public_counts']['catalog_places'] == 919
assert snapshot['public_counts']['ordinary_variables'] == 15
assert snapshot['public_counts']['bundle_place_ids'] == 927
assert snapshot['public_counts']['global_cells'] == 2592
code = '\n'.join(sources[f] for f in ('main.js', 'classroom.js', 'engine.js'))
html_ids = set(re.findall(r'\bid="([^"]+)"', sources['index.html']))
for section in sections:
    body = section[3]
    for field in ('**Actor:**', '**Goal:**', '**Trigger:**', '**Alternatives/errors:**', '**Code:**'):
        assert field in body, f'{section[1]}: missing {field}'
    steps = re.findall(r'^(\d+)\. ', body, re.M)
    assert 3 <= len(steps) <= 7 and steps == [str(i) for i in range(1, len(steps) + 1)], section[1]
    assert re.search(r'\]\(\.\./\.\./(?:main\.js|classroom\.js|engine\.js|index\.html)', body), section[1]
for element in re.findall(r'`#([a-z][\w-]*)`', doc):
    assert element in html_ids, f'Unknown element #{element}'
for name in re.findall(r'`(\w+)\(\)`', doc):
    assert re.search(rf'\b{re.escape(name)}\b', code), f'Unknown function {name}'
for target in re.findall(r'\]\(([^)]+)\)', doc):
    if target.startswith(('https://', 'http://', '#')):
        continue
    path_text, _, anchor = target.partition('#')
    path = (root / path_text).resolve()
    assert path.is_relative_to(app) and path.is_file(), target
    if anchor.startswith('L'):
        assert 1 <= int(anchor[1:]) <= len(path.read_text(encoding='utf-8').splitlines()), target

main_lines = sources['main.js'].splitlines()
for line, fragment in {314: "loadJson('data/place_series.json')", 318: 'return fetchPower(',
                       365: 'await fetchPowerMany(', 217: 'Math.abs(lat)',
                       1036: 'Pick a place and a variable first.', 1019: "$('lunar-note').hidden = false",
                       1038: "$('lunar-note').hidden = false", 984: "$('lunar-note').hidden = false"}.items():
    assert fragment in main_lines[line - 1], f'Audited anchor moved: main.js:{line}'
    assert f'../../main.js#L{line}' in doc
assert '37 consecutive annual values span 36 years' in doc

covered = set()
images = []
assert len(manifest['diagrams']) == 7
for diagram in manifest['diagrams']:
    path = root / diagram['file']
    source = path.read_text(encoding='utf-8')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == diagram['source_sha256']
    assert 'left to right direction' in source and source.startswith('@startuml') and source.rstrip().endswith('@enduml')
    if path.name in ('00_overview.puml', '05_game_classroom.puml'):
        assert 'U45 ..> U6 : <<include>>' in source
        assert 'U6 ..> U45' not in source
    assert not re.search(r'live fallback|climate fallback|POWER point fallback', source)
    if path.name == 'page_overview.puml':
        assert not re.search(r'UC-\d|<<include>>|<<extend>>|Firebase', source)
        for phrase in ['919 places', '15 variables', '2,592 cells', '45 years', 'Mann-Kendall, t-test', 'Student / teacher', 'Classroom player']:
            assert phrase in source, phrase
        legend = source.split('legend bottom\n')[1].split('\nendlegend')[0]
        assert len(legend.splitlines()) == 2
    declared = dict(re.findall(r'usecase "(UC-\d+)\\n[^"\n]+" as (U\d+)', source))
    aliases = set(declared.values())
    for line in source.splitlines():
        if '<<include>>' in line or '<<extend>>' in line:
            edge = re.match(r'(U\d+)\s+[^\s]+\s+(U\d+)\s*:', line)
            if edge:
                assert edge[1] in aliases and edge[2] in aliases, line
    if not path.name.startswith('00_'):
        covered.update(declared)
    svg = ET.parse(path.with_suffix('.svg')).getroot()
    assert float(svg.attrib['width']) == 1200
    png = path.with_suffix('.png').read_bytes()
    assert png[:8] == b'\x89PNG\r\n\x1a\n'
    width, height = struct.unpack('>II', png[16:24])
    assert width == 1200
    assert diagram['minimum_text_px_at_1200'] >= 12, path.name
    images.append({'diagram': path.stem, 'width': width, 'height': height,
                   'minimum_text_px': diagram['minimum_text_px_at_1200']})
assert covered == expected, sorted(expected - covered)
report = {'checked': datetime.now(timezone.utc).isoformat(), 'status': 'passed',
          'specifications': 48, 'diagrams': 7, 'source_hashes_unchanged': True,
          'checks': ['3–7 ordered steps and required fields per specification', 'all 48 IDs in package diagrams',
                     'code functions, element IDs, file links and line bounds', 'UML relationship endpoints and mission include direction',
                     'public counts/data hashes, public diagram labels and two-line legend',
                     'render/source hashes, SVG XML, PNG signatures, 1200 px width, text >=12 px'],
          'images': images,
          'limits': 'Static documentation checks only; no application tests, browser behavior or deployed backend verification.'}
(root / 'validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print('Passed: 48 specifications, seven diagram pairs, references, unchanged source hashes and 1200 px image checks.')
