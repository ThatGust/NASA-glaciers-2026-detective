"""Record screenshot-review findings alongside the completed automated R1 run."""
import datetime
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent
run = root / 'run-2026-11-15T03-17-41-882Z'
evidence = run / 'results.json'
data = json.loads(evidence.read_text(encoding='utf-8'))
visual = [
    dict(id='210', name='Visual review: mobile brand and score overlap',
         expected='At 390x844 the brand and score/rank remain legible without overlapping.',
         actual='In the captured global view, 7 pts / Junior detective extends over the right end of Signal or Noise. The Earth/Moon switch remains clear. Confirmed by screenshot inspection; automated panel geometry checks do not cover brand/score intersections. Relevant CSS: index.html:147 and index.html:162.',
         tab='main', image='layout-global-390x844.png'),
    dict(id='211', name='Visual review: mobile credits cover panel content',
         expected='At 390x844 fixed imagery credits do not paint over text or controls in the active panel.',
         actual='The fixed credits paint over the player Start the next case button and the host Back area at the bottom of their panels. This is a visual overlap; the primary player action still passed its click test. Confirmed by screenshot inspection. Relevant CSS: index.html:37 (fixed credits, z-index 3) and the mobile bottom panel rule.',
         tab='player1', image='layout-player-390x844.png'),
]

assert len(data['results']) == 209
assert sum(r['status'] == 'FAIL' for r in data['results']) == 2
assert not any(e['kind'] == 'exception' for e in data['events'])
assert data['metadata']['sources_before'] == data['metadata']['sources_after']
assert data['metadata']['cleanup']['owned_chrome_stopped']
for row in visual:
    row.update(status='FAIL', severity='minor', duration_ms=0, console=[],
               method='visual screenshot inspection',
               screenshot=dict(path=f"{run.name}/{row.pop('image')}", tab=row['tab']))
data['metadata'].update(automated_scenarios=209, visual_review_scenarios=2,
                        visual_review_recorded=datetime.datetime.now(datetime.timezone.utc).isoformat())
data['results'].extend(visual)

report = root / 'REPORT.md'
text = report.read_text(encoding='utf-8')
text = text.replace('**207 PASS / 2 FAIL.**', '**207 PASS / 4 FAIL: 209 automated scenarios plus 2 screenshot-review scenarios.**')
summary = ('Confirmed app findings: ordinary-case replay awards another **+3 points** (major); at **390x844**, a longer score/rank overlaps the brand, and fixed credits overlap panel text/controls (minor). Classroom mission points remain unchanged when both answers are replayed, including after reload. **Moon marker picking remains unverified**: the headless test failed to hit a marker; this is a coverage failure, not a confirmed app defect.\n\n'
           'Console summary: **zero uncaught JavaScript exceptions**. Resource errors were missing `favicon.ico`, missing optional `data/classroom.json` (local classroom mode was used), and `net::ERR_FAILED` from the deliberately blocked POWER request. Each occurrence is retained with its scenario.\n\n')
text = text.replace('Initial timeout diagnosis:', summary + 'Initial timeout diagnosis:', 1)
blocks = ''
for row in visual:
    blocks += (f"## FAIL · minor · {row['id']} {row['name']}\n\n"
               f"- **Expected:** {row['expected']}\n- **Actual:** {row['actual']}\n"
               '- **Method:** visual inspection of the full-run screenshot\n'
               '- **Console errors/exceptions:** none associated with this visual finding\n'
               f"- **Screenshot:** [{row['tab']}]({row['screenshot']['path']})\n\n")
index = text.index('## PASS · minor')
text = text[:index] + blocks + text[index:]
text = text.replace('Protocol sources:', 'The run was repeated after correcting harness timing and quiz-note assertions; earlier run folders are diagnostic history and are superseded by the evidence linked above.\n\nProtocol sources:')

rows = re.findall(r'^## (PASS|FAIL) · (blocker|major|minor) · (\d+) ', text, re.M)
assert len(rows) == len({row[2] for row in rows}) == 211
assert sum(row[0] == 'FAIL' for row in rows) == 4
weights = {'blocker': 0, 'major': 1, 'minor': 2}
assert [weights[row[1]] for row in rows] == sorted(weights[row[1]] for row in rows)
for row in data['results']:
    shot = row.get('screenshot', {}).get('path')
    if shot:
        assert (root / shot).is_file(), shot
for target in re.findall(r'\]\(([^)]+)\)', text):
    if not target.startswith('http'):
        assert (root / target).is_file(), target
evidence.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
report.write_text(text, encoding='utf-8')
print('Verified 211 unique severity-sorted scenarios; all screenshot/report links exist; source hashes unchanged.')
