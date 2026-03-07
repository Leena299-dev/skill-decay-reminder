import React, { useState, useEffect, useRef } from 'react';
import { generateExercise, submitPracticeSession, evaluateAnswer, getProgressAnalysis } from '../services/api';
import './PracticePage.css';

// Returns true only when the ENTIRE content is primarily code, not just when
// it contains a code snippet inline. Two conditions either of which qualifies:
//   1. First non-empty line starts with a code keyword (def, class, import, etc.)
//   2. Three or more lines begin with recognised code syntax
const isCodeContent = (content) => {
  if (!content) return false;

  const lines = content.split('\n');
  const firstNonEmpty = lines.find(l => l.trim().length > 0) || '';

  // Condition 1 — first line is a code statement
  const startsWithCode = /^\s*(def |class |import |from |const |let |var |function )/.test(firstNonEmpty);
  if (startsWithCode) return true;

  // Condition 2 — majority of non-empty lines look like code (≥3 lines)
  const linePatterns = [
    /^\s*(def |class |import |from |const |let |var |function )/,
    /^\s*(if |for |while |return |print\(|console\.)/,
    /^\s{4,}\S/,   // 4-space indent
    /^\s*[}\])]/, // closing brace/bracket
  ];
  const codeLineCount = lines.filter(l => linePatterns.some(p => p.test(l))).length;
  return codeLineCount >= 3;
};

const DIFFICULTY_COLORS = {
  beginner_easy:       { bg: '#e8f5e9', color: '#2e7d32', border: '#81c784' },
  beginner_medium:     { bg: '#e8f5e9', color: '#2e7d32', border: '#81c784' },
  beginner_hard:       { bg: '#e8f5e9', color: '#2e7d32', border: '#81c784' },
  intermediate_easy:   { bg: '#fff8e1', color: '#e65100', border: '#ffb74d' },
  intermediate_medium: { bg: '#fff8e1', color: '#e65100', border: '#ffb74d' },
  intermediate_hard:   { bg: '#fff8e1', color: '#e65100', border: '#ffb74d' },
  advanced_easy:       { bg: '#f3e5f5', color: '#6a1b9a', border: '#ba68c8' },
  advanced_medium:     { bg: '#f3e5f5', color: '#6a1b9a', border: '#ba68c8' },
  advanced_hard:       { bg: '#f3e5f5', color: '#6a1b9a', border: '#ba68c8' },
};

