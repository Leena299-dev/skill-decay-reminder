import React, { useState, useEffect, useRef } from 'react';
import { generateExercise, submitPracticeSession } from '../services/api';
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
  beginner_easy:   { bg: '#e8f5e9', color: '#2e7d32', border: '#81c784' },
  beginner_medium: { bg: '#e8f5e9', color: '#2e7d32', border: '#81c784' },
  beginner_hard:   { bg: '#e8f5e9', color: '#2e7d32', border: '#81c784' },
  intermediate_easy:   { bg: '#fff8e1', color: '#e65100', border: '#ffb74d' },
  intermediate_medium: { bg: '#fff8e1', color: '#e65100', border: '#ffb74d' },
  intermediate_hard:   { bg: '#fff8e1', color: '#e65100', border: '#ffb74d' },
  advanced_easy:   { bg: '#f3e5f5', color: '#6a1b9a', border: '#ba68c8' },
  advanced_medium: { bg: '#f3e5f5', color: '#6a1b9a', border: '#ba68c8' },
  advanced_hard:   { bg: '#f3e5f5', color: '#6a1b9a', border: '#ba68c8' },
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
  if (ratio >= 1.0) return '#f44336'; // over time — red
  if (ratio >= 0.8) return '#ff9800'; // approaching — amber
  return '#4caf50'; // under time — green
}

// 8-message completion card configs
const MESSAGE_CONFIGS = {
  fast_levelup: {
    variant: 'up',
    icon: '⚡',
    title: 'Speed + Accuracy!',
  },
  levelup: {
    variant: 'up',
    icon: '↑',
    title: 'Level Up!',
  },
  nearly_there: {
    variant: 'nearly',
    icon: '⭐',
    title: 'Almost There!',
  },
  fast_leveldown: {
    variant: 'down',
    icon: '↓',
    title: 'Difficulty Adjusted',
  },
  leveldown: {
    variant: 'down',
    icon: '↓',
    title: 'Difficulty Adjusted',
  },
  hints_added: {
    variant: 'same',
    icon: '💡',
    title: 'Hints Enabled',
  },
  rushing_warning: {
    variant: 'rushing',
    icon: '⏱️',
    title: 'Slow Down!',
  },
  keep_going: {
    variant: 'same',
    icon: '📈',
    title: 'Steady Progress',
  },
};

