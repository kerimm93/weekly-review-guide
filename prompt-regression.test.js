const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const html = fs.readFileSync('index.html', 'utf8');
function readZipJson(path) {
  return JSON.parse(execFileSync('unzip', ['-p', 'test-data/dailylog-testset.zip', path], { encoding: 'utf8' }));
}
const realFixtures = {
  day07: readZipJson('days/2026-04-07.json'),
  day08: readZipJson('days/2026-04-08.json'),
  today: readZipJson('today.json')
};
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
  document: { getElementById: element, querySelectorAll() { return []; } },
  realFixtures
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
  var day = { date: '2026-07-20', rawCards: cards.concat([{ text: 'DAILY_LOG_PRIORITY_MARKER' }]), objects: objects, tasks: [], events: [], feedItems: [{ text: 'FEED_END' }], migrations: [{ text: 'MIGRATION_END', targetHorizon: 'future' }], plan: 'PLAN_END', reviewDone: false, closedAt: '' };
  var session = blankSession();
  session.reviewPeriodStart = '2026-07-20';
  session.reviewPeriodEnd = '2026-07-26';
  session.dailyLogAppliedDays = [day];
  session.convertedDays = 'CONVERTED_DAYS_SUPPRESSED_MARKER';
  session.dailyNotesRaw = 'MANUAL_NOTES_SUPPRESSED_BY_DAILY_LOG_MARKER';
  var prompt = buildPromptText('startWeeklyReview', session);
  var legacy = blankSession();
  legacy.convertedDays = 'CONVERTED_DAYS_PRIORITY_MARKER';
  legacy.dailyNotesRaw = 'MANUAL_NOTES_SUPPRESSED_BY_CONVERTED_MARKER';
  var legacyPrompt = buildPromptText('startWeeklyReview', legacy);
  var manual = blankSession();
  manual.dailyNotesRaw = 'MANUAL_DAILY_NOTES_FALLBACK_MARKER';
  var manualPrompt = buildPromptText('startWeeklyReview', manual);
  var whitespace = blankSession();
  whitespace.dailyNotesRaw = '   \\n\\t  ';
  var whitespacePrompt = buildPromptText('startWeeklyReview', whitespace);
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
    { type: 'task', text: 'STATUS_ABGESCHLOSSEN_ONLY', status: 'abgeschlossen' },
    { type: 'custom', text: 'UNKNOWN_METADATA_OBJECT', customMeta: { nested: 'UNKNOWN_NESTED_METADATA_MARKER' } }
  ] });
  var statusPrompt = buildDayReviewContextPromptBlock(statusDay);
  return { prompt: prompt, legacyPrompt: legacyPrompt, manualPrompt: manualPrompt, whitespacePrompt: whitespacePrompt, longCardEnd: longCardEnd, longTextEnd: longTextEnd, habitText: habitText, togglText: togglText, longPrompt: longPrompt, malformed: malformed, incompatible: incompatible, habitJson: habitJson, togglJson: togglJson, csv: csv, statusPrompt: statusPrompt };
})()`, context);

assert.ok(result.prompt.includes(result.longCardEnd));
for (let i = 1; i <= 13; i++) assert.ok(result.prompt.includes(`RAW_CARD_${i}`));
for (let i = 1; i <= 9; i++) assert.ok(result.prompt.includes(`TASK_OBJECT_${i}`));
assert.match(result.prompt, /Sonstige \/ unbekannte Objekte[\s\S]*UNKNOWN_OBJECT/);
assert.match(result.prompt, /reviewDone: nein/);
assert.match(result.prompt, /Status: open/);
assert.doesNotMatch(result.prompt, /weitere .* nicht ausgeschrieben/);
assert.match(result.prompt, /DAILY_LOG_PRIORITY_MARKER/);
assert.doesNotMatch(result.prompt, /CONVERTED_DAYS_SUPPRESSED_MARKER|MANUAL_NOTES_SUPPRESSED_BY_DAILY_LOG_MARKER/);
assert.match(result.legacyPrompt, /LEGACY-FALLBACK[\s\S]*CONVERTED_DAYS_PRIORITY_MARKER/);
assert.doesNotMatch(result.legacyPrompt, /MANUAL_NOTES_SUPPRESSED_BY_CONVERTED_MARKER/);
assert.match(result.manualPrompt, /DAILY NOTES DIESER WOCHE \(MANUELLER LEGACY-FALLBACK\)[\s\S]*MANUAL_DAILY_NOTES_FALLBACK_MARKER/);
assert.doesNotMatch(result.manualPrompt, /Keine Daily-Log-Tage für den Review-Zeitraum ausgewählt/);
assert.doesNotMatch(result.whitespacePrompt, /MANUELLER LEGACY-FALLBACK/);
assert.match(result.whitespacePrompt, /Keine Daily-Log-Tage für den Review-Zeitraum ausgewählt/);
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
assert.match(objectLine('UNKNOWN_METADATA_OBJECT'), /customMeta\.nested: UNKNOWN_NESTED_METADATA_MARKER/);

const realData = vm.runInContext(`(function () {
  var sourceBefore = JSON.stringify(realFixtures);
  var split = { S: { days: [realFixtures.day07, realFixtures.day08] }, TODAY: realFixtures.today };
  var rawDays = extractDayArray(split);
  var days = rawDays.map(normalizeImportedDay);
  var onlyToday = extractDayArray({ S: { days: [] }, TODAY: realFixtures.today });
  var duplicateToday = extractDayArray({ S: { days: [realFixtures.today] }, TODAY: realFixtures.today });
  var generic = extractDayArray({ days: [realFixtures.day07] });
  var createdAtArchive = { createdAt: '2026-05-01T08:00:00.000Z', notes: 'CREATED_AT_ARCHIVE_PRIORITY' };
  var createdAtDedupe = extractDayArray({ S: { days: [createdAtArchive] }, TODAY: { date: '2026-05-01', notes: 'TODAY_SUPPRESSED' } });
  var updatedAtArchive = { updatedAt: '2026-05-02T09:00:00.000Z', notes: 'UPDATED_AT_ARCHIVE_PRIORITY' };
  var updatedAtDedupe = extractDayArray({ S: { days: [updatedAtArchive] }, TODAY: { isoDate: '2026-05-02', notes: 'TODAY_SUPPRESSED' } });
  var todayCreatedAtDedupe = extractDayArray({ S: { days: [{ date: '2026-05-03', notes: 'DATED_ARCHIVE_PRIORITY' }] }, TODAY: { createdAt: '2026-05-03T10:00:00.000Z', notes: 'TODAY_SUPPRESSED' } });
  var differentDates = extractDayArray({ S: { days: [{ updatedAt: '2026-05-04T10:00:00.000Z' }] }, TODAY: { updatedAt: '2026-05-05T10:00:00.000Z' } });
  var session = blankSession();
  session.reviewPeriodStart = '2026-04-07';
  session.reviewPeriodEnd = '2026-04-09';
  session.dailyLogAppliedDays = days;
  var prompt = buildPromptText('startWeeklyReview', session);
  var day08 = days.find(function (day) { return day.date === '2026-04-08'; });
  var important = day08.objects.find(function (obj) { return obj.text === 'Wichtige Aufgabe für den Morgen erledigen.'; });
  var idea = days[0].objects.find(function (obj) { return obj.text === 'Neues Konzept für Workflow-Optimierung skizziert.'; });
  var migration = day08.migrations[0];
  var overview = buildWeeklyTaskOverview(days);
  var overviewPrompt = buildWeeklyTaskOverviewPromptText(session, days);
  var dayBlock = buildDayReviewContextPromptBlock(day08);
  var legacyOverview = buildWeeklyTaskOverview([{ date: '2026-01-01', migrations: [{ text: 'LEGACY_MIGRATION', targetHorizon: 'future_log', targetLabel: 'Later' }] }]);
  return {
    dates: rawDays.map(function (day) { return day.date; }), onlyToday: onlyToday.length, duplicateToday: duplicateToday.length, generic: generic.length,
    createdAtDedupe: createdAtDedupe, createdAtNormalizedDates: createdAtDedupe.map(normalizeImportedDay).map(function (day) { return day.date; }),
    updatedAtDedupe: updatedAtDedupe, updatedAtNormalizedDates: updatedAtDedupe.map(normalizeImportedDay).map(function (day) { return day.date; }),
    todayCreatedAtDedupe: todayCreatedAtDedupe, differentDates: differentDates,
    objectCount: days.reduce(function (sum, day) { return sum + day.objects.length; }, 0), prompt: prompt,
    important: important, importantLine: formatDailyLogObjectForPrompt(important), idea: idea, ideaLine: formatDailyLogObjectForPrompt(idea),
    migration: migration, migrationCount: countMigrationLikeItems(day08), dayBlock: dayBlock, overview: overview, overviewPrompt: overviewPrompt,
    legacyOverview: legacyOverview, sourceUnchanged: sourceBefore === JSON.stringify(realFixtures)
  };
})()`, context);
assert.deepEqual([...realData.dates], ['2026-04-07', '2026-04-08', '2026-04-09']);
assert.equal(new Set(realData.dates).size, 3);
assert.equal(realData.onlyToday, 1);
assert.equal(realData.duplicateToday, 1);
assert.equal(realData.generic, 1);
assert.equal(realData.createdAtDedupe.length, 1);
assert.equal(realData.createdAtDedupe[0].notes, 'CREATED_AT_ARCHIVE_PRIORITY');
assert.deepEqual([...realData.createdAtNormalizedDates], ['2026-05-01']);
assert.equal(realData.updatedAtDedupe.length, 1);
assert.equal(realData.updatedAtDedupe[0].notes, 'UPDATED_AT_ARCHIVE_PRIORITY');
assert.deepEqual([...realData.updatedAtNormalizedDates], ['2026-05-02']);
assert.equal(realData.todayCreatedAtDedupe.length, 1);
assert.equal(realData.todayCreatedAtDedupe[0].notes, 'DATED_ARCHIVE_PRIORITY');
assert.equal(realData.differentDates.length, 2);
assert.equal(realData.objectCount, 13);
assert.match(realData.prompt, /Idee festgehalten für später\./);
for (const marker of ['06:55', '@tools', 'hoch', '45min', 'confidence: hoch', 'needsReview: false', '1000000000000000310', '1000000000000000301', '2026-04-08T06:55:00.000Z', 'source.kind: extract', '1000000000000000399', '2026-04-08T20:45:00.000Z', 'Status: x', 'done: ja']) assert.ok(realData.importantLine.includes(marker), marker);
for (const marker of ['needsReview: true', 'signifiers: *', 'confidence: mittel', '@setup']) assert.ok(realData.ideaLine.includes(marker), marker);
assert.equal(realData.important.typ, 'aufgabe');
assert.equal(realData.important.zeit, '06:55');
assert.equal(realData.important.kontext, '@tools');
assert.ok(Array.isArray(realData.important.contexts));
assert.ok(Array.isArray(realData.important.signifiers));
assert.equal(realData.important.source.kind, 'extract');
assert.equal(realData.important.needsReview, false);
assert.equal(realData.sourceUnchanged, true);
assert.equal(realFixtures.day08.taskMigrations.length, 1);
assert.equal(realData.migrationCount, 1);
assert.equal(realData.migration.objectId, '1000000000000000311');
assert.equal(realData.migration.migratedTo, '2026-04-09');
assert.equal(realData.migration.migratedAt, '2026-04-08T21:00:00.000Z');
assert.equal(realData.migration.text, 'Offene Aufgabe auf morgen verschieben.');
for (const marker of ['objectId: 1000000000000000311', 'migratedTo: 2026-04-09', 'migratedAt: 2026-04-08T21:00:00.000Z', 'Offene Aufgabe auf morgen verschieben.']) assert.ok(realData.dayBlock.includes(marker), marker);
assert.equal(realData.overview.uncertain.length, 1);
assert.equal(realData.overview.weeklyLog.length, 0);
assert.equal(realData.overview.futureLog.length, 0);
assert.equal(realData.overview.uncertain[0].text, 'Offene Aufgabe auf morgen verschieben.');
assert.match(realData.overviewPrompt, /Nicht sicher genug ableitbar:[\s\S]*Offene Aufgabe auf morgen verschieben\.[\s\S]*2026-04-09/);
assert.doesNotMatch(realData.overviewPrompt, /Nicht sicher genug ableitbar:\n- Keine unklaren Horizonte/);
assert.equal(realData.legacyOverview.futureLog[0].text, 'LEGACY_MIGRATION');

const persistence = vm.runInContext(`(function () {
  var session = getSession();
  session.dailyLogAppliedDays = [];
  session.convertedDays = '';
  session.dailyNotesRaw = 'q'.repeat(100000) + 'PERSIST_END';
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
