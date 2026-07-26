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

const context = { console, setTimeout, clearTimeout, Blob, URL, Date, Math };
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
  var longRaw = 'z'.repeat(12500) + longTextEnd;
  var habitText = buildQuantImportPromptBlock({ source: 'habitica', parseKind: 'text', rawText: 'Habit: Read\\nDaily: Walk', label: 'txt' });
  var togglText = buildQuantImportPromptBlock({ source: 'toggl', parseKind: 'text', rawText: 'Deep work 02:30 TOTAL', label: 'txt' });
  var longPrompt = buildQuantImportPromptBlock({ source: 'daylio', parseKind: 'csv', rawText: longRaw, label: 'csv' });
  var malformed = buildQuantImportPromptBlock({ source: 'habitica', parseKind: 'json', parsedJson: null, rawText: '{broken RAW_FALLBACK' });
  var incompatible = buildQuantImportPromptBlock({ source: 'toggl', parseKind: 'json', parsedJson: { unrelated: true }, rawText: '{\"unrelated\":true} INCOMPATIBLE_RAW' });
  var habitJson = buildQuantImportPromptBlock({ source: 'habitica', parseKind: 'json', parsedJson: { tasks: { habits: [], dailys: [{ text: 'JSON_DAILY' }], todos: [] } }, rawText: '{}' });
  var togglJson = buildQuantImportPromptBlock({ source: 'toggl', parseKind: 'json', parsedJson: { entries: [{ description: 'JSON_TOGGL', duration: 60, date: '2026-07-20' }] }, rawText: '{}' });
  var csv = buildQuantImportPromptBlock({ source: 'bank', parseKind: 'csv', rawText: 'date,amount\\n2026-07-20,-4.20', label: 'bank' });
  return { prompt: prompt, legacyPrompt: legacyPrompt, longCardEnd: longCardEnd, longTextEnd: longTextEnd, habitText: habitText, togglText: togglText, longPrompt: longPrompt, malformed: malformed, incompatible: incompatible, habitJson: habitJson, togglJson: togglJson, csv: csv };
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
console.log('prompt regression fixtures passed');
