const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length, 'inline script found');
const source = scripts[scripts.length - 1][1].replace(/\n\s*load\(\);\s*\n\s*renderAll\(\);\s*\n\s*gistSyncOnStart\(\);\s*$/, '\n');
new vm.Script(source, { filename: 'index-inline.js' }).runInNewContext({
  console,
  setTimeout,
  clearTimeout,
  fetch: async () => { throw new Error('network disabled in test'); },
  Blob,
  URL,
  Date,
  Math
});

const storage = new Map();
const storageLimit = 180000;
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) {
    if (String(value).length > storageLimit) throw new Error('QuotaExceededError');
    storage.set(key, String(value));
  },
  removeItem(key) { storage.delete(key); }
};
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { textContent: '', classList: { toggle() {}, add() {}, remove() {} } });
  return elements.get(id);
}
let clipboardText = '';
const context = {
  console, setTimeout, clearTimeout, Blob, URL, Date, Math, localStorage,
  navigator: { clipboard: { writeText(text) { clipboardText = text; return Promise.resolve(); } } },
  document: { getElementById: element, querySelectorAll() { return []; } }
};
vm.createContext(context);
new vm.Script(source, { filename: 'index-inline.js' }).runInContext(context);

const result = vm.runInContext(`(function () {
  var longCardEnd = 'LONG_CARD_END';
  var longTextEnd = 'LONG_TEXT_END';
  var cards = Array.from({ length: 13 }, function (_, i) {
    return { time: '10:' + i, type: 'log', text: 'RAW_CARD_' + (i + 1) + (i === 12 ? '_' + 'x'.repeat(1100) + longCardEnd : '') };
  });
  var objects = Array.from({ length: 9 }, function (_, i) {
    return { type: 'task', text: 'TASK_OBJECT_' + (i + 1), status: i === 0 ? 'open' : '', done: false, context: 'full context' };
  });
  objects.push({ type: 'brand-new-type', text: 'UNKNOWN_OBJECT', status: 'unreviewed', done: false });
  var day = { date: '2026-07-20', rawCards: cards, objects: objects, tasks: [], events: [], feedItems: [{ text: 'FEED_END' }], migrations: [{ text: 'MIGRATION_END', targetHorizon: 'future' }], plan: 'PLAN_END', reviewDone: false, closedAt: '' };
  var session = blankSession();
  session.reviewPeriodStart = '2026-07-20';
  session.reviewPeriodEnd = '2026-07-26';
  session.dailyLogAppliedDays = [day];
  session.convertedDays = 'CONVERTED_MARKER';
  session.dailyNotesRaw = 'DAILY_NOTES_MARKER';
  var prompt = buildPromptText('startWeeklyReview', session);
  var legacy = blankSession();
  legacy.convertedDays = 'CONVERTED_MARKER';
  var legacyPrompt = buildPromptText('startWeeklyReview', legacy);
  var longRaw = 'z'.repeat(100000) + longTextEnd;
  var habitText = buildQuantImportPromptBlock({ source: 'habitica', parseKind: 'text', rawText: 'Habit: Read\\nDaily: Walk', label: 'txt' });
  var togglText = buildQuantImportPromptBlock({ source: 'toggl', parseKind: 'text', rawText: 'Deep work 02:30 TOTAL', label: 'txt' });
  var longPrompt = buildQuantImportPromptBlock({ source: 'daylio', parseKind: 'csv', rawText: longRaw, label: 'csv' });
  var malformed = buildQuantImportPromptBlock({ source: 'habitica', parseKind: 'json', parsedJson: null, rawText: '{broken RAW_FALLBACK' });
  var incompatible = buildQuantImportPromptBlock({ source: 'toggl', parseKind: 'json', parsedJson: { unrelated: true }, rawText: '{\"unrelated\":true} INCOMPATIBLE_RAW' });
  var habitJson = buildQuantImportPromptBlock({ source: 'habitica', parseKind: 'json', parsedJson: { tasks: { habits: [], dailys: [{ text: 'JSON_DAILY' }], todos: [] } }, rawText: '{}' });
  var togglJson = buildQuantImportPromptBlock({ source: 'toggl', parseKind: 'json', parsedJson: { entries: [{ description: 'JSON_TOGGL', duration: 60, date: '2026-07-20' }] }, rawText: '{}' });
  var csv = buildQuantImportPromptBlock({ source: 'bank', parseKind: 'csv', rawText: 'date,amount\\n2026-07-20,-4.20', label: 'bank' });
  var statusDay = normalizeImportedDay({ date: '2026-07-21', objects: [
    { type: 'task', text: 'STATUS_COMPLETED_ONLY', status: 'completed' },
    { type: 'task', text: 'STATUS_ERLEDIGT_ONLY', status: 'erledigt' },
    { type: 'task', text: 'STATUS_X_ONLY', status: 'x' },
    { type: 'task', text: 'STATUS_X_NEAR_MISS', status: 'xylophone' },
    { type: 'task', text: 'STATUS_EXTRA_NEAR_MISS', status: 'extra' },
    { type: 'task', text: 'STATUS_OPEN_ONLY', status: 'open' },
    { type: 'task', text: 'DONE_TRUE_ONLY', done: true },
    { type: 'task', text: 'STATUS_CLOSED_ONLY', status: 'closed' },
    { type: 'task', text: 'STATUS_FINISHED_ONLY', status: 'finished' },
    { type: 'task', text: 'STATUS_ABGESCHLOSSEN_ONLY', status: 'abgeschlossen' }
  ] });
  var statusPrompt = buildDayReviewContextPromptBlock(statusDay);
  return { prompt: prompt, legacyPrompt: legacyPrompt, longCardEnd: longCardEnd, longTextEnd: longTextEnd, habitText: habitText, togglText: togglText, longPrompt: longPrompt, malformed: malformed, incompatible: incompatible, habitJson: habitJson, togglJson: togglJson, csv: csv, statusPrompt: statusPrompt };
})()`, context);

