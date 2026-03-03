import React, { useState, useEffect } from 'react';
import { generateExercise, submitPracticeSession } from '../services/api';
import './PracticePage.css';

// Detect if content looks like code (has indentation, brackets, keywords)
const isCodeContent = (content) => {
  if (!content) return false;
  return /[{};]|def |function |import |const |let |var |class |=>/.test(content);
};

const PracticePage = ({ userId, skillId, skillName, category, proficiency, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState(null);
  const [error, setError] = useState('');
  const [score, setScore] = useState(80);
  const [timeSpent, setTimeSpent] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    const fetchExercise = async () => {
      try {
        setLoading(true);
        setError('');
        const result = await generateExercise(userId, skillId, skillName, category, proficiency);
        setExercise(result);
      } catch (err) {
        setError(err.message || 'Failed to generate exercise. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchExercise();
  }, [userId, skillId, skillName, category, proficiency]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (score < 0 || score > 100) {
      setError('Score must be between 0 and 100');
      return;
    }
    
    if (timeSpent <= 0) {
      setError('Time spent must be greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const result = await submitPracticeSession(
        userId,
        skillId,
        exercise.exerciseId,
        score,
        timeSpent
      );
      onComplete(result);
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

  const contentIsCode = isCodeContent(exercise.content);

  return (
    <div className="practice-page">
      <div className="exercise-card">
        <h2 className="exercise-title">{exercise.title}</h2>
        
        <div className="exercise-meta">
          <span className="skill-badge">{skillName}</span>
          <span className="time-estimate">⏱️ {exercise.estimatedTime || 15} minutes</span>
        </div>

        {/* Description */}
        <div className="description-box">
          <h3>Description</h3>
          <p>{exercise.description}</p>
        </div>

        {/* Problem — code vs plain text rendering */}
        <div className="content-box">
          <h3>Problem</h3>
          {contentIsCode ? (
            <pre className="code-block"><code>{exercise.content}</code></pre>
          ) : (
            <div className="text-content">{exercise.content}</div>
          )}
        </div>

        {/* Hints */}
        <div className="hints-section">
          <button 
            className="hints-toggle"
            onClick={() => setShowHints(!showHints)}
            type="button"
          >
            {showHints ? '▼' : '▶'} Hints
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

        {/* ✅ NEW: Show Answer Section */}
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
                isCodeContent(exercise.solution || exercise.answer) ? (
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

          <div className="form-group">
            <label htmlFor="timeSpent">Time Spent (minutes)</label>
            <input
              type="number"
              id="timeSpent"
              min="1"
              value={timeSpent}
              onChange={(e) => setTimeSpent(Number(e.target.value))}
              disabled={submitting}
              required
            />
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

