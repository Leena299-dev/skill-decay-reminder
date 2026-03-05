import { useState } from 'react';
import { registerUser, createSkill } from '../services/api';
import './WelcomeScreen.css';

const EMPTY_SKILL = {
  skillName: '', category: 'coding', proficiency: 'beginner', learningDate: '', importance: 'medium',
};

function Brand() {
  return (
    <div className="welcome-brand">
      <span className="welcome-brand-icon">⚡</span>
      <span className="welcome-brand-name">SharpEdge</span>
    </div>
  );
}

function WelcomeScreen({ email, userId, userName, onRegistered, onReady, onBack }) {
  // Phase 1 state
  const [name, setName] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Phase 2+ state
  const [addedSkills, setAddedSkills] = useState([]);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [skillForm, setSkillForm] = useState(EMPTY_SKILL);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillError, setSkillError] = useState('');

  const displayName = userName || name.trim();

  // Phase 1: Register account
  const handleRegister = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setRegError('Name must be between 2 and 100 characters.');
      return;
    }
    setRegError('');
    setRegLoading(true);
    try {
      const data = await registerUser(email, trimmed);
      onRegistered(data.userId, trimmed);
      setShowSkillForm(true); // immediately open skill form
    } catch (err) {
      setRegError(err?.error || err?.message || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  // Phase 2+: Add a skill
  const handleSkillFieldChange = (e) => {
    const { name: field, value } = e.target;
    setSkillForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    setSkillError('');
    setSkillLoading(true);
    try {
      await createSkill(userId, skillForm);
      setAddedSkills(prev => [...prev, skillForm.skillName]);
      setSkillForm(EMPTY_SKILL);
      setShowSkillForm(false);
    } catch (err) {
      setSkillError(err?.error || err?.message || 'Failed to add skill. Please try again.');
    } finally {
      setSkillLoading(false);
    }
  };

  // ── Phase 1: Registration ──────────────────────────────────────────────────
  if (!userId) {
    return (
      <div className="welcome-screen">
        <div className="welcome-card">
          <Brand />
          <h1 className="welcome-title">Welcome to SharpEdge!</h1>
          <p className="welcome-intro">
            Using the science of spaced repetition and forgetting curves, SharpEdge
            tracks your skills and tells you exactly when to practise to prevent
            knowledge decay.
          </p>
          <ul className="welcome-benefits">
            <li>📚 Track any skill — coding, languages, design, and more</li>
            <li>🤖 AI-generated practice exercises tailored to your level</li>
            <li>🔔 Smart reminders so you practise at the perfect moment</li>
          </ul>
          <form className="welcome-form" onSubmit={handleRegister}>
            <label className="welcome-label" htmlFor="welcome-name">
              What should we call you?
            </label>
            <input
              id="welcome-name"
              className="welcome-input"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              minLength={2}
              maxLength={100}
            />
            {regError && <p className="welcome-error">{regError}</p>}
            <button
              className="welcome-cta-btn"
              type="submit"
              disabled={regLoading || !name.trim()}
            >
              {regLoading ? 'Setting up…' : '+ Add Your First Skill'}
            </button>
          </form>
          <button className="welcome-back-link" onClick={onBack} type="button">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Phase 2: Skill form ────────────────────────────────────────────────────
  if (showSkillForm) {
    return (
      <div className="welcome-screen">
        <div className="welcome-card welcome-card--wide">
          <Brand />
          <h1 className="welcome-title">
            {addedSkills.length === 0
              ? `Let's add your first skill, ${displayName}!`
              : 'Add another skill'}
          </h1>
          <form className="welcome-form" onSubmit={handleAddSkill}>
            <label className="welcome-label">Skill Name</label>
            <input
              className="welcome-input"
              name="skillName"
              type="text"
              placeholder="e.g. Python, Spanish, Guitar"
              value={skillForm.skillName}
              onChange={handleSkillFieldChange}
              required
              autoFocus
            />
            <div className="welcome-field-grid">
              <div className="welcome-field-group">
                <label className="welcome-label">Category</label>
                <select className="welcome-select" name="category" value={skillForm.category} onChange={handleSkillFieldChange}>
                  <option value="coding">Coding</option>
                  <option value="language">Language</option>
                  <option value="certification">Certification</option>
                  <option value="instrument">Instrument</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="welcome-field-group">
                <label className="welcome-label">Proficiency</label>
                <select className="welcome-select" name="proficiency" value={skillForm.proficiency} onChange={handleSkillFieldChange}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              <div className="welcome-field-group">
                <label className="welcome-label">Importance</label>
                <select className="welcome-select" name="importance" value={skillForm.importance} onChange={handleSkillFieldChange}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="welcome-field-group">
                <label className="welcome-label">Learning Date</label>
                <input
                  className="welcome-input"
                  name="learningDate"
                  type="date"
                  value={skillForm.learningDate}
                  onChange={handleSkillFieldChange}
                  required
                />
              </div>
            </div>
            {skillError && <p className="welcome-error">{skillError}</p>}
            <div className="welcome-actions">
              <button
                className="welcome-cta-btn"
                type="submit"
                disabled={skillLoading || !skillForm.skillName.trim() || !skillForm.learningDate}
              >
                {skillLoading ? 'Adding…' : 'Add Skill →'}
              </button>
              {addedSkills.length > 0 && (
                <button
                  className="welcome-secondary-btn"
                  type="button"
                  onClick={() => setShowSkillForm(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Phase 3: Confirmation ──────────────────────────────────────────────────
  return (
    <div className="welcome-screen">
      <div className="welcome-card welcome-card--wide">
        <Brand />
        <div className="welcome-success-banner">
          <span className="welcome-success-icon">✓</span>
          <div>
            <h2 className="welcome-success-title">Great! Your first skill has been added.</h2>
            <p className="welcome-success-sub">
              You have added {addedSkills.length} skill{addedSkills.length !== 1 ? 's' : ''} so far.
            </p>
          </div>
        </div>
        <ul className="welcome-added-skills">
          {addedSkills.map((s, i) => (
            <li key={i} className="welcome-added-skill-item">
              <span className="welcome-added-skill-check">✓</span>
              {s}
            </li>
          ))}
        </ul>
        <div className="welcome-actions welcome-actions--stacked">
          <button className="welcome-cta-btn" onClick={onReady}>
            Go to My Dashboard →
          </button>
          <button className="welcome-secondary-btn" onClick={() => setShowSkillForm(true)}>
            + Add Another Skill
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