function difficultyLabel(d) {
  if (!d) return '';
  return d.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function DifficultyBadge({ difficulty }) {
  if (!difficulty) return null;
  const style = DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS['intermediate_medium'];
  return (
    <span
      className="difficulty-badge"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {difficultyLabel(difficulty)}
    </span>
  );
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getTimerColor(elapsed, estimatedMinutes) {
  const estimatedSeconds = (estimatedMinutes || 15) * 60;
  const ratio = elapsed / estimatedSeconds;
  if (ratio >= 1.0) return '#f44336';
  if (ratio >= 0.8) return '#ff9800';
  return '#4caf50';
}

function getScoreColor(s) {
  if (s >= 80) return '#4caf50';
  if (s >= 60) return '#ff9800';
  if (s >= 40) return '#ff7043';
  return '#f44336';
}

function getScoreLabel(s) {
  if (s >= 90) return '🌟 Excellent!';
  if (s >= 80) return '✅ Great job!';
  if (s >= 60) return '📈 Good effort';
  if (s >= 40) return '💪 Keep practising';
  return '🔄 Review needed';
}

// 8-message completion card configs
const MESSAGE_CONFIGS = {
  fast_levelup:    { variant: 'up',      icon: '⚡', title: 'Speed + Accuracy!' },
  levelup:         { variant: 'up',      icon: '↑',  title: 'Level Up!' },
  nearly_there:    { variant: 'nearly',  icon: '⭐', title: 'Almost There!' },
  fast_leveldown:  { variant: 'down',    icon: '↓',  title: 'Difficulty Adjusted' },
  leveldown:       { variant: 'down',    icon: '↓',  title: 'Difficulty Adjusted' },
  hints_added:     { variant: 'same',    icon: '💡', title: 'Hints Enabled' },
  rushing_warning: { variant: 'rushing', icon: '⏱️', title: 'Slow Down!' },
  keep_going:      { variant: 'same',    icon: '📈', title: 'Steady Progress' },
};

// ── AI score bar ──────────────────────────────────────────────────────────────
function AIScoreBar({ score }) {
  const color = getScoreColor(score);
  return (
    <div className="ai-score-display">
      <div className="ai-score-top">
        <span className="ai-score-number" style={{ color }}>
          {score}<span className="ai-score-denom">/100</span>
        </span>
        <span className="ai-score-label" style={{ color }}>{getScoreLabel(score)}</span>
      </div>
      <div className="ai-score-bar-track">
        <div className="ai-score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const PracticePage = ({ userId, skillId, skillName, category, proficiency, adaptiveDifficulty, onComplete }) => {
  const [loading, setLoading]         = useState(true);
  const [exercise, setExercise]       = useState(null);
  const [error, setError]             = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [practiceResult, setPracticeResult] = useState(null);
  const [score, setScore]             = useState(0); // used by self-mark slider

  // AI feedback state
  // answerView: 'input' | 'loading' | 'ai_feedback' | 'self_mark'
  const [userAnswer, setUserAnswer]     = useState('');
  const [answerView, setAnswerView]     = useState('input');
  const [aiFeedback, setAiFeedback]     = useState(null);

  // Attempt tracking (for multi-attempt AI feedback sessions)
  const [attemptNumber, setAttemptNumber]         = useState(1);
  const [attemptScores, setAttemptScores]         = useState([]);
  const [firstAttemptScore, setFirstAttemptScore] = useState(null);

  // Timer display: null = running, number = frozen snapshot (grey)
  const [frozenSeconds, setFrozenSeconds] = useState(null);

  // Session insight (fetched in parallel with practice-session submit)
  const [sessionInsight, setSessionInsight]           = useState(null);
  const [sessionInsightLoading, setSessionInsightLoading] = useState(false);

  // Self-mark extras
  const [showHints, setShowHints]     = useState(false);
  const [showAnswer, setShowAnswer]   = useState(false);

  // Auto-timer
  const startTimeRef = useRef(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchExercise = async () => {
      try {
        setLoading(true);
        setError('');
        const result = await generateExercise(userId, skillId, skillName, category, proficiency, adaptiveDifficulty);
        setExercise(result);
        if (result.showMoreHints) setShowHints(true);
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
      } catch (err) {
        setError(err.message || 'Failed to generate exercise. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchExercise();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [userId, skillId, skillName, category, proficiency, adaptiveDifficulty]);

  // ── Shared submit function ─────────────────────────────────────────────────
  const submitSession = async (sessionScore, aiData = null) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const actualSecs = aiData?.finalAttemptTimeSeconds !== undefined
      ? aiData.finalAttemptTimeSeconds
      : startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : elapsedSeconds;
    const estMins  = exercise?.estimatedTime || 15;
    const timeSpent = Math.max(1, Math.round(actualSecs / 60));

    setSubmitting(true);
    setError('');
    try {
      const result = await submitPracticeSession(
        userId, skillId, exercise.exerciseId,
        sessionScore, timeSpent, actualSecs, estMins,
        aiData,
      );
      setScore(sessionScore);
      setPracticeResult(result);

      // Fetch session insight in background — doesn't block difficulty card
      setSessionInsightLoading(true);
      getProgressAnalysis({
        userId,
        requestType:        'session_insight',
        skillName,
        category,
        currentScore:       sessionScore,
        previousScores:     [],
        adaptiveDifficulty: result.newDifficulty || adaptiveDifficulty || '',
        difficultyChanged:  result.difficultyChanged  || false,
        difficultyDirection: result.difficultyDirection || '',
        totalAttempts:      aiData?.totalAttempts      || 1,
        firstAttemptScore:  aiData?.firstAttemptScore  ?? null,
        usedAIFeedback:     aiData?.usedAIFeedback     || false,
        aiWhatWasMissing:   aiData?.aiWhatWasMissing   || '',
        timePerformance:    result.timePerformance      || '',
      })
        .then(insight => { if (insight && !insight.error) setSessionInsight(insight); })
        .catch(() => { /* silent — insight is optional */ })
        .finally(() => setSessionInsightLoading(false));

    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Freeze the visible badge timer (background tracking continues unaffected)
  const freezeTimerDisplay = () => setFrozenSeconds(elapsedSeconds);

  // ── AI feedback handlers ───────────────────────────────────────────────────
  const handleGetAIFeedback = async () => {
    if (!userAnswer.trim()) return;
    freezeTimerDisplay();
    setAnswerView('loading');
    setError('');
    const feedback = await evaluateAnswer({
      userId,
      skillId,
      skillName,
      category,
      exerciseTitle:       exercise.title,
      exerciseDescription: exercise.description,
      exerciseProblem:     exercise.content,
      modelAnswer:         exercise.solution || exercise.answer || '',
      userAnswer,
      adaptiveDifficulty:  adaptiveDifficulty || exercise.adaptiveDifficulty || '',
    });
    setAiFeedback(feedback);
    setAnswerView('ai_feedback');
  };

  const handleAISubmit = () => {
    if (!aiFeedback || aiFeedback.error || aiFeedback.score === null) return;
    // Capture final attempt time before stopping timer
    const finalAttemptSecs = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : elapsedSeconds;
    const allScores = [...attemptScores, aiFeedback.score];
    const bestScore = Math.max(...allScores);
    submitSession(bestScore, {
      usedAIFeedback:          true,
      aiFeedbackScore:         aiFeedback.score,
      aiWhatWasCorrect:        aiFeedback.whatWasCorrect,
      aiWhatWasMissing:        aiFeedback.whatWasMissing,
      aiImprovementTip:        aiFeedback.improvementTip,
      finalAttemptTimeSeconds: finalAttemptSecs,
      totalAttempts:           attemptNumber,
      firstAttemptScore:       firstAttemptScore ?? aiFeedback.score,
      finalScore:              bestScore,
      attemptScores:           allScores,
    });
  };

  // "Try Again" — record this attempt's score, reset timer, clear answer
  const handleTryAgain = () => {
    if (aiFeedback && !aiFeedback.error && aiFeedback.score !== null) {
      const currentScore = aiFeedback.score;
      setAttemptScores(prev => [...prev, currentScore]);
      if (firstAttemptScore === null) setFirstAttemptScore(currentScore);
      setAttemptNumber(prev => prev + 1);
    }
    // Reset timer independently for this new attempt
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setFrozenSeconds(null);
    setUserAnswer('');
    setAiFeedback(null);
    setAnswerView('input');
    setError('');
  };

  // "Back to My Answer" — return to input, keep answer text, clear feedback
  const handleBackToInput = () => {
    setFrozenSeconds(null);
    setAiFeedback(null);
    setAnswerView('input');
    setShowAnswer(false);
    setError('');
  };

  const handleSelfMarkSubmit = (e) => {
    e.preventDefault();
    if (score < 0 || score > 100) { setError('Score must be between 0 and 100'); return; }
    submitSession(score, null);
  };

  // ── Loading / error / completion states ───────────────────────────────────
  if (loading) {
    return (
      <div className="practice-page">
        <div className="loading-spinner">
          <div className="spinner" />
          <p>Generating your personalised exercise...</p>
        </div>
      </div>
    );
  }

  if (error && !exercise) {
    return (
      <div className="practice-page">
        <div className="error-banner"><strong>Error:</strong> {error}</div>
      </div>
    );
  }

  if (practiceResult) {
    const msgKey = practiceResult.difficultyMessage || 'keep_going';
    const cfg    = MESSAGE_CONFIGS[msgKey] || MESSAGE_CONFIGS.keep_going;
    const newDiff    = practiceResult.newDifficulty;
    const reason     = practiceResult.difficultyChangeReason;
    const sessionsLeft = practiceResult.sessionsToLevelup;

    return (
      <div className="practice-page">
        <div className="exercise-card completion-card">
          <div className="completion-score-ring" style={{ '--score-color': getScoreColor(score) }}>
            <div className="completion-score-number" style={{ color: getScoreColor(score) }}>{score}</div>
            <div className="completion-score-label">{getScoreLabel(score)}</div>
          </div>

          <div className={`diff-message-card diff-message-card--${cfg.variant}`}>
            <div className="diff-message-header">
              <span className="diff-message-icon">{cfg.icon}</span>
              <span className="diff-message-title">{cfg.title}</span>
            </div>
            <p className="diff-message-body">{reason}</p>

            {msgKey === 'nearly_there' && sessionsLeft !== null && (
              <div className="nearly-there-progress">
                <div className="nearly-there-track">
                  <div className="nearly-there-fill" style={{ width: `${Math.round(((3 - sessionsLeft) / 3) * 100)}%` }} />
                </div>
                <span className="nearly-there-label">{3 - sessionsLeft}/3 sessions at 90%+</span>
              </div>
            )}

            {newDiff && (
              <div className="diff-new-level">
                <span className="diff-new-label">Current difficulty:</span>
                <DifficultyBadge difficulty={newDiff} />
              </div>
            )}
          </div>

          <p className="completion-progress">{practiceResult.progressMessage}</p>

          {/* Session insight — fades in when ready */}
          {sessionInsightLoading && (
            <div className="session-insight-loading">
              <span className="session-insight-dots">
                <span /><span /><span />
              </span>
              <span>Generating session insight...</span>
            </div>
          )}

          {sessionInsight && !sessionInsightLoading && (
            <div className={`session-insight-card trend-${sessionInsight.trend}`}>
              <div className="si-card-title">📊 Session Insight</div>
              <p className="si-insight-text">{sessionInsight.sessionInsight}</p>
              {sessionInsight.nextSessionTip && (
                <p className="si-next-tip">💡 Next time: {sessionInsight.nextSessionTip}</p>
              )}
              <div className={`si-trend-indicator trend-${sessionInsight.trend}`}>
                {sessionInsight.trend === 'improving'       && '📈 Improving'}
                {sessionInsight.trend === 'consistent'      && '➡️ Consistent'}
                {sessionInsight.trend === 'needs_attention' && '📉 Needs Attention'}
              </div>
            </div>
          )}

          <button className="submit-button" onClick={() => onComplete(practiceResult)}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Exercise view ──────────────────────────────────────────────────────────
  const currentDifficulty = adaptiveDifficulty || exercise?.adaptiveDifficulty;
  const estimatedMinutes  = exercise?.estimatedTime || 15;
  const categoryUpper     = (category || '').toUpperCase();
  const alwaysWhiteCategory = categoryUpper === 'LANGUAGE' || categoryUpper === 'CERTIFICATION';
  const contentIsCode     = !alwaysWhiteCategory && isCodeContent(exercise.content);

  return (
    <div className="practice-page">
      <div className="exercise-card">
        <h2 className="exercise-title">{exercise.title}</h2>

        <div className="exercise-meta">
          <span className="skill-badge">{skillName}</span>
          <DifficultyBadge difficulty={currentDifficulty} />
          {attemptNumber > 1 && <span className="attempt-badge">Attempt {attemptNumber}</span>}
          <span className="time-estimate">⏱️ {estimatedMinutes} minutes</span>
          <span
            className="exercise-timer"
            style={{ color: frozenSeconds !== null ? '#9e9e9e' : getTimerColor(elapsedSeconds, estimatedMinutes) }}
          >
            {formatTimer(frozenSeconds !== null ? frozenSeconds : elapsedSeconds)}
          </span>
        </div>

        {/* Description — always white */}
        <div className="description-box">
          <h3>Description</h3>
          <p>{exercise.description}</p>
        </div>

        {/* Problem */}
        <div className="content-box">
          <h3>Problem</h3>
          {(exercise.codeSnippet || exercise.code) ? (
            <pre className="code-block"><code>{exercise.codeSnippet || exercise.code}</code></pre>
          ) : contentIsCode ? (
            <pre className="code-block"><code>{exercise.content}</code></pre>
          ) : (
            <div className="text-content">{exercise.content}</div>
          )}
        </div>

        {/* Hints */}
        <div className="hints-section">
          <button
            className={`hints-toggle${showHints ? ' hints-toggle--active' : ''}`}
            onClick={() => setShowHints(!showHints)}
            type="button"
          >
            {showHints ? '▼' : '▶'} Hints
            {exercise?.showMoreHints && <span className="hints-badge">Recommended</span>}
          </button>
          {showHints && (
            <div className="hints-content">
              {exercise.hints?.length > 0 ? (
                <ul>{exercise.hints.map((hint, i) => <li key={i}>{hint}</li>)}</ul>
              ) : (
                <p>No hints available for this exercise.</p>
              )}
            </div>
          )}
        </div>

        {/* ── Answer input area (input + loading + ai_feedback views) ── */}
        {answerView !== 'self_mark' && (
          <div className="answer-input-section">
            <div className="answer-input-header">
              <label className="answer-input-label" htmlFor="userAnswer">Your Answer</label>
              {userAnswer && answerView === 'input' && (
                <button
                  type="button"
                  className="answer-clear-btn"
                  onClick={() => setUserAnswer('')}
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              id="userAnswer"
              className="answer-textarea"
              placeholder="Type your answer here..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={answerView === 'loading' || answerView === 'ai_feedback'}
              rows={5}
            />

            {/* Action buttons */}
            {answerView === 'input' && (
              <div className="answer-actions">
                <button
                  type="button"
                  className="btn-ai-feedback"
                  onClick={handleGetAIFeedback}
                  disabled={!userAnswer.trim()}
                >
                  🤖 Get AI Feedback
                </button>
                <button
                  type="button"
                  className="btn-self-mark"
                  onClick={() => { freezeTimerDisplay(); setAnswerView('self_mark'); }}
                >
                  👁️ Self Mark
                </button>
              </div>
            )}

            {/* Loading */}
            {answerView === 'loading' && (
              <div className="ai-loading">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
                <p className="ai-loading-text">AI is reviewing your answer...</p>
              </div>
            )}

            {/* AI Feedback card */}
            {answerView === 'ai_feedback' && aiFeedback && (
              <div className="ai-feedback-card">
                {aiFeedback.error ? (
                  <div className="ai-feedback-error">
                    <p>{aiFeedback.detailedFeedback}</p>
                    <div className="ai-feedback-error-actions">
                      <button
                        type="button"
                        className="btn-self-mark"
                        onClick={() => { freezeTimerDisplay(); setAnswerView('self_mark'); }}
                      >
                        👁️ Use Self Marking Instead
                      </button>
                      <button
                        type="button"
                        className="nav-back-btn"
                        onClick={handleBackToInput}
                      >
                        ← Back to My Answer
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="ai-feedback-header">
                      <span className="ai-feedback-title">🤖 AI Feedback</span>
                    </div>

                    <AIScoreBar score={aiFeedback.score} />

                    <div className="ai-feedback-section ai-feedback-correct">
                      <div className="ai-feedback-section-title">✅ What you got right</div>
                      <p>{aiFeedback.whatWasCorrect}</p>
                    </div>

                    <div className="ai-feedback-section ai-feedback-missing">
                      <div className="ai-feedback-section-title">📝 What was missing</div>
                      <p>{aiFeedback.whatWasMissing}</p>
                    </div>

                    <div className="ai-feedback-section ai-feedback-tip">
                      <div className="ai-feedback-section-title">💡 Improvement tip</div>
                      <p>{aiFeedback.improvementTip}</p>
                    </div>

                    {aiFeedback.encouragingMessage && (
                      <p className="ai-encouraging-message">
                        💬 &ldquo;{aiFeedback.encouragingMessage}&rdquo;
                      </p>
                    )}

                    {error && <div className="error-banner"><strong>Error:</strong> {error}</div>}

                    <div className="ai-feedback-actions">
                      {attemptScores.length > 0 && aiFeedback.score !== null && (() => {
                        const allScores = [...attemptScores, aiFeedback.score];
                        const best = Math.max(...allScores);
                        const improved = best > attemptScores[0];
                        return (
                          <div className="best-score-notice">
                            {improved
                              ? `Submitting your best score: ${best}% (improved from ${attemptScores[0]}% 🎉)`
                              : `Submitting your best score: ${best}%`}
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        className="submit-button"
                        onClick={handleAISubmit}
                        disabled={submitting}
                      >
                        {submitting ? 'Submitting…' : 'Submit This Score'}
                      </button>
                      <button
                        type="button"
                        className="try-again-btn"
                        onClick={handleTryAgain}
                        disabled={submitting}
                      >
                        Try Again
                      </button>
                      <button
                        type="button"
                        className="nav-back-btn"
                        onClick={() => { freezeTimerDisplay(); setAnswerView('self_mark'); }}
                        disabled={submitting}
                      >
                        ← Try Self Mark Instead
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Self-mark flow ── */}
        {answerView === 'self_mark' && (
          <>
            {/* Back navigation */}
            <button
              type="button"
              className="nav-back-btn nav-back-btn--top"
              onClick={handleBackToInput}
            >
              ← Back to My Answer
            </button>

            <div className="answer-section">
              <button
                className="answer-toggle"
                onClick={() => setShowAnswer(!showAnswer)}
                type="button"
              >
                {showAnswer ? '🙈 Hide Answer' : '👁️ Show Answer'}
              </button>

              {showAnswer && (
                <div className="answer-content">
                  <div className="answer-header">
                    <span className="answer-label">✅ Model Answer</span>
                    <span className="answer-note">Use this to mark your work before scoring below</span>
                  </div>

                  {exercise.solution || exercise.answer ? (
                    !alwaysWhiteCategory && isCodeContent(exercise.solution || exercise.answer) ? (
                      <pre className="code-block answer-code">
                        <code>{exercise.solution || exercise.answer}</code>
                      </pre>
                    ) : (
                      <div className="answer-text">{exercise.solution || exercise.answer}</div>
                    )
                  ) : (
                    <div className="answer-text answer-missing">
                      No model answer was provided for this exercise.
                      Use the hints and your own knowledge to evaluate your work.
                    </div>
                  )}

                  <div className="self-mark-guide">
                    <h4>📋 Self-Marking Guide</h4>
                    <div className="mark-bands">
                      <div className="band band-excellent">
                        <span className="band-range">90–100</span>
                        <span className="band-desc">Fully correct, great structure and detail</span>
                      </div>
                      <div className="band band-good">
                        <span className="band-range">70–89</span>
                        <span className="band-desc">Mostly correct with minor errors</span>
                      </div>
                      <div className="band band-ok">
                        <span className="band-range">50–69</span>
                        <span className="band-desc">Partially correct, key concepts understood</span>
                      </div>
                      <div className="band band-low">
                        <span className="band-range">0–49</span>
                        <span className="band-desc">Significant gaps — review the material</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && <div className="error-banner"><strong>Error:</strong> {error}</div>}

            <form className="score-form" onSubmit={handleSelfMarkSubmit}>
              <h3>Submit Your Results</h3>

              {/* Show AI reference score if the user came from AI feedback view */}
              {aiFeedback && !aiFeedback.error && aiFeedback.score !== null && (
                <div className="ai-score-reference">
                  🤖 AI suggested score: <strong style={{ color: getScoreColor(aiFeedback.score) }}>{aiFeedback.score}</strong>
                  <span className="ai-score-reference-note"> — you can override below</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="score">
                  Score: <strong style={{ color: getScoreColor(score) }}>{score}</strong>
                  <span className="score-label-inline"> — {getScoreLabel(score)}</span>
                </label>
                <input
                  type="range"
                  id="score"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  disabled={submitting}
                  style={{ '--score-color': getScoreColor(score) }}
                />
                <div className="range-labels">
                  <span>0</span><span>50</span><span>100</span>
                </div>
              </div>

              <button type="submit" className="submit-button" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Score'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default PracticePage;
