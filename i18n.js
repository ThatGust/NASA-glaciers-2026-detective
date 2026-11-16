import { rows } from './i18n_dictionary.js';

export const languages = { en: 'English', es: 'Español', pt: 'Português', fr: 'Français', ru: 'Русский', zh: '中文' };
export const dictionaries = Object.fromEntries(Object.keys(languages).map((lang, i) => [lang, Object.fromEntries(rows.flatMap(row => [[row[0].toLowerCase(), row[i]], [row[0], row[i]]]))]));
export function supportedLanguage(value) {
  const code = String(value || '').toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(languages, code) ? code : null;
}
export function initialLanguage(search = '', storage, browserLanguage = 'en') {
  const requested = supportedLanguage(new URLSearchParams(search).get('lang'));
  if (requested) return requested;
  try { const saved = supportedLanguage(storage?.getItem('sn-language')); if (saved) return saved; } catch { /* Private browsing: use the browser language. */ }
  return supportedLanguage(browserLanguage) || 'en';
}

let language = 'en';
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = rows.filter(row => row[0].includes('{0}')).map(row => {
  const slots = [...row[0].matchAll(/\{(\d+)\}/g)].map(m => +m[1]);
  return { row, slots, regex: new RegExp('^' + row[0].split(/\{\d+\}/).map(escapeRegex).join('([\\s\\S]+?)') + '$', 'u') };
});
const literals = [...new Set(rows.filter(row => !/\{\d+\}/.test(row[0])).map(row => row[0].toLowerCase()))].sort((a, b) => b.length - a.length);
const literalRegex = new RegExp(literals.map(key => `${/^[\p{L}\p{N}]/u.test(key) ? '(?<![\\p{L}\\p{N}_])' : ''}${escapeRegex(key)}${/[\p{L}\p{N}]$/u.test(key) ? '(?![\\p{L}\\p{N}_])' : ''}`).join('|'), 'giu');

// English source phrases are the keys. Templates keep variable values out of the dictionaries.
export function translate(source, lang = language, depth = 0) {
  if (lang === 'en' || !source || depth > 6) return source;
  const dictionary = Object.hasOwn(dictionaries, lang) ? dictionaries[lang] : dictionaries.en;
  if (Object.hasOwn(dictionary, source)) return dictionary[source];
  // Counters and check icons are UI structure, not parts of the translated sentence.
  const prefix = source.match(/^(\d+\/\d+ · |[^\p{L}\p{N}≈]+)(?=[\p{L}\p{N}])/u);
  if (prefix) return prefix[0] + translate(source.slice(prefix[0].length), lang, depth + 1);
  for (const { row, slots, regex } of patterns) {
    const match = source.match(regex);
    if (!match) continue;
    const values = {};
    slots.forEach((slot, i) => { values[slot] = translate(match[i + 1], lang, depth + 1); });
    return dictionary[row[0]].replace(/\{(\d+)\}/g, (_, slot) => values[slot]);
  }
  const matches = [...source.matchAll(literalRegex)];
  if (!matches.length) return source;
  let end = 0, output = '';
  for (const match of matches) {
    output += translate(source.slice(end, match.index), lang, depth + 1) + (dictionary[match[0]] ?? dictionary[match[0].toLowerCase()]);
    end = match.index + match[0].length;
  }
  return output + translate(source.slice(end), lang, depth + 1);
}

// Localize at the presentation boundary so a language change never restarts a case, quiz or room.
// Keep the English source beside each live node; a later render can safely replace that source.
export function startI18n(document, browser = window) {
  let storage;
  try { storage = browser.localStorage; } catch { /* Storage access itself can throw. */ }
  language = initialLanguage(browser.location.search, storage, browser.navigator.language);
  const originals = new WeakMap();
  const attributes = ['aria-label', 'title', 'placeholder', 'alt', 'label'];
  const excluded = 'script, style, #language-picker, [data-i18n-skip], #host-url, #host-code, #player-id, #country option:not([value=""]), #country-list, #lunar-place option:not([value^="tide:"]), .place b, .cesium-credit-textContainer';
  const numberFormat = (source, lang) => lang === 'en' ? source : source.replace(/(?<![\p{L}\d])[-+]?\d+(?:,\d{3})*\.\d+(?![\p{L}\d])/gu, token => {
    const value = Number(token.replaceAll(',', ''));
    const digits = token.split('.')[1].length;
    return (token.startsWith('+') ? '+' : '') + new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: token.includes(',') }).format(value);
  });
  function update(node, attribute) {
    const value = attribute ? node.getAttribute(attribute) : node.data;
    if (!value?.trim()) return;
    let saved = originals.get(node);
    if (!saved) { saved = {}; originals.set(node, saved); }
    const key = attribute || 'text';
    const previous = saved[key];
    const source = previous && value === previous.output ? previous.source : value;
    const trimmed = source.trim();
    let output = source.replace(trimmed, () => translate(trimmed));
    // Bibliographic links and URLs retain their published spelling and numeric notation.
    if (!node.parentElement?.closest('a[href^="http"], .credits') && !attribute) output = numberFormat(output, language);
    saved[key] = { source, output };
    if (value !== output) { if (attribute) node.setAttribute(attribute, output); else node.data = output; }
  }
  function visit(root) {
    if (root.nodeType === 3) { if (!root.parentElement?.closest(excluded)) update(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1 && root.matches(excluded)) return;
    if (root.nodeType === 1) for (const attr of attributes) if (root.hasAttribute(attr)) update(root, attr);
    for (const child of root.childNodes) visit(child);
  }
  const observer = new MutationObserver(records => {
    observer.disconnect();
    for (const record of records) {
      if (record.type === 'attributes') { if (!record.target.closest(excluded)) update(record.target, record.attributeName); }
      else if (record.type === 'characterData') visit(record.target);
      else for (const node of record.addedNodes) visit(node);
    }
    observe();
  });
  function observe() { observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes }); }
  const picker = document.getElementById('language-picker');
  function renderLanguage() {
    observer.disconnect();
    document.documentElement.lang = language;
    picker.value = language;
    picker.setAttribute('aria-label', translate('Language'));
    visit(document.documentElement);
    observe();
  }
  picker.addEventListener('change', () => {
    language = supportedLanguage(picker.value) || 'en';
    try { storage?.setItem('sn-language', language); } catch { /* Keep the choice for this page. */ }
    // Keep a shared URL in sync: an old ?lang= must not undo the newly saved choice on reload.
    const url = new URL(browser.location.href); url.searchParams.set('lang', language);
    browser.history.replaceState(null, '', url);
    renderLanguage();
  });
  renderLanguage();
  return { sourceText: node => originals.get(node)?.text?.source ?? node.textContent };
}
