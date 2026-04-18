const VALID_OPTION_KEYS = new Set(["A", "B", "C", "D", "E"]);

export const LS_V2 = "norcet_app_v2";
export const LS_ATT = "norcet_att_v9";
export const LS_HIST = "norcet_hist_v9";
export const LS_WRONG = "norcet_wrong_v9";
export const LS_WMAP = "norcet_wmap_v9";
export const LS_SET = "norcet_set_v9";
export const LS_SESS = "norcet_sess_v9";
export const LS_BOOK = "norcet_book_v9";
export const LS_DAY_LOG = "norcet_daylog_v9";

export function toDateKey(date = new Date()) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return normalized.toISOString().slice(0, 10);
}

export function todayStr() {
  return toDateKey();
}

function loadState(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

function saveState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function sanitizeSettings(settings) {
  const theme = settings?.theme;
  return {
    userName: typeof settings?.userName === "string" ? settings.userName.trim() : "",
    theme: theme === "dark" || theme === "light" || theme === "system" ? theme : "system",
  };
}

function sanitizeAttempt(attempt, validQuestionIds, index) {
  if (!attempt || typeof attempt !== "object" || !validQuestionIds.has(attempt.qid)) {
    return null;
  }

  const selected = VALID_OPTION_KEYS.has(attempt.selected) ? attempt.selected : null;
  const correct = typeof attempt.correct === "boolean" ? attempt.correct : null;
  const date = typeof attempt.date === "string" && attempt.date.trim() ? attempt.date : "unknown";
  const sessionId = typeof attempt.sessionId === "string" && attempt.sessionId.trim()
    ? attempt.sessionId
    : `legacy_${index}`;

  return {
    qid: attempt.qid,
    selected,
    correct,
    date,
    sessionId,
  };
}

function dedupeAttempts(attempts) {
  const seenByKey = new Map();

  attempts.forEach((attempt) => {
    const key = `${attempt.sessionId}::${attempt.qid}`;
    seenByKey.set(key, attempt);
  });

  return [...seenByKey.values()];
}

function sanitizeMockAnswers(mockAnswers, validQuestionIds) {
  if (!mockAnswers || typeof mockAnswers !== "object") {
    return {};
  }

  const cleanAnswers = {};

  Object.entries(mockAnswers).forEach(([questionId, answer]) => {
    if (validQuestionIds.has(questionId) && VALID_OPTION_KEYS.has(answer)) {
      cleanAnswers[questionId] = answer;
    }
  });

  return cleanAnswers;
}

function sanitizeSession(session, index, validQuestionIds, usedSessionIds) {
  if (!session || typeof session !== "object") {
    return null;
  }

  const rawPoolIds = Array.isArray(session.poolIds) ? session.poolIds : [];
  const poolIds = [...new Set(rawPoolIds.filter((questionId) => validQuestionIds.has(questionId)))];
  const baseId = typeof session.id === "string" && session.id.trim() ? session.id : `session_${index + 1}`;
  let sessionId = baseId;
  let suffix = 2;

  while (usedSessionIds.has(sessionId)) {
    sessionId = `${baseId}_${suffix}`;
    suffix += 1;
  }

  usedSessionIds.add(sessionId);

  const mockAnswers = sanitizeMockAnswers(session.mockAnswers, validQuestionIds);
  const doneCount = Object.keys(mockAnswers).length;
  const poolIdx = Math.max(0, Math.min(Number.isFinite(session.poolIdx) ? session.poolIdx : doneCount, poolIds.length));

  return {
    id: sessionId,
    date: typeof session.date === "string" && session.date.trim() ? session.date : todayStr(),
    correct: Number.isFinite(session.correct) ? Math.max(0, session.correct) : 0,
    wrong: Number.isFinite(session.wrong) ? Math.max(0, session.wrong) : 0,
    poolIds,
    poolIdx,
    isMock: Boolean(session.isMock),
    timeLeft: session.timeLeft == null ? null : Math.max(0, Number(session.timeLeft) || 0),
    target: Number.isFinite(session.target) ? Math.max(0, session.target) : poolIds.length,
    mockAnswers,
  };
}

function initialUnified(questionBankSignature, settings = { userName: "", theme: "system" }) {
  return {
    attempts: [],
    sessions: [],
    bookmarks: [],
    settings: sanitizeSettings(settings),
    wrongMap: {},
    questionBankSignature,
  };
}

function sanitizeUnified(unified, validQuestionIds, questionBankSignature) {
  const usedSessionIds = new Set();
  const attempts = dedupeAttempts(
    (Array.isArray(unified?.attempts) ? unified.attempts : [])
      .map((attempt, index) => sanitizeAttempt(attempt, validQuestionIds, index))
      .filter(Boolean)
  );

  const sessions = (Array.isArray(unified?.sessions) ? unified.sessions : [])
    .map((session, index) => sanitizeSession(session, index, validQuestionIds, usedSessionIds))
    .filter((session) => session && session.poolIds.length)
    .slice(0, 10);

  const bookmarks = [...new Set(
    (Array.isArray(unified?.bookmarks) ? unified.bookmarks : [])
      .filter((questionId) => validQuestionIds.has(questionId))
  )];

  const wrongMap = {};
  Object.entries(unified?.wrongMap || {}).forEach(([questionId, answer]) => {
    if (validQuestionIds.has(questionId) && VALID_OPTION_KEYS.has(answer)) {
      wrongMap[questionId] = answer;
    }
  });

  return {
    attempts,
    sessions,
    bookmarks,
    settings: sanitizeSettings(unified?.settings),
    wrongMap,
    questionBankSignature,
  };
}

function migrateLegacy(validQuestionIds, questionBankSignature) {
  const legacyAttempts = [];
  const legacyAtt = new Set(loadState(LS_ATT, []));
  const legacyDayLog = loadState(LS_DAY_LOG, {});
  const legacyBookmarks = loadState(LS_BOOK, []);
  const legacySettings = loadState(LS_SET, { userName: "" });
  const legacySession = loadState(LS_SESS, null);
  const legacyWrongMap = loadState(LS_WMAP, {});

  Object.entries(legacyDayLog || {}).forEach(([date, entries]) => {
    (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
      legacyAttempts.push({
        qid: entry?.qid,
        selected: entry?.myAnswer,
        correct: entry?.correct,
        date,
        sessionId: `legacy_${date}_${index}`,
      });
    });
  });

  legacyAtt.forEach((questionId) => {
    if (!legacyAttempts.some((attempt) => attempt.qid === questionId)) {
      legacyAttempts.push({
        qid: questionId,
        selected: null,
        correct: null,
        date: "unknown",
        sessionId: "legacy",
      });
    }
  });

  const migrated = {
    attempts: legacyAttempts,
    sessions: legacySession ? [legacySession] : [],
    bookmarks: legacyBookmarks,
    settings: legacySettings,
    wrongMap: legacyWrongMap,
    questionBankSignature,
  };

  return sanitizeUnified(migrated, validQuestionIds, questionBankSignature);
}

export function clearAppStorage() {
  [
    LS_V2,
    LS_ATT,
    LS_HIST,
    LS_WRONG,
    LS_WMAP,
    LS_SET,
    LS_SESS,
    LS_BOOK,
    LS_DAY_LOG,
  ].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
}

export function persistUnified(unified) {
  saveState(LS_V2, unified);
}

export function loadUnified(validQuestionIds, questionBankSignature) {
  const stored = loadState(LS_V2, null);

  if (stored?.questionBankSignature && stored.questionBankSignature !== questionBankSignature) {
    const preservedSettings = sanitizeSettings(stored.settings);
    clearAppStorage();
    const resetState = initialUnified(questionBankSignature, preservedSettings);
    persistUnified(resetState);
    return resetState;
  }

  if (stored) {
    const sanitized = sanitizeUnified(stored, validQuestionIds, questionBankSignature);
    persistUnified(sanitized);
    return sanitized;
  }

  const migrated = migrateLegacy(validQuestionIds, questionBankSignature);
  persistUnified(migrated);
  return migrated;
}