const PracticePage = ({ userId, skillId, skillName, category, proficiency, adaptiveDifficulty, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState(null);
  const [error, setError] = useState('');
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [practiceResult, setPracticeResult] = useState(null);

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
        // Start timer when exercise loads
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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId, skillId, skillName, category, proficiency, adaptiveDifficulty]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (score < 0 || score > 100) {
      setError('Score must be between 0 and 100');
      return;
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const actualTimeSeconds = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : elapsedSeconds;
    const estimatedMinutes = exercise?.estimatedTime || 15;
    const timeSpent = Math.max(1, Math.round(actualTimeSeconds / 60));

    try {
      setSubmitting(true);
      setError('');
      const result = await submitPracticeSession(
        userId,
        skillId,
        exercise.exerciseId,
        score,
        timeSpent,
        actualTimeSeconds,
        estimatedMinutes,
      );
      setPracticeResult(result);
    } catch (err) {
      setError(err.message || 'Failed to submit practice session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (s) => {
    if (s >= 80) return '#4caf50';
    if (s >= 60) return '#ff9800';
    return '#f44336';
  };

  const getScoreLabel = (s) => {
    if (s >= 90) return '🌟 Excellent!';
    if (s >= 80) return '✅ Great job!';
    if (s >= 60) return '📈 Good effort';
    if (s >= 40) return '💪 Keep practising';
    return '🔄 Review needed';
  };

  if (loading) {
    return (
      <div className="practice-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Generating your personalised exercise...</p>
        </div>
      </div>
    );
  }

  if (error && !exercise) {
    return (
      <div className="practice-page">
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  // ── Post-submission completion card ──────────────────────────────────────
  if (practiceResult) {
    const msgKey = practiceResult.difficultyMessage || 'keep_going';
    const cfg = MESSAGE_CONFIGS[msgKey] || MESSAGE_CONFIGS.keep_going;
    const newDiff = practiceResult.newDifficulty;
    const reason = practiceResult.difficultyChangeReason;
    const sessionsLeft = practiceResult.sessionsToLevelup;

    return (
      <div className="practice-page">
        <div className="exercise-card completion-card">
          {/* Score summary */}
          <div className="completion-score-ring" style={{ '--score-color': getScoreColor(score) }}>
            <div className="completion-score-number" style={{ color: getScoreColor(score) }}>
              {score}
            </div>
            <div className="completion-score-label">{getScoreLabel(score)}</div>
          </div>

          {/* Difficulty message card */}
          <div className={`diff-message-card diff-message-card--${cfg.variant}`}>
            <div className="diff-message-header">
              <span className="diff-message-icon">{cfg.icon}</span>
              <span className="diff-message-title">{cfg.title}</span>
            </div>
            <p className="diff-message-body">{reason}</p>

            {/* Nearly-there progress bar */}
            {msgKey === 'nearly_there' && sessionsLeft !== null && (
              <div className="nearly-there-progress">
                <div className="nearly-there-track">
                  <div
                    className="nearly-there-fill"
                    style={{ width: `${Math.round(((3 - sessionsLeft) / 3) * 100)}%` }}
                  />
                </div>
                <span className="nearly-there-label">
                  {3 - sessionsLeft}/3 sessions at 90%+
                </span>
              </div>
            )}

            {newDiff && (
              <div className="diff-new-level">
                <span className="diff-new-label">Current difficulty:</span>
                <DifficultyBadge difficulty={newDiff} />
              </div>
            )}
          </div>

          {/* Progress message */}
          <p className="completion-progress">{practiceResult.progressMessage}</p>

          <button
            className="submit-button"
            onClick={() => onComplete(practiceResult)}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentDifficulty = adaptiveDifficulty || exercise?.adaptiveDifficulty;
  const estimatedMinutes = exercise?.estimatedTime || 15;

  // Determine whether the "Problem" content field should render as dark code block.
  // Priority: category → explicit field name → heuristic
  const categoryUpper = (category || '').toUpperCase();
  const alwaysWhiteCategory = categoryUpper === 'LANGUAGE' || categoryUpper === 'CERTIFICATION';
  const contentIsCode = !alwaysWhiteCategory && isCodeContent(exercise.content);

  return (
    <div className="practice-page">
      <div className="exercise-card">
        <h2 className="exercise-title">{exercise.title}</h2>

        <div className="exercise-meta">
          <span className="skill-badge">{skillName}</span>
          <DifficultyBadge difficulty={currentDifficulty} />
          <span className="time-estimate">⏱️ {estimatedMinutes} minutes</span>
          <span
            className="exercise-timer"
            style={{ color: getTimerColor(elapsedSeconds, estimatedMinutes) }}
          >
            {formatTimer(elapsedSeconds)}
          </span>
        </div>

        {/* Description — always white box, never dark code block */}
        <div className="description-box">
          <h3>Description</h3>
          <p>{exercise.description}</p>
        </div>

        {/* Problem — explicit code field → dark; LANGUAGE/CERTIFICATION → white; else heuristic */}
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
              {exercise.hints && exercise.hints.length > 0 ? (
                <ul>
                  {exercise.hints.map((hint, index) => (
                    <li key={index}>{hint}</li>
                  ))}
                </ul>
              ) : (
                <p>No hints available for this exercise.</p>
              )}
            </div>
          )}
        </div>

        {/* Show Answer Section */}
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

        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Score Form */}
        <form className="score-form" onSubmit={handleSubmit}>
          <h3>Submit Your Results</h3>

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
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <div className="timer-display-row">
            <span className="timer-display-label">Time elapsed:</span>
            <span
              className="timer-display-value"
              style={{ color: getTimerColor(elapsedSeconds, estimatedMinutes) }}
            >
              {formatTimer(elapsedSeconds)}
            </span>
            <span className="timer-display-estimate">/ {estimatedMinutes} min estimated</span>
          </div>

          <button
            type="submit"
            className="submit-button"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Score'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PracticePage;
