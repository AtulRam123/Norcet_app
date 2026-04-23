import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ALL_QUESTIONS, QUESTION_BANK_SIGNATURE, QUESTION_ID_SET } from "./questionBank";
import { deriveAtt, deriveWrongIds, deriveHist, deriveDayLog, deriveRecentAttemptIds, getPresets, pickPool, getSessionDoneCount } from "./questionLogic";
import { todayStr, toDateKey, loadUnified, persistUnified, clearAppStorage } from "./storage";
import { DAILY_NOTES, CORRECT_MSGS, WRONG_MSGS, DONE_MSGS, MONTHS, WDAYS, rand } from "./content";
import FloatingHearts from "./components/FloatingHearts";
import { CSS } from "./styles";

const MOCK_SPQ = 72;

export default function NorcetMCQApp() {
  const allQ = ALL_QUESTIONS;
  const totalQ = allQ.length;
  const todayKey = todayStr();

  const qMap = useMemo(() => {
    const m = {};
    allQ.forEach(q => { m[q.id] = q; });
    return m;
  }, [allQ]);

  const [unified, setUnified] = useState(() => loadUnified(QUESTION_ID_SET, QUESTION_BANK_SIGNATURE));
  const [completedSessionId, setCompletedSessionId] = useState(null);

  const patchUnified = useCallback((patch) => {
    setUnified(prev => {
      const next = { ...prev, ...patch };
      persistUnified(next);
      return next;
    });
  }, []);

  const att      = useMemo(() => deriveAtt(unified.attempts),     [unified.attempts]);
  const wrongIds = useMemo(() => deriveWrongIds(unified.attempts), [unified.attempts]);
  const hist     = useMemo(() => deriveHist(unified.attempts),     [unified.attempts]);
  const dayLog   = useMemo(() => deriveDayLog(unified.attempts),   [unified.attempts]);
  const recentAttemptIds = useMemo(() => deriveRecentAttemptIds(unified.attempts, 1, todayKey), [unified.attempts, todayKey]);

  const activeSess = useMemo(() => {
    const sessions = unified.sessions || [];
    return sessions.find(s => s.poolIdx < (s.poolIds?.length || 0) && !(s.isMock && s.timeLeft === 0)) || null;
  }, [unified.sessions]);
  const incompleteSessions = useMemo(() => {
    const sessions = unified.sessions || [];
    return sessions.filter(s => s.poolIdx < (s.poolIds?.length || 0) && !(s.isMock && s.timeLeft === 0));
  }, [unified.sessions]);
  const completedSession = useMemo(() => {
    if (!completedSessionId) return null;
    return (unified.sessions || []).find((s) => s.id === completedSessionId) || null;
  }, [completedSessionId, unified.sessions]);

  const sess       = activeSess;
  const sessIdx    = sess ? sess.poolIdx : 0;
  const sessPool   = sess ? sess.poolIds : [];
  const sessTotal  = sessPool.length;
  const currentQ   = sess && sessIdx < sessTotal ? qMap[sessPool[sessIdx]] || null : null;
  const sessDone   = sess ? Math.max(sess.poolIdx || 0, getSessionDoneCount(sess)) : 0;
  const sessPct    = sessTotal ? Math.round((sessDone / sessTotal) * 100) : 0;
  const sessCorrect= sess?.correct || 0;
  const sessWrong  = sess?.wrong   || 0;
  const sessAcc    = (sessCorrect + sessWrong) > 0 ? Math.round((sessCorrect / (sessCorrect + sessWrong)) * 100) : 0;
  const isDone     = !!sess && (sessIdx >= sessTotal || (sess.isMock && sess.timeLeft === 0));
  const sessionActive = !!sess && !isDone;
  const continueSession = incompleteSessions[0] || null;
  const doneSession = completedSession || (isDone ? sess : null);
  const doneTotal = doneSession?.poolIds?.length || 0;
  const doneCorrect = doneSession?.correct || 0;
  const doneWrong = doneSession?.wrong || 0;
  const doneAccuracy = (doneCorrect + doneWrong) > 0 ? Math.round((doneCorrect / (doneCorrect + doneWrong)) * 100) : 0;

  // ── Timer ──
  const [mockDone, setMockDone] = useState(false);
  const timerRef  = useRef(null);
  const sessIdRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (!sess?.isMock || mockDone || !sessionActive) return;
    if (sess.timeLeft <= 0) { setMockDone(true); return; }
    sessIdRef.current = sess.id;
    timerRef.current = setInterval(() => {
      setUnified(prev => {
        const sessions = prev.sessions || [];
        const idx = sessions.findIndex(s => s.id === sess.id);
        if (idx === -1) return prev;
        const tl = (sessions[idx].timeLeft || 0) - 1;
        if (tl <= 0) { clearInterval(timerRef.current); timerRef.current = null; setMockDone(true); }
        const updated = [...sessions];
        updated[idx] = { ...updated[idx], timeLeft: Math.max(0, tl) };
        const next = { ...prev, sessions: updated };
        persistUnified(next);
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [sess?.id, sess?.isMock, sess?.timeLeft, mockDone, sessionActive]);

  // ── UI state ──
  const [tab,           setTab]          = useState("dashboard");
  const [sidebarOpen,   setSidebarOpen]  = useState(false);
  const [selected,      setSelected]     = useState(null);
  const [answered,      setAnswered]     = useState(false);
  const [loveFeedback,  setLoveFeedback] = useState("");
  const [showSetup,     setShowSetup]    = useState(false);
  const [showSettings,  setShowSettings] = useState(false);
  const [dayDetail,     setDayDetail]    = useState(null);
  const [wrongFilter,   setWrongFilter]  = useState("all");
  const [expandedExplanations, setExpandedExplanations] = useState({});
  const [calDate,       setCalDate]      = useState(new Date());
  const [loveNote]                       = useState(() => rand(DAILY_NOTES));
  const [localName,     setLocalName]    = useState("");
  const [setupSource,   setSetupSource]  = useState("adaptive");
  const [setupTopic,    setSetupTopic]   = useState("all");
  const [setupDifficulty, setSetupDifficulty] = useState("all");
  const [setupImageOnly, setSetupImageOnly] = useState(false);

  // Close sidebar when tab changes
  useEffect(() => { setSidebarOpen(false); }, [tab]);

  // Sync localName when modals open
  useEffect(() => { if (showSetup || showSettings) setLocalName(unified.settings?.userName || ""); }, [showSetup, showSettings, unified.settings]);

  // Prevent body scroll when sidebar open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const freshCount  = allQ.filter(q => !att.has(q.id)).length;
  const maxCount    = Math.min(Math.max(freshCount, wrongIds.size, 1), 100);
  const [setupCount,  setSetupCount]  = useState(10);
  const [setupPreset, setSetupPreset] = useState(10);
  const [isMockMode,  setIsMockMode]  = useState(false);

  // Reset to 10 every time setup modal opens
  useEffect(() => {
    if (showSetup) {
      const d = Math.min(10, maxCount);
      setSetupCount(d);
      setSetupPreset(d);
    }
  }, [showSetup, maxCount]);

  const settings = useMemo(() => unified.settings || { userName: "" }, [unified.settings]);
  const userName  = settings.userName || "";
  const themePreference = settings.theme || "system";

  const totalCorrect = Object.values(hist).reduce((a, h) => a + (h.correct || 0), 0);
  const totalAllH    = Object.values(hist).reduce((a, h) => a + (h.total   || 0), 0);
  const overallAcc   = totalAllH ? Math.round((totalCorrect / totalAllH) * 100) : 0;

  const streak = useMemo(() => {
    let s = 0; const d = new Date();
    for (let i = 0; i < 730; i++) {
      const k = d.toISOString().slice(0, 10);
      if (!hist[k]) break;
      s++; d.setDate(d.getDate() - 1);
    }
    return s;
  }, [hist]);

  const topicStats = useMemo(() => {
    const stats = {};
    unified.attempts.forEach(a => {
      const q = qMap[a.qid];
      if (!q?.topic) return;
      if (!stats[q.topic]) stats[q.topic] = { correct: 0, wrong: 0, total: 0 };
      if (a.correct === true)  { stats[q.topic].correct++; stats[q.topic].total++; }
      if (a.correct === false) { stats[q.topic].wrong++;   stats[q.topic].total++; }
    });
    return stats;
  }, [unified.attempts, qMap]);
  const topicOptions = useMemo(() => [...new Set(allQ.map((q) => q.topic).filter(Boolean))].sort(), [allQ]);
  const weakAreas = useMemo(() => (
    Object.entries(topicStats)
      .map(([topic, stats]) => {
        const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
        return {
          topic,
          ...stats,
          accuracy,
          pressure: stats.wrong * 2 + Math.max(0, 75 - accuracy),
        };
      })
      .filter((entry) => entry.wrong > 0)
      .sort((left, right) => right.pressure - left.pressure || right.wrong - left.wrong)
      .slice(0, 5)
  ), [topicStats]);

  const hr         = new Date().getHours();
  const greetWord  = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : "Good Evening";
  const greetEmoji = hr < 12 ? "🌅" : hr < 17 ? "☀️" : "🌙";
  const displayName = useMemo(() => {
    const firstName = (userName || "").trim().split(/\s+/)[0] || "";
    if (/^mimansa$/i.test(firstName)) {
      return "Mimi";
    }
    return firstName;
  }, [userName]);
  const name1 = displayName;
  const mockTimeLeft = sess?.timeLeft || 0;
  const mockTimePct  = sess?.isMock ? Math.max(0, (mockTimeLeft / ((sessTotal || 1) * MOCK_SPQ)) * 100) : 0;
  const mockTimeFmt  = `${String(Math.floor(mockTimeLeft / 60)).padStart(2, "0")}:${String(mockTimeLeft % 60).padStart(2, "0")}`;
  const timerColor   = mockTimeLeft < 300 ? "var(--wrong)" : mockTimeLeft < 600 ? "var(--gold)" : "var(--teal)";
  const resolvedTheme = useMemo(() => {
    if (themePreference === "dark") {
      return "dark";
    }
    if (themePreference === "light") {
      return "light";
    }
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }, [themePreference]);

  useEffect(() => {
    document.body.dataset.theme = resolvedTheme;
    return () => {
      delete document.body.dataset.theme;
    };
  }, [resolvedTheme]);

  const buildSessionIds = useCallback((sourceQuestions, count, sourceMode = "adaptive") => {
    if (!sourceQuestions.length) return [];

    if (sourceMode === "fresh-only") {
      const preferred = sourceQuestions.filter((question) => !att.has(question.id) && !recentAttemptIds.has(question.id));
      const fallback = sourceQuestions.filter((question) => !att.has(question.id));
      return pickPool(preferred.length ? preferred : fallback, new Set(), new Set(), count, new Set());
    }

    if (sourceMode === "wrong-only" || sourceMode === "bookmarked" || sourceMode === "image-only") {
      return pickPool(sourceQuestions, new Set(), wrongIds, count, recentAttemptIds);
    }

    return pickPool(sourceQuestions, att, wrongIds, count, recentAttemptIds);
  }, [att, wrongIds, recentAttemptIds]);

  const startSession = useCallback((count, mock, sourceQuestions = allQ, sourceMode = "adaptive") => {
    const ids = buildSessionIds(sourceQuestions, count, sourceMode);
    if (!ids.length) return;
    const sessionId = `sess_${Date.now()}`;
    const newSess = {
      id: sessionId, date: todayStr(), correct: 0, wrong: 0,
      poolIds: ids, poolIdx: 0, isMock: !!mock,
      timeLeft: mock ? ids.length * MOCK_SPQ : null,
      target: count, mockAnswers: {},
    };
    patchUnified({ sessions: [newSess, ...(unified.sessions || []).slice(0, 9)], settings: { ...settings, userName } });
    setSelected(null); setAnswered(false); setMockDone(false); setLoveFeedback("");
    setCompletedSessionId(null);
    setShowSetup(false); setTab("practice");
  }, [allQ, buildSessionIds, unified.sessions, settings, userName, patchUnified]);

  const handleSelect = useCallback((key) => {
    if (answered || !currentQ || !sess) return;
    setSelected(key); setAnswered(true);
    const isCorrect = currentQ.answer ? key === currentQ.answer : null;
    if (isCorrect === true)  setLoveFeedback(rand(CORRECT_MSGS));
    else if (isCorrect === false) setLoveFeedback(rand(WRONG_MSGS));
    else setLoveFeedback("");
    const date = todayStr();
    setUnified(prev => {
      const attempts = [...prev.attempts, { qid: currentQ.id, selected: key, correct: isCorrect, date, sessionId: sess.id }];
      const sessions = (prev.sessions || []).map(s =>
        s.id !== sess.id ? s : { ...s, correct: s.correct + (isCorrect === true ? 1 : 0), wrong: s.wrong + (isCorrect === false ? 1 : 0), mockAnswers: { ...s.mockAnswers, [currentQ.id]: key } }
      );
      const wrongMap = { ...prev.wrongMap };
      if (isCorrect === false) wrongMap[currentQ.id] = key;
      else delete wrongMap[currentQ.id];
      const next = { ...prev, attempts, sessions, wrongMap };
      persistUnified(next);
      return next;
    });
  }, [answered, currentQ, sess]);

  const handleNext = useCallback(() => {
    if (!sess) return;
    const nextIdx = sess.poolIdx + 1;
    const completedNow = nextIdx >= sessTotal || (sess.isMock && (sess.timeLeft || 0) === 0);
    if (nextIdx >= sessTotal && sess.isMock) { setMockDone(true); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }
    setUnified(prev => {
      const sessions = (prev.sessions || []).map(s => s.id === sess.id ? { ...s, poolIdx: nextIdx } : s);
      const next = { ...prev, sessions };
      persistUnified(next);
      return next;
    });
    if (completedNow) setCompletedSessionId(sess.id);
    setSelected(null); setAnswered(false); setLoveFeedback("");
  }, [sess, sessTotal]);

  const bookmarks = useMemo(() => new Set(unified.bookmarks || []), [unified.bookmarks]);
  const toggleBookmark = useCallback((id) => {
    const nb = new Set(bookmarks);
    nb.has(id) ? nb.delete(id) : nb.add(id);
    patchUnified({ bookmarks: [...nb] });
  }, [bookmarks, patchUnified]);

  const handleReset = () => {
    clearAppStorage();
    window.location.reload();
  };

  const optClass = useCallback((key) => {
    if (!answered || !currentQ) return "";
    const ans = currentQ.answer;
    if (key === selected && ans && key === ans)  return "correct";
    if (key === selected && ans && key !== ans)  return "wrong";
    if (key !== selected && ans && key === ans)  return "reveal";
    return "";
  }, [answered, currentQ, selected]);

  const openDayDetail = (ds) => {
    const entries = dayLog[ds] || [];
    if (!entries.length) return;
    setDayDetail({ date: ds, entries });
  };

  const toggleExplanation = useCallback((questionId) => {
    setExpandedExplanations((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }, []);

  const renderExplanationCard = useCallback((question, meta, mode = "practice") => {
    if (!question || !meta) {
      return null;
    }

    const isExpanded = !!expandedExplanations[question.id];

    return (
      <div className={`explanation ${isExpanded ? "is-open" : "is-collapsed"} ${mode === "mistake" ? "is-mistake" : ""}`}>
        <button
          type="button"
          className="explanation-toggle"
          onClick={() => toggleExplanation(question.id)}
        >
          <span className="explanation-toggle-copy">
            <strong>{mode === "mistake" ? "Review Explanation" : "Explanation"}</strong>
            <span className="explanation-toggle-text">
              {isExpanded ? "Tap to hide the explanation" : "Tap to view the explanation"}
            </span>
          </span>
          <span className="explanation-toggle-icon" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
        </button>
        {isExpanded && (
          <div className="explanation-body">
            <div className="explanation-head">
              <strong>Why This Is Right</strong>
              <span className="explanation-chip">Precise</span>
            </div>
            <div className="explanation-main">
              {meta.answerText && (
                <div className="explanation-kicker">Correct Answer</div>
              )}
              {meta.answerText && (
                <div className="explanation-answer-row">
                  <span className="explanation-answer-badge">{question.answer}</span>
                  <span className="explanation-answer">{question.options[question.answer]}</span>
                </div>
              )}
              <div className="explanation-note explanation-note-main">{meta.primary}</div>
              {meta.detail && <div className="explanation-note">{meta.detail}</div>}
              {meta.imageHint && <div className="explanation-note explanation-note-hint">{meta.imageHint}</div>}
            </div>
            {meta.whyNotCards?.length > 0 && (
              <div className="explanation-why-not">
                <div className="explanation-subhead">Why Not The Others</div>
                {meta.whyNotCards.map((item, index) => (
                  <div key={`${question.id}-why-not-${index}`} className="explanation-option-card">
                    <span className="explanation-option-badge">{item.label}</span>
                    <span className="explanation-option-copy">
                      <span className="explanation-option-topline">
                        <span className="explanation-option-title">{item.title}</span>
                        {item.tag && <span className="explanation-option-tag">{item.tag}</span>}
                      </span>
                      {item.body && <span className="explanation-option-line">{item.body}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [expandedExplanations, toggleExplanation]);

  // Calendar helpers
  const calY     = calDate.getFullYear();
  const calM2    = calDate.getMonth();
  const firstDay = new Date(calY, calM2, 1).getDay();
  const daysInM  = new Date(calY, calM2 + 1, 0).getDate();
  const todayD   = new Date();
  const calCls   = (ds) => { const h = hist[ds]; if (!h || !h.total) return ""; const a = h.correct / h.total; return a === 1 ? "hd perfect" : a >= 0.6 ? "hd good" : "hd low"; };
  const pipColor = (ds) => { const h = hist[ds]; if (!h || !h.total) return null; const a = h.correct / h.total; return a === 1 ? "var(--teal)" : a >= 0.6 ? "var(--gold)" : "var(--wrong)"; };
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return toDateKey(d);
  }), []);

  const wrongQ      = useMemo(() => allQ.filter(q => wrongIds.has(q.id)), [allQ, wrongIds]);
  const bookmarkedQ = useMemo(() => allQ.filter(q => bookmarks.has(q.id)), [allQ, bookmarks]);
  const wrongMap    = unified.wrongMap || {};
  const canRevise   = wrongIds.size > 0;
  const imageQuestions = useMemo(() => allQ.filter((q) => q.image), [allQ]);
  const setupFilteredQuestions = useMemo(() => {
    return allQ.filter((question) => {
      if (setupTopic !== "all" && question.topic !== setupTopic) return false;
      if (setupDifficulty !== "all" && question.difficulty !== setupDifficulty) return false;
      if (setupImageOnly && !question.image) return false;
      if (setupSource === "bookmarked" && !bookmarks.has(question.id)) return false;
      if (setupSource === "wrong-only" && !wrongIds.has(question.id)) return false;
      if (setupSource === "image-only" && !question.image) return false;
      return true;
    });
  }, [allQ, bookmarks, wrongIds, setupDifficulty, setupImageOnly, setupSource, setupTopic]);
  const setupAvailableCount = useMemo(() => {
    if (setupSource === "fresh-only") {
      return setupFilteredQuestions.filter((question) => !att.has(question.id)).length;
    }
    return setupFilteredQuestions.length;
  }, [setupSource, setupFilteredQuestions, att]);
  const setupMaxCount = useMemo(() => Math.min(Math.max(setupAvailableCount, 1), 100), [setupAvailableCount]);
  const setupPresets = useMemo(() => getPresets(setupAvailableCount), [setupAvailableCount]);

  const handleSliderChange = useCallback((v) => {
    setSetupCount(v);
    const localPresets = getPresets(setupAvailableCount);
    const closest = localPresets.reduce((best, p) => Math.abs(p - v) < Math.abs(best - v) ? p : best, localPresets[0] || v);
    setSetupPreset(Math.abs(closest - v) <= 2 ? closest : null);
  }, [setupAvailableCount]);

  const handlePresetClick = useCallback((n) => { setSetupPreset(n); setSetupCount(n); }, []);

  useEffect(() => {
    if (!showSetup) return;
    setSetupCount((prev) => Math.min(Math.max(1, prev), setupMaxCount));
    if (setupPreset && setupPreset > setupMaxCount) {
      setSetupPreset(null);
    }
  }, [showSetup, setupMaxCount, setupPreset]);

  const imgSrc = (path) => { if (!path) return null; return path.startsWith("/") ? path : "/" + path; };

  const formatExplanation = useCallback((question) => {
    const raw = question?.explanation;
    if (!raw || typeof raw !== "string") {
      return null;
    }

    const cleaned = raw
      .replace(/\r\n/g, "\n")
      .replace(/^Explanation:\s*/i, "")
      .replace(/^Rationale:\s*/i, "")
      .replace(/\s+Why not:\s*/gi, "\nWhy not:\n")
      .replace(/(?<!\n)([A-E]\))\s*/g, "\n$1 ")
      .replace(/(?<!\n)-\s*([A-E]\))\s*/g, "\n$1 ")
      .trim();

    if (!cleaned) {
      return null;
    }

    const lines = cleaned
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((line) => !/^- /.test(line))
      .map((line) => {
        if (/^(Why not:|[A-E]\))/.test(line)) {
          return line;
        }
        return /[.!?]$/.test(line) ? line : `${line}.`;
      });

    return lines.join("\n");
  }, []);

  const classifyWhyNotTag = useCallback((text) => {
    const normalized = (text || "").toLowerCase();
    if (!normalized) return null;
    if (/(no single|not identified|contradicts|too absolute|always|never|conclusive|specific gene|deterministic)/.test(normalized)) {
      return "Overstatement";
    }
    if (/(does not address|not an explanation|epidemiological|observation|not relevant|off topic|doesn't explain)/.test(normalized)) {
      return "Off-topic";
    }
    if (/(little evidence|understate|too weak|minimizes|ignores|strong genetic|high heritability)/.test(normalized)) {
      return "Understatement";
    }
    if (/(opposite|incorrect|wrong direction|reverses|misstates)/.test(normalized)) {
      return "Incorrect framing";
    }
    return "Less accurate";
  }, []);

  const getExplanationMeta = useCallback((question, requireAnswered = false) => {
    if (!question || (requireAnswered && !answered)) {
      return null;
    }

    const explanation = formatExplanation(question);
    if (!explanation) {
      return null;
    }

    const answerText = question.answer && question.options[question.answer]
      ? `${question.answer}) ${question.options[question.answer]}`
      : null;

    const lines = explanation
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const whyNotIndex = lines.findIndex((line) => /^Why not:/i.test(line));
    const mainLines = whyNotIndex === -1 ? lines : lines.slice(0, whyNotIndex);
    const whyNotLines = whyNotIndex === -1 ? [] : lines.slice(whyNotIndex + 1);

    // Correct answer block: join all main lines, split into sentences
    const mainText = mainLines.join(" ");
    const allSentences = mainText.match(/[^.!?]+[.!?]+/g) || [mainText];
    const primary = allSentences[0]?.trim() || mainText;
    const detail = allSentences.slice(1).map(s => s.trim()).join(" ");

    // Wrong options: group consecutive continuation lines under their option label
    const grouped = [];
    let cur = null;
    for (const line of whyNotLines) {
      const m = line.match(/^([A-E])\)\s*(.*)$/);
      if (m) {
        if (cur) grouped.push(cur);
        cur = { id: m[1], label: `${m[1]})`, raw: m[2] };
      } else if (cur) {
        cur.raw = cur.raw ? `${cur.raw} ${line}` : line;
      }
    }
    if (cur) grouped.push(cur);

    const whyNotCards = grouped
      .filter((item) => item.id !== question.answer)
      .map((item) => {
        const sentences = (item.raw || "").match(/[^.!?]+[.!?]+/g) || [item.raw];
        const title = sentences[0]?.trim() || item.raw;
        const body = sentences.slice(1).map(s => s.trim()).join(" ");
        return {
          id: item.id,
          label: item.label,
          text: item.raw,
          title,
          body,
          tag: classifyWhyNotTag(item.raw),
        };
      });

    return {
      answerText,
      explanation,
      primary,
      detail,
      whyNotLines,
      whyNotCards,
      imageHint: question.image ? "For image-based items, focus on the key visual clue that matches the diagnosis, instrument, posture, graph, or finding." : null,
    };
  }, [answered, formatExplanation, classifyWhyNotTag]);

  const explanationMeta = useMemo(() => (
    getExplanationMeta(currentQ, true)
  ), [currentQ, getExplanationMeta]);

  const startRevision = useCallback(() => {
    const ids = pickPool(allQ, new Set(), wrongIds, Math.min(wrongIds.size, 30));
    if (!ids.length) return;
    const sessionId = `sess_${Date.now()}`;
    patchUnified({ sessions: [{ id: sessionId, date: todayStr(), correct: 0, wrong: 0, poolIds: ids, poolIdx: 0, isMock: false, timeLeft: null, target: ids.length, mockAnswers: {} }, ...(unified.sessions || []).slice(0, 9)] });
    setCompletedSessionId(null);
    setShowSetup(false); setTab("practice");
    setSelected(null); setAnswered(false); setMockDone(false); setLoveFeedback("");
  }, [allQ, wrongIds, unified.sessions, patchUnified]);
  const startBookmarkedRevision = useCallback(() => {
    if (!bookmarkedQ.length) return;
    startSession(Math.min(bookmarkedQ.length, 30), false, bookmarkedQ, "bookmarked");
  }, [bookmarkedQ, startSession]);
  const startImageRevision = useCallback(() => {
    if (!imageQuestions.length) return;
    startSession(Math.min(imageQuestions.length, 30), false, imageQuestions, "image-only");
  }, [imageQuestions, startSession]);
  const handleContinueIncompleteSession = useCallback(() => {
    setCompletedSessionId(null);
    setSelected(null);
    setAnswered(false);
    setLoveFeedback("");
    setTab("practice");
  }, []);

  // CSS injection
  const styleRef = useRef(null);
  useEffect(() => {
    if (!styleRef.current) {
      const s = document.createElement("style"); s.textContent = CSS;
      document.head.appendChild(s); styleRef.current = s;
    }
    return () => {
      if (styleRef.current?.parentNode) {
        styleRef.current.parentNode.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, []);

  // ── Calendar JSX (reused in both desktop panel and sidebar) ──────────────
  const CalendarGrid = ({ compact = false }) => (
    <>
      <div className={compact ? "scal-nav" : "cal-nav-row"}>
        <button className={compact ? "scal-btn" : "cbtn"} onClick={() => setCalDate(new Date(calY, calM2-1, 1))}>‹</button>
        <span className={compact ? "scal-m" : "cal-m"}>{MONTHS[calM2]} {calY}</span>
        <button className={compact ? "scal-btn" : "cbtn"} onClick={() => setCalDate(new Date(calY, calM2+1, 1))}>›</button>
      </div>
      <div className={compact ? "scal-dn" : "cal-dn-row"}>
        {WDAYS.map(d => <span key={d} className={compact ? "" : "cal-dn"} style={compact?{fontSize:".5rem",color:"var(--t3)",textAlign:"center",fontWeight:700}:{}}>{d}</span>)}
      </div>
      <div className={compact ? "scal-grid" : "cal-grid"}>
        {Array.from({length: firstDay}, (_, i) => <div key={`e${i}`}/>)}
        {Array.from({length: daysInM}, (_, i) => {
          const day = i + 1;
          const ds  = `${calY}-${String(calM2+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isT = day===todayD.getDate() && calM2===todayD.getMonth() && calY===todayD.getFullYear();
          const h   = hist[ds];
          const pip = pipColor(ds);
          const hasLog = dayLog[ds]?.length > 0;
          if (compact) {
            const cls2 = !h||!h.total ? "" : h.correct/h.total===1?"perf":h.correct/h.total>=0.6?"good":"low";
            return (
              <div key={day} className={`scal-cell ${isT?"tc":""} ${cls2?"hd "+cls2:""}`}
                onClick={() => { if(hasLog){openDayDetail(ds);setSidebarOpen(false);}}}
                title={h?`${h.correct}✓ ${h.wrong}✗`:""}>
                <span>{day}</span>
                {pip && <span className="scal-pip" style={{background:pip}}/>}
              </div>
            );
          }
          return (
            <div key={day} className={`cc ${isT?"today-cell":""} ${calCls(ds)}`}
              onClick={() => hasLog && openDayDetail(ds)}
              title={h?`${h.correct}✓ ${h.wrong}✗ — click to view`:""}
              style={hasLog?{cursor:"pointer"}:{}}>
              <span className="cn">{day}</span>
              {pip && <span className="cpip" style={{background:pip}}/>}
            </div>
          );
        })}
      </div>
    </>
  );

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="bg-pattern"/>
      <div className="bg-dots"/>
      <div className="bg-orb o1"/>
      <div className="bg-orb o2"/>
      <div className="bg-orb o3"/>
      <div className="bg-sheen"/>
      <FloatingHearts/>

      {/* ══ MOBILE SIDEBAR ══ */}
      {sidebarOpen && (
        <>
          <div className="sidebar-overlay" style={{display:"block"}} onClick={() => setSidebarOpen(false)}/>
          <div className="sidebar">
            {/* Header */}
            <div className="sidebar-head">
              <div className="logo">
                <div className="logo-heart">💗</div>
                <span className="logo-text">NORCET Prep</span>
              </div>
              <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
            </div>

            {/* Love note */}
            <div style={{padding:"12px 16px",borderBottom:"1px solid var(--b1)"}}>
              <div style={{fontSize:".78rem",fontStyle:"italic",color:"var(--pink2)",fontFamily:"'Playfair Display',serif",lineHeight:1.5}}>
                "{loveNote}"
              </div>
            </div>

            {/* Streak + nav */}
            <div className="sidebar-nav">
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px 14px",borderBottom:"1px solid var(--b1)",marginBottom:8}}>
                <span style={{fontSize:"1.2rem"}}>🔥</span>
                <div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.3rem",color:"var(--pink)",fontWeight:700}}>{streak}</div>
                  <div style={{fontSize:".6rem",color:"var(--t3)",fontWeight:600}}>Day Streak</div>
                </div>
                <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                  <button className="icon-btn" onClick={() => { patchUnified({ settings: { ...settings, theme: resolvedTheme === "dark" ? "light" : "dark" } }); setSidebarOpen(false); }}>
                    {resolvedTheme === "dark" ? "☀" : "☾"}
                  </button>
                  <button className="icon-btn" onClick={() => { setShowSettings(true); setSidebarOpen(false); }}>⚙</button>
                </div>
              </div>

              {[
                {id:"dashboard",icon:"🏠",label:"Home"},
                {id:"practice", icon:"📝",label:"Practice", badge: sessionActive&&!isDone ? `${sessDone}/${sessTotal}` : null},
                {id:"wrong",    icon:"❌",label:"Mistakes",  badge: wrongIds.size > 0 ? wrongIds.size : null},
                {id:"bookmarks",icon:"🔖",label:"Saved",     badge: bookmarks.size > 0 ? bookmarks.size : null},
              ].map(({id,icon,label,badge}) => (
                <button key={id} className={`snav-item ${tab===id?"on":""}`} onClick={() => { setTab(id); setSidebarOpen(false); }}>
                  <span className="snav-icon">{icon}</span>
                  <span className="snav-label">{label}</span>
                  {badge && <span className="snav-badge">{badge}</span>}
                </button>
              ))}

              <button className="snav-item" style={{marginTop:6}} onClick={() => { setShowSetup(true); setSidebarOpen(false); }}>
                <span className="snav-icon">✨</span>
                <span className="snav-label">New Session</span>
              </button>
            </div>

            {/* Mini stats */}
            <div className="sidebar-stats">
              {[
                {l:"Done",    v:`${att.size}/${totalQ}`, c:"var(--pink)"},
                {l:"Accuracy",v:`${overallAcc}%`,        c:"var(--teal)"},
                {l:"Mistakes",v:wrongIds.size,            c:"var(--wrong)"},
                {l:"Saved",   v:bookmarks.size,           c:"var(--lavender)"},
              ].map(({l,v,c}) => (
                <div className="sstat" key={l}>
                  <div className="sv" style={{color:c}}>{v}</div>
                  <div className="sl">{l}</div>
                </div>
              ))}
            </div>

            {/* Compact calendar */}
            <div className="sidebar-cal">
              <div className="ptitle">📅 Activity</div>
              <CalendarGrid compact={true}/>
              <div style={{display:"flex",gap:10,marginTop:8,flexWrap:"wrap"}}>
                {[["var(--teal)","Perfect"],["var(--gold)","≥60%"],["var(--wrong)","<60%"]].map(([c,l]) => (
                  <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:".56rem",color:"var(--t3)",fontWeight:600}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:c,display:"inline-block"}}/>
                    {l}
                  </div>
                ))}
              </div>
              <div style={{fontSize:".6rem",color:"var(--t3)",marginTop:6,fontStyle:"italic"}}>Tap a day to review</div>
            </div>

            {/* Footer */}
            <div className="sidebar-footer">
              <div className="sfooter-note">You've got this, my love 💕</div>
            </div>
          </div>
        </>
      )}

      {/* ══ SETUP MODAL ══ */}
      {showSetup && (
        <div className="overlay" onClick={e => e.target===e.currentTarget && setShowSetup(false)}>
          <div className="modal">
            <button onClick={() => setShowSetup(false)} style={{position:"absolute",top:16,right:16,width:32,height:32,borderRadius:"50%",border:"1.5px solid var(--b2)",background:"var(--bg2)",color:"var(--t2)",fontSize:"1rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}>✕</button>
            <div className="modal-hd">
              <div className="modal-icon">💖</div>
              <h2>Start a Session</h2>
              {freshCount > 0
                ? <p><strong>{freshCount}</strong> fresh questions ready, my love 🌸</p>
                : canRevise
                  ? <p>No fresh questions — but <strong>{wrongIds.size}</strong> mistakes to revise! 💪</p>
                  : <p>All questions completed! You're amazing 🏆</p>}
            </div>
            {!settings.userName && (
              <><label className="field-label">Your Name</label>
              <input className="text-input" placeholder="e.g. Priya 💕" value={localName} onChange={e => setLocalName(e.target.value)}/></>
            )}
            {freshCount === 0 && (
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {canRevise && <button className="go-btn" onClick={startRevision}>🔁 Revise {wrongIds.size} Mistakes</button>}
                <button className="go-btn" style={{background:"linear-gradient(135deg,var(--lavender),var(--teal))"}} onClick={handleReset}>🔄 Reset All & Start Fresh</button>
              </div>
            )}
            {totalQ > 0 && (
              <>
                <label className="field-label">Mode</label>
                <div className="mode-toggle">
                  <button className={`mmode ${!isMockMode?"on":""}`} onClick={() => setIsMockMode(false)}>
                    <span className="mmode-icon">📚</span><span className="mmode-l">Practice</span>
                    <span className="mmode-sub">Your pace, my love</span>
                  </button>
                  <button className={`mmode ${isMockMode?"mock-on":""}`} onClick={() => setIsMockMode(true)}>
                    <span className="mmode-icon">⏱</span><span className="mmode-l">Mock Exam</span>
                    <span className="mmode-sub">Timed like real NORCET</span>
                  </button>
                </div>
                <label className="field-label">Question Source</label>
                <div className="filter-chip-row">
                  {[
                    ["adaptive", "Adaptive"],
                    ["fresh-only", "Fresh"],
                    ["wrong-only", "Mistakes"],
                    ["bookmarked", "Saved"],
                    ["image-only", "Images"],
                  ].map(([value, label]) => (
                    <button key={value} className={`filter-chip ${setupSource===value?"on":""}`} onClick={() => setSetupSource(value)}>
                      {label}
                    </button>
                  ))}
                </div>
                <label className="field-label">Filters</label>
                <div className="setup-filter-grid">
                  <div>
                    <div className="mini-label">Topic</div>
                    <select className="select-input" value={setupTopic} onChange={(e) => setSetupTopic(e.target.value)}>
                      <option value="all">All topics</option>
                      {topicOptions.map((topic) => (
                        <option key={topic} value={topic}>{topic}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="mini-label">Difficulty</div>
                    <select className="select-input" value={setupDifficulty} onChange={(e) => setSetupDifficulty(e.target.value)}>
                      <option value="all">All levels</option>
                      {["easy", "moderate", "hard"].map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button className={`toggle-row ${setupImageOnly?"on":""}`} onClick={() => setSetupImageOnly((prev) => !prev)}>
                  <span>🖼 Image questions only</span>
                  <span>{setupImageOnly?"On":"Off"}</span>
                </button>
                <label className="field-label">How many questions?</label>
                <div className="preset-grid">
                  {setupPresets.map(n => {
                    const labels = {10:"Quick",25:"Regular",50:"Standard",75:"Extended",100:"Full Exam"};
                    return (
                      <button key={n} className={`pchip ${setupPreset===n?"on":""}`} disabled={n>setupMaxCount}
                        onClick={() => handlePresetClick(n)}>
                        <span className="pchip-n">{n}</span>
                        <span className="pchip-l">{labels[n]||"Custom"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="slider-row">
                  <input type="range" className="range" min="1" max={Math.max(setupMaxCount,1)} value={setupCount}
                    style={{"--p":setupMaxCount>1?`${((setupCount-1)/(setupMaxCount-1))*100}%`:"0%"}}
                    onChange={e => handleSliderChange(Number(e.target.value))}/>
                  <div className="range-val">{setupCount}</div>
                </div>
                <div className="range-note">
                  {isMockMode && `⏱ ${Math.floor(setupCount*MOCK_SPQ/60)} min · `}
                  {setupAvailableCount} match filters · {wrongIds.size} to revise · Max 100
                </div>
                <div className="avail-bar"><strong>{setupAvailableCount}</strong>&nbsp;available · {att.size} done · {bookmarks.size} saved · {imageQuestions.length} image-based</div>
                <button className="go-btn"
                  disabled={!setupFilteredQuestions.length}
                  onClick={() => { if (localName) patchUnified({settings:{...settings,userName:localName}}); startSession(setupCount,isMockMode,setupFilteredQuestions,setupSource); }}>
                  {isMockMode ? `Start ${setupCount}Q Mock Exam ⏱` : `Let's go! ${setupCount} questions 💪`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ SETTINGS MODAL ══ */}
      {showSettings && (
        <div className="overlay" onClick={e => e.target===e.currentTarget && setShowSettings(false)}>
          <div className="modal">
            <button onClick={() => setShowSettings(false)} style={{position:"absolute",top:16,right:16,width:32,height:32,borderRadius:"50%",border:"1.5px solid var(--b2)",background:"var(--bg2)",color:"var(--t2)",fontSize:"1rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10}}>✕</button>
            <div className="modal-hd"><div className="modal-icon">⚙️</div><h2>Settings</h2></div>
            <div className="set-row">
              <label className="set-lbl">Name</label>
              <input className="text-input" placeholder="Enter name" value={localName} onChange={e => setLocalName(e.target.value)}/>
            </div>
            <div className="set-row">
              <label className="set-lbl">Theme</label>
              <div className="theme-row">
                {[
                  { id: "system", label: "System", icon: "◐" },
                  { id: "light", label: "Light", icon: "☀" },
                  { id: "dark", label: "Dark", icon: "☾" },
                ].map((theme) => (
                  <button
                    key={theme.id}
                    className={`theme-chip ${themePreference === theme.id ? "on" : ""}`}
                    onClick={() => patchUnified({ settings: { ...settings, theme: theme.id } })}
                  >
                    <span className="theme-chip-icon">{theme.icon}</span>
                    <span>{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:22}}>
              {[{l:"Done",v:`${att.size}/${totalQ}`,c:"var(--pink)"},{l:"Accuracy",v:`${overallAcc}%`,c:"var(--teal)"},
                {l:"Streak",v:`${streak}d`,c:"var(--gold)"},{l:"Saved",v:bookmarks.size,c:"var(--lavender)"}
              ].map(({l,v,c}) => (
                <div key={l} style={{flex:1,background:"var(--bg2)",border:"1.5px solid var(--b1)",borderRadius:12,padding:"12px 14px",minWidth:80}}>
                  <div style={{fontSize:".62rem",color:"var(--t3)",marginBottom:3,fontWeight:700}}>{l}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.5rem",color:c,fontWeight:700}}>{v}</div>
                </div>
              ))}
            </div>
            <button className="go-btn" style={{marginBottom:10}} onClick={() => { patchUnified({settings:{...settings,userName:localName,theme:themePreference}}); setShowSettings(false); }}>Save 💕</button>
            <div style={{borderTop:"1.5px solid var(--b1)",paddingTop:16,marginTop:4}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"var(--wrong)",marginBottom:10}}>Danger Zone</div>
              <button className="btn-danger" style={{width:"100%"}} onClick={handleReset}>🗑 Reset All Progress</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DAY DETAIL MODAL ══ */}
      {dayDetail && (
        <div className="overlay" onClick={e => e.target===e.currentTarget && setDayDetail(null)}>
          <div className="modal day-modal">
            <div className="day-modal-hd">
              <h3>📅 {new Date(dayDetail.date+"T00:00").toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric"})}</h3>
              <button className="icon-btn" onClick={() => setDayDetail(null)}>✕</button>
            </div>
            {(() => {
              const h = hist[dayDetail.date]||{correct:0,wrong:0,total:0};
              const acc = h.total ? Math.round((h.correct/h.total)*100) : 0;
              return (
                <div className="day-stats">
                  {[{l:"Attempted",v:h.total,c:"var(--pink)"},{l:"Correct",v:h.correct,c:"var(--correct)"},
                    {l:"Wrong",v:h.wrong,c:"var(--wrong)"},{l:"Accuracy",v:`${acc}%`,c:"var(--teal)"}
                  ].map(({l,v,c}) => (
                    <div className="day-stat" key={l}><div className="dv" style={{color:c}}>{v}</div><div className="dl">{l}</div></div>
                  ))}
                </div>
              );
            })()}
            <div className="ptitle">Questions from this day</div>
            <div className="day-q-list">
              {dayDetail.entries.map((entry, i) => {
                const q = qMap[entry.qid]; if (!q) return null;
                return (
                  <div className="day-q-card" key={entry.qid}>
                    <div className="day-q-num">Question {i+1}{q.topic?` · ${q.topic}`:""}</div>
                    <div className="day-q-text">{q.question}</div>
                    {q.image && <div className="rimg" style={{marginBottom:10}}><img src={imgSrc(q.image)} alt="Q" onError={e=>{e.target.style.display="none"}}/></div>}
                    <div className="day-opts">
                      {["A","B","C","D","E"].map(key => {
                        if (!q.options[key]) return null;
                        const isCor    = q.answer && key===q.answer;
                        const isMyWrong= key===entry.myAnswer && key!==q.answer;
                        const isMyRight= key===entry.myAnswer && key===q.answer;
                        return (
                          <div key={key} className={`day-opt ${isCor&&!isMyRight?"is-correct":""} ${isMyRight?"is-mine-right":""} ${isMyWrong?"is-wrong":""}`}>
                            <span className="day-opt-key">{key}</span>
                            <span style={{flex:1}}>{q.options[key]}</span>
                            {isCor&&!isMyRight && <span className="day-opt-badge">✓ Correct</span>}
                            {isMyRight         && <span className="day-opt-badge">✓ Yours</span>}
                            {isMyWrong         && <span className="day-opt-badge">✗ Yours</span>}
                          </div>
                        );
                      })}
                    </div>
                    {!q.answer && <div className="day-no-ans">ℹ️ No answer key</div>}
                    {formatExplanation(q) && <div className="day-expl"><strong>💡 Explanation</strong>{formatExplanation(q)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ DESKTOP NAV ══ */}
      <nav className="nav">
        <div className="logo">
          <div className="logo-heart">💗</div>
          <span className="logo-text">NORCET Prep</span>
        </div>
        <div className="nav-tabs">
          {[["dashboard","Dashboard"],["practice","Practice"],["wrong","Mistakes"],["bookmarks","Bookmarks"]].map(([id,lbl])=>(
            <button key={id} className={`ntab ${tab===id?"on":""}`} onClick={()=>setTab(id)}>{lbl}</button>
          ))}
        </div>
        <div className="nav-end">
          <div className="streak-chip">🔥 {streak} day{streak!==1?"s":""}</div>
          <button className="icon-btn" onClick={() => patchUnified({ settings: { ...settings, theme: resolvedTheme === "dark" ? "light" : "dark" } })}>
            {resolvedTheme === "dark" ? "☀" : "☾"}
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)}>⚙</button>
        </div>
      </nav>

      {/* ══ MOBILE TOP BAR ══ */}
      <div className="mob-topbar">
        <button className="mob-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
        <div className="logo">
          <div className="logo-heart">💗</div>
          <span className="logo-text">NORCET Prep</span>
        </div>
        <div className="mob-streak">🔥 {streak}d</div>
      </div>

      {/* ══ DASHBOARD ══ */}
      {tab==="dashboard" && (
        <div className="page">
          <div className="daily-note desktop-only">
            <div className="daily-note-icon">💌</div>
            <div className="daily-note-text">"{loveNote}"</div>
          </div>
          <div className="greeting desktop-only">
            <div className="greeting-left">
              <h1><span style={{WebkitTextFillColor:"initial"}}>{greetEmoji}</span> {greetWord}{name1?`, ${name1}`:""} <span style={{WebkitTextFillColor:"initial"}}>💗</span></h1>
              <p>Your NORCET prep · {totalQ} questions · {freshCount} remaining</p>
            </div>
            <button className="start-fab" onClick={() => setShowSetup(true)}>+ New Session 💕</button>
          </div>

          {/* Mobile compact header */}
          <div className="mob-only" style={{marginBottom:12}}>
            <div className="mood-card">
              <div className="mood-avatar">💌</div>
              <div className="mood-text">
                <div className="ms">{greetEmoji} {greetWord}{name1?`, ${name1}`:""} <span className="mood-heart">ðŸ’—</span></div>
                <div className="mt">"{loveNote}"</div>
              </div>
            </div>
          </div>

          <div className="stat-grid desktop-only">
            {[
              {icon:"📚",val:att.size,       lbl:"Attempted",   sub:`of ${totalQ} total`,   a:"linear-gradient(90deg,#e8608a,#c84070)"},
              {icon:"✅",val:totalCorrect,    lbl:"Correct",     sub:`${overallAcc}% accuracy`,a:"linear-gradient(90deg,#28a060,#208050)"},
              {icon:"❌",val:wrongIds.size,   lbl:"Need Review", sub:"tap Mistakes tab",      a:"linear-gradient(90deg,#e04060,#c03050)"},
              {icon:"🎯",val:`${overallAcc}%`,lbl:"Accuracy",    sub:"all time",              a:"linear-gradient(90deg,#c090e8,#9060c8)"},
              {icon:"📖",val:freshCount,      lbl:"Remaining",   sub:"unattempted",           a:"linear-gradient(90deg,#30b4a0,#209880)"},
              {icon:"🔥",val:streak,          lbl:"Day Streak",  sub:"keep it up!",           a:"linear-gradient(90deg,#e8a030,#c88020)"},
            ].map(({icon,val,lbl,sub,a}) => (
              <div className="sc" key={lbl} style={{"--a":a}}>
                <div className="sc-icon">{icon}</div>
                <div className="sc-val">{val}</div>
                <div className="sc-lbl">{lbl}</div>
                <div className="sc-sub">{sub}</div>
              </div>
            ))}
          </div>

          {Object.keys(topicStats).length > 0 && (
            <div className="panel desktop-only" style={{marginBottom:20}}>
              <div className="ptitle">📚 Topic Performance</div>
              {Object.entries(topicStats).map(([topic, s]) => {
                const acc = s.total ? Math.round((s.correct/s.total)*100) : 0;
                return (
                  <div className="arow" key={topic}>
                    <div className="aday" style={{minWidth:90,fontSize:".7rem"}}>{topic}</div>
                    <div className="atrack"><div className="afill" style={{width:`${acc}%`,background:acc>=80?"var(--teal)":acc>=50?"var(--gold)":"var(--wrong)"}}/></div>
                    <div className="apct">{acc}%</div>
                  </div>
                );
              })}
            </div>
          )}
          {weakAreas.length > 0 && (
            <div className="panel desktop-only" style={{marginBottom:20}}>
              <div className="ptitle">🎯 Weak Areas</div>
              <div className="weak-grid">
                {weakAreas.map((area) => (
                  <button key={area.topic} className="weak-card" onClick={() => { setShowSetup(true); setSetupTopic(area.topic); setSetupSource("wrong-only"); }}>
                    <div className="weak-top">
                      <div className="weak-topic">{area.topic}</div>
                      <div className={`weak-badge ${area.accuracy >= 70 ? "good" : area.accuracy >= 50 ? "mid" : "low"}`}>{area.accuracy}%</div>
                    </div>
                    <div className="weak-sub">{area.wrong} wrong · {area.correct} correct</div>
                    <div className="weak-track"><div className="weak-fill" style={{width:`${area.accuracy}%`}}/></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="today desktop-only">
            <div className="today-row">
              <div>
                <div className="today-tag">{sessionActive&&!isDone?"⚡ Active Session":doneSession?"✅ Session Complete":"📋 No Session Yet"}</div>
                <div className="today-title">
                  {sessionActive?`${sessDone}/${sessTotal} done${sess?.isMock?" · MOCK ⏱":""}`:
                  doneSession?`Last session — ${doneCorrect}/${doneTotal} correct`:
                  "Ready to study, my love? 💕"}
                </div>
                <div className="today-sub">
                  {sessionActive?`${sessCorrect} correct · ${sessWrong} wrong${sessAcc>0?` · ${sessAcc}%`:""}`:
                  doneSession?`${doneCorrect} correct · ${doneWrong} wrong${doneAccuracy>0?` · ${doneAccuracy}%`:""}`:
                  "Choose 1–100 questions"}
                </div>
              </div>
              <div className="today-btns">
                {sessionActive&&!isDone&&<button className="btn-sec" onClick={()=>setTab("practice")}>Continue →</button>}
                {doneSession&&continueSession&&<button className="btn-sec" onClick={handleContinueIncompleteSession}>Continue Incomplete</button>}
                <button className="btn-primary" onClick={()=>setShowSetup(true)}>
                  {sessionActive&&!isDone?"New Session":doneSession?"Start Fresh Session":"Start Session 💪"}
                </button>
                {!!bookmarkedQ.length&&<button className="btn-sec" onClick={startBookmarkedRevision}>Saved 🔖</button>}
                {!!imageQuestions.length&&<button className="btn-sec" onClick={startImageRevision}>Images 🖼</button>}
              </div>
            </div>
            {sessionActive&&!isDone&&sessTotal>0&&(
              <div className="today-pbar"><div className="today-pfill" style={{width:`${sessPct}%`}}/></div>
            )}
          </div>

          {/* Desktop: 2-col grid with calendar. Mobile: calendar is in sidebar */}
          <div className="dgrid desktop-only">
            <div className="panel">
              <div className="ptitle">📅 Activity Calendar</div>
              <CalendarGrid compact={false}/>
              <div className="cal-leg">
                {[["var(--teal)","Perfect"],["var(--gold)","≥60%"],["var(--wrong)","<60%"]].map(([c,l]) => (
                  <div className="cleg" key={l}><span className="cleg-d" style={{background:c}}/>{l}</div>
                ))}
              </div>
              <div className="cal-hint">💡 Tap any colored day to review questions</div>
            </div>
            <div>
              <div className="panel">
                <div className="ptitle">📊 Last 7 Days</div>
                {last7.map(ds => {
                  const h = hist[ds]||{correct:0,wrong:0,total:0};
                  const acc = h.total?Math.round((h.correct/h.total)*100):0;
                  const wd = new Date(ds+"T00:00").toLocaleDateString("en",{weekday:"short"});
                  return (
                    <div className="arow" key={ds}>
                      <div className="aday">{wd}</div>
                      <div className="atrack"><div className="afill" style={{width:h.total?`${acc}%`:"0%",background:acc>=80?"var(--teal)":acc>=50?"var(--gold)":acc>0?"var(--wrong)":"transparent"}}/></div>
                      <div className="apct">{h.total?`${acc}%`:"–"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="panel" style={{marginTop:16}}>
                <div className="ptitle">🕐 Recent Sessions</div>
                <div className="rlist">
                  {Object.entries(hist).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6).map(([ds,h]) => {
                    const acc = h.total?Math.round((h.correct/h.total)*100):0;
                    const bc  = acc>=80?"rb-g":acc>=50?"rb-o":"rb-r";
                    const bl  = acc>=80?"Great! 💕":acc>=50?"Good 👍":"Keep going 💪";
                    const col = acc>=80?"var(--teal)":acc>=50?"var(--gold)":"var(--wrong)";
                    return (
                      <div className="ri" key={ds}>
                        <div className="ri-dot" style={{background:col}}/>
                        <div className="ri-date">{new Date(ds+"T00:00").toLocaleDateString("en",{month:"short",day:"numeric"})}</div>
                        <div className="ri-score">{h.correct}/{h.total} correct</div>
                        <div className={`ri-badge ${bc}`}>{bl}</div>
                      </div>
                    );
                  })}
                  {!Object.keys(hist).length && (
                    <div style={{color:"var(--t3)",fontSize:".76rem",textAlign:"center",padding:"16px 0",fontWeight:500}}>Start your first session 💕</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── MOBILE DASHBOARD (calendar hidden, clean layout) ── */}
          <div className="mob-only">

            {/* Session resume banner */}
            {sessionActive && !isDone && (
              <div className="sess-banner">
                <span className="sess-banner-icon">⚡</span>
                <div className="sess-banner-text">
                  <div className="st">Session in progress</div>
                  <div className="ss2">{sessDone}/{sessTotal} done · {sessAcc>0?`${sessAcc}% accuracy`:"just started"}</div>
                </div>
                <button className="sess-banner-btn" onClick={()=>setTab("practice")}>Continue →</button>
              </div>
            )}

            {/* Quick action buttons */}
            <div className="quick-actions">
              <button className="qa-btn primary-qa" onClick={()=>setShowSetup(true)}>
                <span className="qa-icon">✨</span>
                <span className="qa-label" style={{color:"#fff"}}>New Session</span>
              </button>
              <button className="qa-btn" onClick={()=>setTab("wrong")} style={{borderColor:wrongIds.size>0?"rgba(224,64,96,.25)":"var(--b1)"}}>
                <span className="qa-icon">❌</span>
                <span className="qa-label" style={{color:wrongIds.size>0?"var(--wrong)":"var(--t2)"}}>
                  {wrongIds.size>0?`${wrongIds.size} Mistakes`:"Mistakes"}
                </span>
              </button>
              <button className="qa-btn" onClick={()=>setTab("bookmarks")}>
                <span className="qa-icon">🔖</span>
                <span className="qa-label">Saved{bookmarks.size>0?` (${bookmarks.size})`:""}</span>
              </button>
              <button className="qa-btn" onClick={()=>setSidebarOpen(true)}>
                <span className="qa-icon">📅</span>
                <span className="qa-label">Calendar</span>
              </button>
            </div>

            {/* Progress cards row */}
            <div className="mob-progress-row">
              <div className="mob-prog-card">
                <div className="mob-prog-big" style={{color:"var(--pink)"}}>{att.size}</div>
                <div className="mob-prog-lbl">of {totalQ} done</div>
                <div className="mob-prog-bar">
                  <div className="mob-prog-fill" style={{width:`${totalQ>0?Math.round((att.size/totalQ)*100):0}%`,background:"linear-gradient(90deg,var(--pink),var(--lavender))"}}/>
                </div>
              </div>
              <div className="mob-prog-card">
                <div className="mob-prog-big" style={{color:"var(--correct)"}}>{overallAcc}%</div>
                <div className="mob-prog-lbl">accuracy</div>
                <div className="mob-prog-bar">
                  <div className="mob-prog-fill" style={{width:`${overallAcc}%`,background:"linear-gradient(90deg,var(--correct),var(--teal))"}}/>
                </div>
              </div>
              <div className="mob-prog-card">
                <div className="mob-prog-big" style={{color:"var(--gold)"}}>{streak}</div>
                <div className="mob-prog-lbl">day streak 🔥</div>
                <div className="mob-prog-bar">
                  <div className="mob-prog-fill" style={{width:`${Math.min(streak*10,100)}%`,background:"linear-gradient(90deg,var(--gold),var(--rose))"}}/>
                </div>
              </div>
            </div>

            {Object.keys(topicStats).length > 0 && (
              <div className="panel mob-only" style={{marginBottom:12}}>
                <div className="ptitle">Topic Performance</div>
                {Object.entries(topicStats)
                  .sort(([, left], [, right]) => (right.total || 0) - (left.total || 0))
                  .slice(0, 5)
                  .map(([topic, s]) => {
                    const acc = s.total ? Math.round((s.correct / s.total) * 100) : 0;
                    return (
                      <div className="arow" key={topic}>
                        <div className="aday" style={{minWidth:88,fontSize:".68rem"}}>{topic}</div>
                        <div className="atrack"><div className="afill" style={{width:`${acc}%`,background:acc>=80?"var(--teal)":acc>=50?"var(--gold)":"var(--wrong)"}}/></div>
                        <div className="apct">{acc}%</div>
                      </div>
                    );
                  })}
              </div>
            )}

            {weakAreas.length > 0 && (
              <div className="panel mob-only" style={{marginBottom:12}}>
                <div className="ptitle">Weak Areas</div>
                <div className="weak-grid">
                  {weakAreas.slice(0, 3).map((area) => (
                    <button key={area.topic} className="weak-card" onClick={() => { setShowSetup(true); setSetupTopic(area.topic); setSetupSource("wrong-only"); }}>
                      <div className="weak-top">
                        <div className="weak-topic">{area.topic}</div>
                        <div className={`weak-badge ${area.accuracy >= 70 ? "good" : area.accuracy >= 50 ? "mid" : "low"}`}>{area.accuracy}%</div>
                      </div>
                      <div className="weak-sub">{area.wrong} wrong · {area.correct} correct</div>
                      <div className="weak-track"><div className="weak-fill" style={{width:`${area.accuracy}%`}}/></div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Last 7 days — compact on mobile */}
            <div className="panel" style={{marginBottom:12}}>
              <div className="ptitle">📊 Last 7 Days</div>
              {last7.map(ds => {
                const h = hist[ds]||{correct:0,wrong:0,total:0};
                const acc = h.total?Math.round((h.correct/h.total)*100):0;
                const wd = new Date(ds+"T00:00").toLocaleDateString("en",{weekday:"short"});
                return (
                  <div className="arow" key={ds}>
                    <div className="aday">{wd}</div>
                    <div className="atrack"><div className="afill" style={{width:h.total?`${acc}%`:"0%",background:acc>=80?"var(--teal)":acc>=50?"var(--gold)":acc>0?"var(--wrong)":"transparent"}}/></div>
                    <div className="apct">{h.total?`${acc}%`:"–"}</div>
                  </div>
                );
              })}
              <div style={{fontSize:".65rem",color:"var(--t3)",marginTop:10,fontStyle:"italic",textAlign:"center"}}>
                💡 Open ☰ menu to view full calendar
              </div>
            </div>

            {/* Recent sessions compact */}
            {Object.keys(hist).length > 0 && (
              <div className="panel">
                <div className="ptitle">🕐 Recent Sessions</div>
                <div className="rlist">
                  {Object.entries(hist).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,4).map(([ds,h]) => {
                    const acc = h.total?Math.round((h.correct/h.total)*100):0;
                    const bc  = acc>=80?"rb-g":acc>=50?"rb-o":"rb-r";
                    const bl  = acc>=80?"Great! 💕":acc>=50?"Good 👍":"Keep going 💪";
                    const col = acc>=80?"var(--teal)":acc>=50?"var(--gold)":"var(--wrong)";
                    return (
                      <div className="ri" key={ds}>
                        <div className="ri-dot" style={{background:col}}/>
                        <div className="ri-date">{new Date(ds+"T00:00").toLocaleDateString("en",{month:"short",day:"numeric"})}</div>
                        <div className="ri-score">{h.correct}/{h.total} correct</div>
                        <div className={`ri-badge ${bc}`}>{bl}</div>
                      </div>
                    );
                  })}
                  {(!!bookmarkedQ.length || !!imageQuestions.length || (freshCount===0&&canRevise)) && (
                    <div className="ready-actions-grid">
                      {!!bookmarkedQ.length&&(
                        <button className="ready-action-card" onClick={startBookmarkedRevision}>
                          <span className="ready-action-icon">ðŸ”–</span>
                          <span className="ready-action-title">Practice Saved Questions</span>
                          <span className="ready-action-sub">{bookmarkedQ.length} question{bookmarkedQ.length!==1?"s":""} you wanted to revisit</span>
                        </button>
                      )}
                      {!!imageQuestions.length&&(
                        <button className="ready-action-card ready-action-teal" onClick={startImageRevision}>
                          <span className="ready-action-icon">ðŸ–¼</span>
                          <span className="ready-action-title">Practice Image-Based Questions</span>
                          <span className="ready-action-sub">{imageQuestions.length} visual question{imageQuestions.length!==1?"s":""} ready for review</span>
                        </button>
                      )}
                      {freshCount===0&&canRevise&&(
                        <button className="ready-action-card ready-action-soft" onClick={startRevision}>
                          <span className="ready-action-icon">ðŸ”</span>
                          <span className="ready-action-title">Strengthen Your Mistakes</span>
                          <span className="ready-action-sub">A focused revision set from the questions that need another look</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ PRACTICE ══ */}
      {tab==="practice" && (
        <div className="page">
          <div className="pshell">
            {!sess && !doneSession && (
              <div className="ready-card">
                <div style={{fontSize:"3.2rem",marginBottom:8}}>💕</div>
                <h2>Ready to Practice?</h2>
                {freshCount>0?<p>I believe in you! Choose your questions 💪</p>
                  :canRevise?<p>No fresh questions, but <strong>{wrongIds.size}</strong> mistakes to master! 💪</p>
                  :<p>You've completed everything! Reset to start again 🌸</p>}
                <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
                  <button className="go-btn" onClick={()=>setShowSetup(true)}>
                    {freshCount>0?"Choose Questions →":canRevise?"Revise Mistakes →":"Open Setup →"}
                  </button>
                  {false && !!bookmarkedQ.length&&(
                    <button className="go-btn" style={{background:"linear-gradient(135deg,var(--lavender),var(--pink))"}} onClick={startBookmarkedRevision}>
                      🔖 Retry Saved Questions — {Math.min(bookmarkedQ.length,30)}
                    </button>
                  )}
                  {false && !!imageQuestions.length&&(
                    <button className="go-btn" style={{background:"linear-gradient(135deg,var(--teal),var(--lavender))"}} onClick={startImageRevision}>
                      🖼 Retry Image Questions — {Math.min(imageQuestions.length,30)}
                    </button>
                  )}
                  {false && freshCount===0&&canRevise&&(
                    <button className="go-btn" style={{background:"linear-gradient(135deg,var(--lavender),var(--teal))"}} onClick={startRevision}>
                      🔁 Quick Revision — {Math.min(wrongIds.size,30)} mistakes
                    </button>
                  )}
                </div>
              </div>
            )}

            {doneSession && (
              <div className="done-wrap">
                <span className="done-emoji">{doneAccuracy===100?"🏆":doneAccuracy>=80?"🌟":"💖"}</span>
                <h2>{doneSession?.isMock?"Mock Exam Done!":"Session Complete!"}</h2>
                <div className="done-score">{doneCorrect}/{doneTotal}</div>
                <div className="done-acc-pill" style={{
                  background:doneAccuracy>=80?"var(--correct-light)":doneAccuracy>=50?"var(--gold-light)":"var(--wrong-light)",
                  color:doneAccuracy>=80?"var(--correct)":doneAccuracy>=50?"var(--gold)":"var(--wrong)",
                  border:`1.5px solid ${doneAccuracy>=80?"rgba(40,160,96,.3)":doneAccuracy>=50?"rgba(232,160,48,.3)":"rgba(224,64,96,.3)"}`
                }}>{doneAccuracy}% Accuracy{doneAccuracy===100?" 🏆":doneAccuracy>=80?" 🌟":""}</div>
                <div className="done-love">{rand(DONE_MSGS)}</div>
                <p className="done-summary-copy">
                  {doneAccuracy >= 85
                    ? "A beautiful session. Your recall looked sharp and confident."
                    : doneAccuracy >= 60
                      ? "A solid session. A quick revisit of the misses will make this even stronger."
                      : "A useful session to learn from. Another calm revision round will help lock this in."}
                </p>
                <div className="done-stat-grid">
                  {[
                    { label: "Correct", value: doneCorrect, color: "var(--correct)" },
                    { label: "Incorrect", value: doneWrong, color: "var(--wrong)" },
                    { label: "Attempted", value: doneCorrect + doneWrong, color: "var(--pink)" },
                    { label: "Left", value: Math.max(doneTotal - (doneCorrect + doneWrong), 0), color: "var(--lavender)" },
                  ].map((item) => (
                    <div key={item.label} className="done-stat-card">
                      <div className="done-stat-value" style={{ color: item.color }}>{item.value}</div>
                      <div className="done-stat-label">{item.label}</div>
                    </div>
                  ))}
                </div>
                <p>{att.size} of {totalQ} total questions done so far.</p>
                <div className={`done-acts ${continueSession ? "has-continue" : "no-continue"} ${wrongIds.size>0 ? "has-mistakes" : "no-mistakes"}`}>
                  {continueSession&&<button className="btn-sec btn-continue" onClick={handleContinueIncompleteSession}>Continue Incomplete Session</button>}
                  <button className={`btn-primary ${continueSession ? "" : "btn-primary-wide"}`} onClick={()=>setShowSetup(true)}>Start New Session</button>
                  <div className="btn-tertiary-row">
                    <button className="btn-sec btn-tertiary" onClick={()=>setTab("dashboard")}>Dashboard</button>
                    {wrongIds.size>0&&<button className="btn-sec btn-tertiary" onClick={()=>setTab("wrong")}>Mistakes</button>}
                  </div>
                </div>
              </div>
            )}

            {!doneSession&&sessionActive&&!isDone&&currentQ&&(
              <>
                {sess?.isMock&&(
                  <div className="timer-bar" style={{maxWidth:680,width:"100%"}}>
                    <span style={{fontSize:".7rem",color:"var(--t2)",fontWeight:700}}>⏱ Mock</span>
                    <div className="timer-track"><div className="timer-fill" style={{width:`${mockTimePct}%`,background:timerColor}}/></div>
                    <div className="timer-label" style={{color:timerColor}}>{mockTimeFmt}</div>
                  </div>
                )}
                <div className="ptopbar">
                  <div className="p-qinfo">Q{sessIdx+1}/{sessTotal}</div>
                  <div className="p-track"><div className="p-fill" style={{width:`${sessPct}%`}}/></div>
                  <div className="p-acc">{sessAcc>0?`${sessAcc}%`:"0%"}</div>
                </div>
                <div className={`qcard ${answered ? "is-answered" : ""}`} key={`${sessIdx}-${currentQ.id}`}>
                  <div className="qcard-top">
                    <div className={`qtag ${sess?.isMock?"mock-qtag":""}`}>{sess?.isMock?"⏱ Mock":"Practice"} · Q{sessIdx+1}/{sessTotal}</div>
                    <div className="qmeta">
                      {currentQ.topic&&<div className="img-chip" style={{color:"var(--lavender)",background:"var(--lav-light)",borderColor:"rgba(192,144,232,.25)"}}>{currentQ.topic}</div>}
                      {currentQ.image&&<div className="img-chip">🖼 Image</div>}
                      <div className="img-chip" style={{color:"var(--gold)",background:"var(--gold-light)",borderColor:"rgba(232,160,48,.22)"}}>
                        {Object.keys(currentQ.options).filter((key) => currentQ.options[key]).length} options
                      </div>
                      {currentQ.difficulty&&<div className="img-chip" style={{color:"var(--pink2)",background:"var(--pink-light)",borderColor:"rgba(232,96,138,.22)"}}>{currentQ.difficulty}</div>}
                      {!currentQ.answer&&<div className="no-ans-chip">No key</div>}
                      <button className="book-btn" onClick={()=>toggleBookmark(currentQ.id)}>
                        {bookmarks.has(currentQ.id)?"🔖":"🏷"}
                      </button>
                    </div>
                  </div>
                  <div className="qeyebrow">{currentQ.image ? "Read the prompt, inspect the visual, then choose the best answer." : "Read carefully and choose the single best answer."}</div>
                  <div className="qtext">{currentQ.question}</div>
                  {currentQ.image&&(
                    <div className="qimg">
                      <img src={imgSrc(currentQ.image)} alt="Question" onError={e=>{e.target.parentElement.style.display="none"}}/>
                      <div className="qimg-cap">Refer to the image above</div>
                    </div>
                  )}
                  <div className="opts">
                    {["A","B","C","D","E"].map(key=>currentQ.options[key]?(
                      <button key={key} className={`opt ${optClass(key)}`} disabled={answered} onClick={()=>handleSelect(key)}>
                        <span className="okey">{key}</span>
                        <span className="otxt">{currentQ.options[key]}</span>
                      </button>
                    ):null)}
                  </div>
                  {answered&&(
                    <div className={`anote ${!currentQ.answer?"na":selected===currentQ.answer?"ok":"err"}`}>
                      {!currentQ.answer?"ℹ️ No answer key."
                        :selected===currentQ.answer?"✅ Correct!"
                        :`❌ Incorrect — Answer: ${currentQ.answer}) ${currentQ.options[currentQ.answer]}`}
                    </div>
                  )}
                  {answered&&loveFeedback&&<div className="love-feedback">{loveFeedback}</div>}
                  {explanationMeta && renderExplanationCard(currentQ, explanationMeta, "practice")}
                  {answered&&(
                    <button className="nbtn" onClick={handleNext}>
                      {sessIdx+1>=sessTotal?"Finish Session 🌸":"Next Question →"}
                    </button>
                  )}
                </div>
                <div className="sstrip">
                  <div className="ss vc"><div className="v">{sessCorrect}</div><div className="l">Correct</div></div>
                  <div className="ss vw"><div className="v">{sessWrong}</div><div className="l">Wrong</div></div>
                  <div className="ss"><div className="v" style={{color:"var(--text)"}}>{sessTotal-sessDone}</div><div className="l">Left</div></div>
                  <div className="ss vt"><div className="v">{sessAcc>0?`${sessAcc}%`:"0%"}</div><div className="l">Accuracy</div></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ MISTAKES ══ */}
      {tab==="wrong" && (
        <div className="page">
          <div className="rev-wrap">
            <div className="rev-hdr">
              <h2>Mistakes to Review</h2>
              <div className="rev-count">{wrongQ.length} questions</div>
            </div>
            <div className="rev-filters">
              {[["all","All"],["img","With Images"],["no-ans","No Key"],["has-ans","Has Key"]].map(([f,l])=>(
                <button key={f} className={`rf ${wrongFilter===f?"on":""}`} onClick={()=>setWrongFilter(f)}>{l}</button>
              ))}
            </div>
            {wrongQ.length===0?(
              <div className="rev-empty"><div className="e-icon">🏆</div><h3>No Mistakes Yet!</h3><p>You're doing amazing! 💕</p></div>
            ):wrongQ.filter(q=>{
              if(wrongFilter==="img")return!!q.image;
              if(wrongFilter==="no-ans")return!q.answer;
              if(wrongFilter==="has-ans")return!!q.answer;
              return true;
            }).map((q,i)=>{
              const myW=wrongMap[q.id];
              return(
                <div className="rc" key={q.id}>
                  <div className="rc-top"><div className="rq">{q.question}</div><div className="rc-num">#{i+1}</div></div>
                  {q.image&&<div className="rimg"><img src={imgSrc(q.image)} alt="Q" onError={e=>{e.target.parentElement.style.display="none"}}/></div>}
                  <div className="ropts">
                    {["A","B","C","D","E"].map(key=>{
                      if(!q.options[key])return null;
                      const isCor=q.answer&&key===q.answer;
                      const isWrg=key===myW&&key!==q.answer;
                      return(
                        <div key={key} className={`ro ${isCor?"cor":""} ${isWrg?"wrg":""}`}>
                          <span className="ro-key">{key}</span>
                          <span style={{flex:1,lineHeight:1.5}}>{q.options[key]}</span>
                          {isCor&&<span className="ro-badge">✓ Correct</span>}
                          {isWrg&&<span className="ro-badge">✗ Yours</span>}
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const mistakeExplanationMeta = getExplanationMeta(q);
                    return mistakeExplanationMeta ? renderExplanationCard(q, mistakeExplanationMeta, "mistake") : null;
                  })()}
                  {!q.answer&&<div className="r-no-ans">ℹ️ No answer key</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ BOOKMARKS ══ */}
      {tab==="bookmarks" && (
        <div className="page">
          <div className="book-wrap">
            <div className="book-hdr">
              <h2>Saved Questions</h2>
              <div className="book-count">{bookmarkedQ.length} bookmarked 🔖</div>
            </div>
            <p style={{fontSize:".8rem",color:"var(--t2)",marginBottom:18,fontWeight:500}}>
              💡 Answers are hidden here — use this for self-testing.
            </p>
            {bookmarkedQ.length===0?(
              <div className="rev-empty"><div className="e-icon">🔖</div><h3>No Bookmarks Yet</h3><p>Tap 🏷 on any question to save it here.</p></div>
            ):bookmarkedQ.map((q,i)=>(
              <div className="bcard" key={q.id}>
                <div className="bcard-top">
                  <div className="bq">{i+1}. {q.question}</div>
                  <button className="unbook-btn" onClick={()=>toggleBookmark(q.id)}>Remove</button>
                </div>
                {q.image&&<div className="rimg" style={{marginBottom:10}}><img src={imgSrc(q.image)} alt="Q" onError={e=>{e.target.parentElement.style.display="none"}}/></div>}
                <div className="bopts">
                  {["A","B","C","D","E"].map(key=>q.options[key]?(
                    <div key={key} className="bopt">
                      <span className="bopt-key">{key}</span>
                      <span style={{flex:1,lineHeight:1.5}}>{q.options[key]}</span>
                    </div>
                  ):null)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ MOBILE BOTTOM NAV ══ */}
      <div className="bottom-nav">
        {[
          {id:"dashboard",icon:"🏠",lbl:"Home"},
          {id:"practice", icon:"📝",lbl:"Practice", badge: sessionActive&&!isDone?`${sessDone}/${sessTotal}`:null},
          {id:"wrong",    icon:"❌",lbl:"Mistakes",  badge: wrongIds.size||null},
          {id:"bookmarks",icon:"🔖",lbl:"Saved",     badge: null},
        ].map(({id,icon,lbl,badge})=>(
          <button key={id} className={`bn-btn ${tab===id?"on":""}`} onClick={()=>setTab(id)}>
            <span className="bn-icon">{icon}</span>
            {badge && <span className="bn-badge">{badge}</span>}
            <span>{lbl}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
