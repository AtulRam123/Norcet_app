const MS_PER_DAY = 24 * 60 * 60 * 1000;

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function takeUnique(target, source, count, seenIds) {
  for (const question of source) {
    if (target.length >= count) {
      return;
    }

    if (seenIds.has(question.id)) {
      continue;
    }

    seenIds.add(question.id);
    target.push(question);
  }
}

function toEpochDay(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  return Math.floor(Date.UTC(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10))
  ) / MS_PER_DAY);
}

export function deriveAtt(attempts) {
  return new Set(attempts.map((attempt) => attempt.qid));
}

export function deriveWrongIds(attempts) {
  const lastByQuestionId = new Map();

  attempts.forEach((attempt) => {
    lastByQuestionId.set(attempt.qid, attempt);
  });

  const wrongIds = new Set();
  lastByQuestionId.forEach((attempt, questionId) => {
    if (attempt.correct === false) {
      wrongIds.add(questionId);
    }
  });

  return wrongIds;
}

export function deriveHist(attempts) {
  const hist = {};

  attempts.forEach((attempt) => {
    if (!attempt.date || attempt.date === "unknown") {
      return;
    }

    if (!hist[attempt.date]) {
      hist[attempt.date] = { correct: 0, wrong: 0, total: 0 };
    }

    if (attempt.correct === true) {
      hist[attempt.date].correct += 1;
      hist[attempt.date].total += 1;
    }

    if (attempt.correct === false) {
      hist[attempt.date].wrong += 1;
      hist[attempt.date].total += 1;
    }
  });

  return hist;
}

export function deriveDayLog(attempts) {
  const log = {};

  attempts.forEach((attempt) => {
    if (!attempt.date || attempt.date === "unknown" || !attempt.selected) {
      return;
    }

    if (!log[attempt.date]) {
      log[attempt.date] = [];
    }

    if (!log[attempt.date].some((entry) => entry.qid === attempt.qid)) {
      log[attempt.date].push({
        qid: attempt.qid,
        myAnswer: attempt.selected,
        correct: attempt.correct,
      });
    }
  });

  return log;
}

export function deriveRecentAttemptIds(attempts, daysToBlock = 1, todayKey) {
  const todayEpoch = toEpochDay(todayKey);
  if (todayEpoch == null || daysToBlock <= 0) {
    return new Set();
  }

  const blockedIds = new Set();

  attempts.forEach((attempt) => {
    const attemptEpoch = toEpochDay(attempt.date);
    if (attemptEpoch == null) {
      return;
    }

    const daysAgo = todayEpoch - attemptEpoch;
    if (daysAgo >= 0 && daysAgo <= daysToBlock) {
      blockedIds.add(attempt.qid);
    }
  });

  return blockedIds;
}

export function getPresets(available) {
  const presets = [10, 25, 50, 75, 100].filter((count) => count <= available);

  if (available > 0 && available <= 100 && !presets.includes(available)) {
    presets.push(available);
  }

  presets.sort((left, right) => left - right);
  return presets.length ? presets : available > 0 ? [available] : [];
}

export function pickPool(allQuestions, attemptedIds, wrongIds, count, recentAttemptIds = new Set()) {
  const cleanCount = Math.max(0, Math.min(count, allQuestions.length));
  if (cleanCount === 0) {
    return [];
  }

  const isRecent = (question) => recentAttemptIds.has(question.id);
  const preferredFresh = allQuestions.filter((question) => !attemptedIds.has(question.id) && !isRecent(question));
  const preferredWrong = allQuestions.filter((question) => wrongIds.has(question.id) && !isRecent(question));
  const preferredPrevCorrect = allQuestions.filter(
    (question) => attemptedIds.has(question.id) && !wrongIds.has(question.id) && !isRecent(question)
  );

  const fallbackFresh = allQuestions.filter((question) => !attemptedIds.has(question.id));
  const fallbackWrong = allQuestions.filter((question) => wrongIds.has(question.id));
  const fallbackPrevCorrect = allQuestions.filter(
    (question) => attemptedIds.has(question.id) && !wrongIds.has(question.id)
  );

  const wantWrong = Math.floor(cleanCount * 0.4);
  const wantFresh = Math.floor(cleanCount * 0.4);
  const picked = [];
  const seenIds = new Set();

  takeUnique(picked, shuffle(preferredWrong), wantWrong, seenIds);
  takeUnique(picked, shuffle(preferredFresh), wantWrong + wantFresh, seenIds);
  takeUnique(picked, shuffle(preferredPrevCorrect), cleanCount, seenIds);

  takeUnique(picked, shuffle(fallbackFresh), cleanCount, seenIds);
  takeUnique(picked, shuffle(fallbackWrong), cleanCount, seenIds);
  takeUnique(picked, shuffle(fallbackPrevCorrect), cleanCount, seenIds);
  takeUnique(picked, shuffle(allQuestions), cleanCount, seenIds);

  return shuffle(picked).slice(0, cleanCount).map((question) => question.id);
}

export function getSessionDoneCount(session) {
  return Object.keys(session?.mockAnswers || {}).length;
}