assert.ok(result.prompt.includes(result.longCardEnd));
for (let i = 1; i <= 13; i++) assert.ok(result.prompt.includes(`RAW_CARD_${i}`));
for (let i = 1; i <= 9; i++) assert.ok(result.prompt.includes(`TASK_OBJECT_${i}`));
assert.match(result.prompt, /Sonstige \/ unbekannte Objekte[\s\S]*UNKNOWN_OBJECT/);
assert.match(result.prompt, /reviewDone: nein/);
assert.match(result.prompt, /Status: open/);
assert.doesNotMatch(result.prompt, /weitere .* nicht ausgeschrieben/);
assert.doesNotMatch(result.prompt, /CONVERTED_MARKER|DAILY_NOTES_MARKER/);
assert.match(result.legacyPrompt, /LEGACY-FALLBACK[\s\S]*CONVERTED_MARKER/);
assert.match(result.habitText, /Habit: Read[\s\S]*Daily: Walk/);
assert.doesNotMatch(result.habitText, /Habits: 0/);
assert.match(result.togglText, /Deep work 02:30 TOTAL/);
assert.doesNotMatch(result.togglText, /Gesamtzeit: 0/);
assert.ok(result.longPrompt.includes(result.longTextEnd));
assert.match(result.habitJson, /Habitica – Überblick[\s\S]*JSON_DAILY/);
assert.match(result.togglJson, /Toggl – Tagesübersicht[\s\S]*JSON_TOGGL/);
assert.match(result.malformed, /\{broken RAW_FALLBACK/);
assert.match(result.incompatible, /INCOMPATIBLE_RAW/);
assert.match(result.csv, /date,amount[\s\S]*2026-07-20,-4\.20/);
function objectLine(marker) {
  return result.statusPrompt.split('\n').find((line) => line.includes(marker)) || '';
}
assert.match(objectLine('STATUS_COMPLETED_ONLY'), /Status: completed.*done: ja/);
assert.doesNotMatch(objectLine('STATUS_COMPLETED_ONLY'), /done: nein/);
assert.match(objectLine('STATUS_ERLEDIGT_ONLY'), /Status: erledigt.*done: ja/);
assert.doesNotMatch(objectLine('STATUS_ERLEDIGT_ONLY'), /done: nein/);
assert.match(objectLine('STATUS_X_ONLY'), /Status: x.*done: ja/);
assert.doesNotMatch(objectLine('STATUS_X_ONLY'), /done: nein/);
assert.match(objectLine('STATUS_X_NEAR_MISS'), /Status: xylophone.*done: nein/);
assert.match(objectLine('STATUS_EXTRA_NEAR_MISS'), /Status: extra.*done: nein/);
assert.match(objectLine('STATUS_OPEN_ONLY'), /Status: open.*done: nein/);
assert.match(objectLine('DONE_TRUE_ONLY'), /done: ja/);
assert.match(objectLine('STATUS_CLOSED_ONLY'), /Status: closed.*done: ja/);
assert.match(objectLine('STATUS_FINISHED_ONLY'), /Status: finished.*done: ja/);
assert.match(objectLine('STATUS_ABGESCHLOSSEN_ONLY'), /Status: abgeschlossen.*done: ja/);

const persistence = vm.runInContext(`(function () {
  var session = getSession();
  session.quantImports = [{ source: 'daylio', parseKind: 'csv', rawText: 'q'.repeat(100000) + 'PERSIST_END', label: 'large' }];
  var fullPrompt = buildPromptText('startWeeklyReview', session);
  document.getElementById('promptOutput').textContent = '';
  previewPrompt('startWeeklyReview');
  var previewText = document.getElementById('promptOutput').textContent;
  copyPromptOutput();
  for (var i = 1; i < 12; i++) rememberPrompt('startWeeklyReview', fullPrompt);
  session.promptHistory[11] = { id: 'legacy', type: 'old', createdAt: '2020-01-01', prompt: 'L'.repeat(90000) + 'LEGACY_END' };
  session.currentFocus = 'saved-after-large-prompts';
  save(true);
  return { fullPrompt: fullPrompt, previewText: previewText, history: session.promptHistory, stored: localStorage.getItem(LKEY) };
})()`, context);
assert.ok(persistence.fullPrompt.includes('PERSIST_END'));
assert.ok(persistence.previewText.includes('PERSIST_END'));
assert.ok(clipboardText.includes('PERSIST_END'));
assert.equal(persistence.history.length, 12);
assert.ok(persistence.history.every((entry) => entry.prompt.length <= 4000));
assert.ok(persistence.history.every((entry) => entry.truncated && entry.originalLength > 90000));
assert.ok(persistence.history.some((entry) => entry.id === 'legacy' && entry.originalLength === 90010));
assert.ok(persistence.history.every((entry) => !Object.values(entry).some((value) => typeof value === 'string' && value.length > 4000)));
assert.ok(JSON.stringify(persistence.history).length < 55000);
assert.ok(persistence.stored.length < persistence.fullPrompt.length * 2);
const persistedState = JSON.parse(persistence.stored);
const persistedSession = persistedState.sessions.find((session) => session.id === persistedState.currentSessionId);
assert.equal(persistedSession.currentFocus, 'saved-after-large-prompts');
assert.ok(persistedSession.promptHistory.every((entry) => entry.prompt.length <= 4000));
console.log('prompt regression fixtures passed');
