import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = (value, label, maxWords = Infinity) => {
  assert.ok(typeof value === 'string' && value.trim(), `${label}: expected nonempty text`);
  assert.ok(value.trim().split(/\s+/u).length <= maxWords, `${label}: exceeds ${maxWords} words`);
};
const url = (value, label) => {
  text(value, label);
  const parsed = new URL(value);
  assert.ok(parsed.protocol === 'https:' && parsed.hostname.includes('.') && !parsed.username && !parsed.password, `${label}: expected public HTTPS URL`);
};

function validate(data) {
  assert.match(data.generated, /^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/u);
  assert.ok(Number.isFinite(Date.parse(data.generated)), 'Invalid generated date');
  assert.ok(Date.parse(data.generated) <= Date.now(), 'Future generated date');
  assert.ok(Array.isArray(data.cases) && data.cases.length >= 4 && data.cases.length <= 6, 'Expected 4–6 cases');
  const ids = new Set();
  for (const c of data.cases) {
    text(c.id, 'id');
    assert.match(c.id, /^[a-z][a-z0-9_-]*$/u);
    assert.ok(!ids.has(c.id), `Duplicate case id: ${c.id}`);
    ids.add(c.id);
    text(c.title, `${c.id}.title`, 6);
    text(c.intro, `${c.id}.intro`, 30);
    assert.ok(Array.isArray(c.tag) && c.tag.length === 2 && ['proven', 'weak', 'open'].includes(c.tag[0]), `${c.id}: invalid tag`);
    text(c.tag[1], `${c.id}.tag label`);
    assert.ok(Array.isArray(c.facts) && c.facts.length >= 2, `${c.id}: expected at least two cited facts`);
    for (const f of c.facts) {
      for (const key of ['label', 'unit', 'year_range', 'source_name']) text(f[key], `${c.id}.fact.${key}`);
      if (typeof f.value === 'number') assert.ok(Number.isFinite(f.value), `${c.id}: nonfinite fact`);
      else text(f.value, `${c.id}.fact.value`);
      url(f.source_url, `${c.id}.fact.source_url`);
    }
    url(c.learn_more_url, `${c.id}.learn_more_url`);
    text(c.quiz.q, `${c.id}.quiz.q`);
    text(c.quiz.why, `${c.id}.quiz.why`, 30);
    assert.ok(Array.isArray(c.quiz.options) && c.quiz.options.length === 3, `${c.id}: expected three quiz options`);
    c.quiz.options.forEach(option => text(option, `${c.id}.quiz.option`));
    assert.equal(new Set(c.quiz.options).size, 3, `${c.id}: duplicate quiz options`);
    assert.ok(Number.isInteger(c.quiz.answer) && c.quiz.answer >= 0 && c.quiz.answer < 3, `${c.id}: invalid quiz answer index`);
    if (c.series !== undefined) {
      const s = c.series;
      text(s.units, `${c.id}.series.units`);
      url(s.source, `${c.id}.series.source`);
      assert.ok(Array.isArray(s.years) && Array.isArray(s.values) && s.years.length >= 2, `${c.id}: invalid series`);
      assert.equal(s.years.length, s.values.length, `${c.id}: series lengths differ`);
      s.years.forEach((year, i) => assert.ok(Number.isInteger(year) && year < new Date().getUTCFullYear() && (!i || year > s.years[i - 1]), `${c.id}: invalid annual years`));
      assert.ok(s.values.every(Number.isFinite), `${c.id}: invalid annual values`);
    }
  }
}

const data = JSON.parse(await readFile(new URL('../data/moon_cases.json', import.meta.url), 'utf8'));
validate(data);
if (process.argv.includes('--self-test')) {
  const rejects = mutate => {
    const bad = structuredClone(data);
    mutate(bad);
    assert.throws(() => validate(bad));
  };
  rejects(d => { d.cases[0].facts[0].source_url = ''; });
  rejects(d => { d.cases[0].learn_more_url = 'javascript:alert(1)'; });
  rejects(d => { d.cases[0].quiz.answer = 3; });
  rejects(d => { d.cases[0].quiz.answer = 0.5; });
  rejects(d => { d.cases[0].title = 'word '.repeat(7); });
  rejects(d => { d.cases[0].intro = 'word '.repeat(31); });
  rejects(d => { d.cases[0].quiz.why = 'word '.repeat(31); });
  rejects(d => { d.cases[1].id = d.cases[0].id; });
  rejects(d => { d.cases[0].facts[0].value = null; });
  rejects(d => { d.cases[0].series = { years: [2000, 2001], values: [1], units: 'test', source: d.cases[0].learn_more_url }; });
  console.log('Validator rejection self-checks passed.');
}
console.log(`Validated ${data.cases.length} Moon cases, ${data.cases.reduce((n, c) => n + c.facts.length, 0)} cited facts and ${data.cases.length} quizzes. No network requests made.`);
