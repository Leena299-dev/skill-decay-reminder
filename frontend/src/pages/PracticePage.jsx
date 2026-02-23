import React, { useState, useEffect } from 'react';
import { generateExercise, submitPracticeSession } from '../services/api';
import './PracticePage.css';

const PracticePage = ({ userId, skillId, skillName, category, proficiency, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState(null);
  const [error, setError] = useState('');
  const [score, setScore] = useState(80);
  const [timeSpent, setTimeSpent] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [showHints, setShowHints] = useState(false);

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

  if (loading) {
    return (
      <div className="practice-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Generating your personalized exercise...</p>
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

  return (
    <div className="practice-page">
      <div className="exercise-card">
        <h2 className="exercise-title">{exercise.title}</h2>
        
        <div className="exercise-meta">
          <span className="skill-badge">{skillName}</span>
          <span className="time-estimate">⏱️ {exercise.estimatedTime || 15} minutes</span>
        </div>

        <div className="description-box">
          <h3>Description</h3>
          <p>{exercise.description}</p>
        </div>

        <div className="content-box">
          <h3>Problem</h3>
          <pre><code>{exercise.content}</code></pre>
        </div>

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

        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        <form className="score-form" onSubmit={handleSubmit}>
          <h3>Submit Your Results</h3>
          
          <div className="form-group">
            <label htmlFor="score">
              Score: <strong>{score}</strong>
            </label>
            <input
              type="range"
              id="score"
              min="0"
              max="100"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              disabled={submitting}
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
