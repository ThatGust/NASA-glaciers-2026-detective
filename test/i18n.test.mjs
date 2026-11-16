import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rows } from '../i18n_dictionary.js';
import { dictionaries, initialLanguage, languages, supportedLanguage, translate } from '../i18n.js';

test('every handwritten key exists in all six languages with the same placeholders', () => {
  assert.equal(new Set(rows.map(row => row[0])).size, rows.length, 'duplicate English key');
  const slots = value => [...value.matchAll(/\{\d+\}/g)].map(m => m[0]).sort();
  const numbers = value => value.replace(/\{\d+\}|3D/g, '').match(/\d+(?:[.,]\d+)*/g)?.sort() || [];
  for (const row of rows) {
    assert.equal(row.length, 6, row[0]);
    for (const value of row) {
      assert.ok(value.trim(), row[0]);
      assert.deepEqual(slots(value), slots(row[0]), row[0]);
      // Dates and spelled-out numbers may add digit forms; the original digit values must remain.
      const remaining = numbers(value);
      for (const number of numbers(row[0])) { const index = remaining.indexOf(number); assert.ok(index >= 0, 'changed numeric values: ' + row[0]); remaining.splice(index, 1); }
      assert.doesNotMatch(value, /\?\?|\p{L}\?\p{L}|\uFFFD/u, 'damaged Unicode: ' + row[0]);
    }
  }
  for (const lang of Object.keys(languages)) assert.deepEqual(Object.keys(dictionaries[lang]).sort(), Object.keys(dictionaries.en).sort());
});

test('language priority, regional tags, unsupported values and denied storage', () => {
  const saved = { getItem: () => 'es' };
  assert.equal(initialLanguage('?lang=ru', saved, 'fr'), 'ru');
  assert.equal(initialLanguage('', saved, 'fr'), 'es');
  assert.equal(initialLanguage('?lang=unsupported', null, 'pt-BR'), 'pt');
  assert.equal(initialLanguage('', { getItem() { throw Error('denied'); } }, 'zh-CN'), 'zh');
  assert.equal(initialLanguage('', null, 'de-DE'), 'en');
  assert.equal(supportedLanguage('__proto__'), null);
});

test('verdicts, dynamic clock, accessibility labels and counters translate without placeholders', () => {
  for (const lang of ['es', 'pt', 'fr', 'ru', 'zh']) {
    for (const source of ['● Confirmed', '○ Not yet known', 'Known with confidence since 2006.', 'Series 3', '2/5 · Your turn: pick a place and a variable, make a hunch, and investigate.']) {
      const translated = translate(source, lang);
      assert.notEqual(translated, source, `${lang}: ${source}`);
      assert.doesNotMatch(translated, /\{\d+\}|undefined|\[missing/i);
    }
    assert.match(translate('Known with confidence since 2006.', lang), /2006/);
    assert.equal(translate('NASA POWER · MERRA-2', lang), 'NASA POWER · MERRA-2');
  }
});

test('composed messages translate the clock, projection year, regions and feedback', () => {
  assert.equal(translate('● Confirmed. Known with confidence since 2006.', 'es'), '● Confirmado. Se sabe con confianza desde 2006.');
  assert.equal(translate('Air temperature · Coropuna in 2040', 'ru'), 'Температура воздуха · Coropuna в 2040 году');
  assert.equal(translate('All land areas', 'zh'), '全部陆地');
  assert.match(translate('≈ Close, +1 point. The tests say "Likely": there are signs, but chance could still explain them.', 'es'), /^≈ Casi/);
  assert.equal(translate('Close', 'es'), 'Cerrar', 'the tour Close action is distinct from close feedback');
});

test('demo narration and Moon case UI fields have hand-written translations', async () => {
  const load = async file => JSON.parse(await readFile(new URL('../data/' + file, import.meta.url), 'utf8'));
  const demos = await load('demos.json'), moon = (await load('moon_cases.json')).cases;
  const text = [...demos.flatMap(c => [c.title, c.why]), ...moon.flatMap(c => [c.title, c.tag[1], c.intro, c.quiz.q, ...c.quiz.options, c.quiz.why, ...c.facts.flatMap(f => [f.label, f.unit])])];
  for (const source of text) for (const lang of ['es', 'pt', 'fr', 'ru', 'zh']) assert.notEqual(translate(source, lang), source, `${lang}: ${source}`);
});

test('all authored HTML text and accessibility labels have translations', async () => {
  const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8')).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').trim();
  const texts = [...html.matchAll(/>([^<>]+)</g)].map(m => decode(m[1]));
  const labels = [...html.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]+)"/g)].map(m => decode(m[1]));
  const names = new Set([...Object.values(languages), 'NASA Space Apps Challenge', 'Alvaro Sergio Cano Luque', 'LinkedIn', 'alvaro.cano.luque@gmail.com']);
  for (const text of [...texts, ...labels].filter(t => /[a-z]/i.test(t) && !names.has(t))) assert.notEqual(translate(text, 'zh'), text, text);
});
