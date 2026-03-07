import { useState, useEffect } from 'react';
import { getSkills, createSkill, updateSkill, deleteSkill, getAnalytics } from '../services/api';
import { SKILL_CATEGORIES, getCategoryLabel, normalizeCategory } from '../utils/categories';
import './SkillsDashboard.css';
import PracticePage from './PracticePage';

function getDaysUntil(dateStr) {
  if (!dateStr) return 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function getPrioritySkill(skills) {
  const practised = skills.filter(s => (s.totalPracticeCount ?? 0) > 0);
  if (!practised || practised.length === 0) return null;
  const withDays = practised.map(s => ({ ...s, _days: getDaysUntil(s.nextReminderDate) }));
  const overdue = withDays.filter(s => s._days < 0);
  if (overdue.length > 0) {
    return overdue.sort((a, b) => a._days - b._days)[0];
  }
  return withDays.sort((a, b) => a._days - b._days)[0];
}

function getUrgencyMessage(daysUntil) {
  if (daysUntil >= 0) return `Coming up in ${daysUntil} day(s) — stay ahead of the curve`;
  if (daysUntil >= -3) return 'Practice due — keep your momentum going';
  if (daysUntil >= -7) return 'Skills start fading after a week without practice';
  if (daysUntil >= -30) return "You're losing ground — a quick session will help";
  return 'High risk of decay — practice today to recover';
}

function healthStatusFromScore(health) {
  const h = health || 0;
  if (h >= 80) return { status: 'excellent', label: 'Excellent' };
  if (h >= 60) return { status: 'good',      label: 'Good' };
  if (h >= 40) return { status: 'at-risk',   label: 'At Risk' };
  return              { status: 'critical',  label: 'Critical' };
}

function SkillsDashboard({ userId, autoOpenAddModal, onAddModalOpened, autoOpenPracticeSkillId, onPracticeSkillOpened }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [formData, setFormData] = useState({
    skillName: '', category: 'certification', proficiency: 'beginner', learningDate: '', importance: 'medium'
  });
  const [showPractice, setShowPractice] = useState(null);
  const [practiceStats, setPracticeStats] = useState({
    streak: 0, totalSessions: 0, averageScore: 0
  });
  const [practiceJustCompleted, setPracticeJustCompleted] = useState(false);

  useEffect(() => {
    loadSkills();
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (autoOpenAddModal) {
      handleAddClick();
      onAddModalOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open practice for a skill when triggered from notification centre
  useEffect(() => {
    if (!autoOpenPracticeSkillId || skills.length === 0) return;
    const skill = skills.find(s => s.skillId === autoOpenPracticeSkillId);
    if (skill) {
      handlePractice(skill);
      onPracticeSkillOpened?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenPracticeSkillId, skills]);

  const loadAnalytics = async () => {
    try {
      const data = await getAnalytics(userId);
      setPracticeStats({
        streak: data.streak || 0,
        totalSessions: data.totalSessions || 0,
        averageScore: data.averageScore || 0,
      });
    } catch {
      // Non-fatal: stats stay at zero if analytics unavailable
    }
  };

  const loadSkills = async () => {
    setLoading(true); setError(null);
    try {
      const data = await getSkills(userId);
      setSkills(data.skills || []);
    } catch (err) { setError(err.error || 'Failed to load skills'); }
    finally { setLoading(false); }
  };

  const handleAddClick = () => {
    setEditingSkill(null);
    setFormData({ skillName: '', category: 'certification', proficiency: 'beginner', learningDate: '', importance: 'medium' });
    setShowAddForm(true);
  };

  const handleEdit = (skill) => {
    setEditingSkill(skill);
    setFormData({
      skillName: skill.skillName,
      category: normalizeCategory(skill.category),
      proficiency: skill.proficiency,
      learningDate: skill.learningDate,
      importance: skill.importance,
    });
    setShowAddForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      if (editingSkill) { await updateSkill(editingSkill.skillId, userId, formData); }
      else { await createSkill(userId, formData); }
      setShowAddForm(false); setEditingSkill(null);
      await loadSkills();
    } catch (err) { setError(err.error || 'Failed to save skill'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (skillId) => {
    if (!window.confirm('Are you sure you want to delete this skill?')) return;
    setLoading(true); setError(null);
    try { await deleteSkill(skillId, userId); await loadSkills(); }
    catch (err) { setError(err.error || 'Failed to delete skill'); }
    finally { setLoading(false); }
  };

  const handlePractice = (skill) => {
    setPracticeJustCompleted(false);
    setShowPractice(skill);
  };

  const handlePracticeComplete = async () => {
    setShowPractice(null);
    setPracticeJustCompleted(true);
    await loadSkills();
    loadAnalytics();
  };

  const handleCancel = () => { setShowAddForm(false); setEditingSkill(null); };

  if (loading && skills.length === 0) {
    return <div className="dashboard-container"><div className="loading-container"><div className="loading-spinner"></div></div></div>;
  }

  const practicedSkills = skills.filter(s => (s.totalPracticeCount ?? 0) > 0);
  const newSkills = skills.filter(s => (s.totalPracticeCount ?? 0) === 0);
  const allSkillsNew = skills.length > 0 && practicedSkills.length === 0;

  const portfolioHealth = skills.length === 0 ? 0
    : Math.round(skills.reduce((sum, s) => sum + (s.health || 0), 0) / skills.length);

  const prioritySkill = getPrioritySkill(skills);
  const priorityDaysUntil = prioritySkill ? getDaysUntil(prioritySkill.nextReminderDate) : 0;
  const anyOverdue = practicedSkills.some(s => getDaysUntil(s.nextReminderDate) < 0);

  const getPriorityCardClass = () => {
    if (practiceJustCompleted && !anyOverdue) return 'priority-card--all-clear';
    if (priorityDaysUntil >= -3) return 'priority-card--good';
    if (priorityDaysUntil >= -7) return 'priority-card--warning';
    return 'priority-card--danger';
  };

  const sortedSkills = [
    ...[...practicedSkills].sort((a, b) => getDaysUntil(a.nextReminderDate) - getDaysUntil(b.nextReminderDate)),
    ...newSkills,
  ];

  const getDaysLabel = (skill) => {
    const days = getDaysUntil(skill.nextReminderDate);
    if (days === 0) return 'Due today';
    if (days > 0) return `Due in ${days} day${days === 1 ? '' : 's'}`;
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  };

  return (
    <div className="skills-dashboard">
      {showPractice ? (
        <div>
          <button onClick={() => setShowPractice(null)} className="back-button"
            style={{ marginBottom: '20px', padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
            ← Back to Dashboard
          </button>
          <PracticePage userId={userId} skillId={showPractice.skillId} skillName={showPractice.skillName}
            category={showPractice.category} proficiency={showPractice.proficiency}
            adaptiveDifficulty={showPractice.adaptiveDifficulty} onComplete={handlePracticeComplete} />
        </div>
      ) : (
        <>
          <div className="dashboard-header">
            <h1>My Skills</h1>
          </div>

          {error && <div className="error-message">{error}</div>}

          {/* Priority Practice Card */}
          {skills.length === 0 ? (
            <div className="priority-card priority-card--empty">
              <div className="priority-card__info">
                <p className="priority-card__message">No skills yet. Add your first skill below.</p>
              </div>
            </div>
          ) : allSkillsNew ? (
            <div className="priority-card priority-card--empty">
              <div className="priority-card__info">
                <span className="priority-card__skill-name">Ready to start?</span>
                <p className="priority-card__message">Start practising to track your progress</p>
              </div>
              <div className="priority-card__action">
                <button className="priority-practice-btn"
                  onClick={() => document.querySelector('.skills-grid')?.scrollIntoView({ behavior: 'smooth' })}>
                  Choose a skill to practise
                </button>
              </div>
            </div>
          ) : practiceJustCompleted && !anyOverdue ? (
            <div className="priority-card priority-card--all-clear">
              <div className="priority-card__info">
                <span className="priority-card__skill-name">Great work!</span>
                <p className="priority-card__message">All skills on track. Keep up the momentum!</p>
              </div>
            </div>
          ) : prioritySkill && (
            <div className={`priority-card ${getPriorityCardClass()}`}>
              <div className="priority-card__info">
                <div className="priority-card__title-row">
                  <span className="priority-card__skill-name">{prioritySkill.skillName}</span>
                  <span className="priority-card__category">{getCategoryLabel(prioritySkill.category)}</span>
                </div>
                <p className="priority-card__message">{getUrgencyMessage(priorityDaysUntil)}</p>
                <div className="priority-card__health skill-health-bar-container">
                  <div className="skill-health-bar-header">
                    <span className="skill-health-label">Health</span>
                    <div className="skill-health-right">
                      <span className="skill-health-pct">{prioritySkill.health || 0}%</span>
                      <span className={`skill-health-status status-${healthStatusFromScore(prioritySkill.health).status}`}>
                        {healthStatusFromScore(prioritySkill.health).label}
                      </span>
                    </div>
                  </div>
                  <div className="skill-health-bar-track">
                    <div
                      className={`skill-health-bar-fill status-${healthStatusFromScore(prioritySkill.health).status}`}
                      style={{ width: `${prioritySkill.health || 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="priority-card__action">
                <button className="priority-practice-btn" onClick={() => handlePractice(prioritySkill)}>
                  Practice Now →
                </button>
              </div>
            </div>
          )}

          {/* Stats Row */}
          {skills.length > 0 && (
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-value">{portfolioHealth}%</div>
                <div className="stat-label">Portfolio Health</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-value">{practiceStats.totalSessions}</div>
                <div className="stat-label">Sessions This Week</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-value">{practiceStats.averageScore}%</div>
                <div className="stat-label">Average Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🔥</div>
                <div className="stat-value">{practiceStats.streak}</div>
                <div className="stat-label">Day Streak</div>
              </div>
            </div>
          )}

          {/* Skills Grid */}
          {!loading && (
            <div className="skills-grid">
              {sortedSkills.map((skill) => {
                const isNew = (skill.totalPracticeCount ?? 0) === 0;
                const { status, label } = isNew
                  ? { status: 'new', label: 'New' }
                  : healthStatusFromScore(skill.health);
                const displayPct = isNew ? 0 : (skill.health || 0);
                return (
                  <div key={skill.skillId} className={`skill-card importance-${skill.importance}`}>
                    {isNew && <span className="skill-badge-new">NEW</span>}
                    <div className="skill-header">
                      <h3>{skill.skillName}</h3>
                      <span className="skill-category">{getCategoryLabel(skill.category)}</span>
                    </div>
                    {skill.adaptiveDifficulty && (
                      <span className={`skill-difficulty-badge skill-difficulty-badge--${skill.adaptiveDifficulty.split('_')[0]}`}>
                        {skill.adaptiveDifficulty.replace('_', ' ')}
                      </span>
                    )}
                    <div className="skill-health-bar-container">
                      <div className="skill-health-bar-header">
                        <span className="skill-health-label">Avg Score</span>
                        <div className="skill-health-right">
                          <span className="skill-health-pct">{displayPct}%</span>
                          <span className={`skill-health-status status-${status}`}>{label}</span>
                        </div>
                      </div>
                      <div className="skill-health-bar-track">
                        <div
                          className={`skill-health-bar-fill status-${status}`}
                          style={{ width: `${displayPct}%` }}
                        />
                      </div>
                    </div>
                    <p className="skill-days-label">{getDaysLabel(skill)}</p>
                    <div className="skill-card-actions">
                      <button onClick={() => handlePractice(skill)} className="practice-btn">Practice</button>
                      <button onClick={() => handleEdit(skill)} className="edit-btn">Edit</button>
                      <button onClick={() => handleDelete(skill.skillId)} className="delete-btn">Delete</button>
                    </div>
                  </div>
                );
              })}
              <div className="skill-card add-skill-card" onClick={handleAddClick}>
                <span className="add-skill-plus">+</span>
                <span className="add-skill-text">Add New Skill</span>
              </div>
            </div>
          )}

          {showAddForm && (
            <div className="modal-overlay" onClick={handleCancel}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{editingSkill ? 'Edit Skill' : 'Add New Skill'}</h2>
                <form onSubmit={handleSubmit}>
                  <div className="form-group"><label>Skill Name</label><input type="text" name="skillName" value={formData.skillName} onChange={handleInputChange} required /></div>
                  <div className="form-group"><label>Category</label>
                    <select name="category" value={formData.category} onChange={handleInputChange}>
                      {SKILL_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group"><label>Proficiency</label>
                    <select name="proficiency" value={formData.proficiency} onChange={handleInputChange}>
                      <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option><option value="expert">Expert</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Learning Date</label><input type="date" name="learningDate" value={formData.learningDate} onChange={handleInputChange} required /></div>
                  <div className="form-group"><label>Importance</label>
                    <select name="importance" value={formData.importance} onChange={handleInputChange}>
                      <option value="low">Low</option><option value="medium">Medium</option>
                      <option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="submit-btn">{editingSkill ? 'Update' : 'Add'} Skill</button>
                    <button type="button" onClick={handleCancel} className="cancel-btn">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SkillsDashboard;
