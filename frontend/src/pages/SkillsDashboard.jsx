import { useState, useEffect } from 'react';
import { getSkills, createSkill, updateSkill, deleteSkill } from '../services/api';
import './SkillsDashboard.css';
import PracticePage from './PracticePage';
import Analytics from './Analytics';
import StreakBadge from '../components/StreakBadge';
import TrendIndicator from '../components/TrendIndicator';
import PracticeInsights from '../components/PracticeInsights';
import QuickStats from '../components/QuickStats';

function SkillsDashboard({ userId }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [formData, setFormData] = useState({
    skillName: '', category: 'coding', proficiency: 'beginner', learningDate: '', importance: 'medium'
  });
  const [showPractice, setShowPractice] = useState(null);
  const [practiceStats, setPracticeStats] = useState({
    streak: 1, totalSessions: 2, averageScore: 82.5
  });

  useEffect(() => { loadSkills(); }, [userId]);

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
    setFormData({ skillName: '', category: 'coding', proficiency: 'beginner', learningDate: '', importance: 'medium' });
    setShowAddForm(true);
  };

  const handleEdit = (skill) => {
    setEditingSkill(skill);
    setFormData({ skillName: skill.skillName, category: skill.category, proficiency: skill.proficiency, learningDate: skill.learningDate, importance: skill.importance });
    setShowAddForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      if (editingSkill) { await updateSkill(editingSkill.skillId, userId, formData); }
      else { await createSkill(userId, formData); }
      setShowAddForm(false); setEditingSkill(null); await loadSkills();
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

  const handlePractice = (skill) => setShowPractice(skill);

  const handlePracticeComplete = (result) => {
    // Lambda returns score + updatedSkill but no 'health' field.
    // Derive health from the score as a proxy until backend adds it.
    const newScore = result.score ?? result.updatedSkill?.lastPracticeScore;
    const derivedHealth = newScore !== undefined ? newScore : null;
    const derivedHealthStatus = derivedHealth >= 80 ? 'healthy' : derivedHealth >= 60 ? 'at-risk' : 'critical';

    setSkills(prev => prev.map(skill =>
      skill.skillId === showPractice.skillId
        ? { ...skill, ...result.updatedSkill, health: derivedHealth ?? skill.health, healthStatus: derivedHealth !== null ? derivedHealthStatus : skill.healthStatus, lastPracticeScore: newScore ?? skill.lastPracticeScore }
        : skill
    ));

    if (newScore !== undefined) {
      setPracticeStats(prev => {
        const newTotal = prev.totalSessions + 1;
        const newAvg = Math.round(((prev.averageScore * prev.totalSessions) + newScore) / newTotal * 10) / 10;
        return { ...prev, totalSessions: newTotal, averageScore: newAvg };
      });
    }

    alert(`Great job! Next practice: ${result.nextReminderDate}\n${result.progressMessage}`);
    setShowPractice(null);
  };

  const handleCancel = () => { setShowAddForm(false); setEditingSkill(null); };

  if (loading && skills.length === 0) {
    return <div className="dashboard-container"><div className="loading-container"><div className="loading-spinner"></div></div></div>;
  }

  const calculatePortfolioHealth = () => {
    if (skills.length === 0) return 0;
    return Math.round(skills.reduce((sum, s) => sum + (s.health || 0), 0) / skills.length);
  };

  const portfolioHealth = calculatePortfolioHealth();
  const portfolioStatus = portfolioHealth >= 80 ? 'healthy' : portfolioHealth >= 60 ? 'at-risk' : 'critical';
  const currentStreak = practiceStats.streak;

  return (
    <div className="skills-dashboard">
      {showPractice ? (
        <div>
          <button onClick={() => setShowPractice(null)} className="back-button"
            style={{ marginBottom: '20px', padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
            Back to Dashboard
          </button>
          <PracticePage userId={userId} skillId={showPractice.skillId} skillName={showPractice.skillName}
            category={showPractice.category} proficiency={showPractice.proficiency} onComplete={handlePracticeComplete} />
        </div>
      ) : showAnalytics ? (
        <Analytics userId={userId} onBack={() => setShowAnalytics(false)} />
      ) : (
        <>
          <div className="dashboard-header">
            <div className="header-top">
              <h1>My Skills</h1>
              {skills.length > 0 && (
                <div className={`portfolio-health ${portfolioStatus}`}>
                  <span className="health-icon-large">{portfolioHealth >= 80 ? '🟢' : portfolioHealth >= 60 ? '🟡' : '🔴'}</span>
                  <div className="health-info">
                    <span className="health-label">Portfolio Health</span>
                    <span className="health-value">{portfolioHealth}%</span>
                  </div>
                </div>
              )}
              {skills.length > 0 && currentStreak > 0 && (
                <div className="streak-display">
                  <span className="streak-fire">🔥</span>
                  <div className="streak-info">
                    <span className="streak-value">{currentStreak}</span>
                    <span className="streak-label">Day Streak</span>
                  </div>
                </div>
              )}
              {skills.length > 0 && (
                <QuickStats skills={skills} practiceData={practiceStats} compact={true} />
              )}
            </div>
            <div className="header-actions">
              <button onClick={handleAddClick} className="add-skill-btn">+ Add New Skill</button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          {!loading && skills.length > 0 && <PracticeInsights skills={skills} compact={true} />}
          {!loading && skills.length === 0 && <div className="empty-state"><p>No skills yet. Add your first skill to start tracking!</p></div>}

          {!loading && skills.length > 0 && (
            <div className="skills-grid">
              {skills.map((skill) => (
                <div key={skill.skillId} className={`skill-card importance-${skill.importance} health-${skill.healthStatus || 'healthy'}`}>
                  <div className="skill-header">
                    <h3>{skill.skillName}</h3>
                    <div className="skill-scores-row">
                      {skill.health !== undefined && (
                        <div className={`health-badge health-${skill.healthStatus || 'healthy'}`}>
                          <span className="health-icon">{skill.health >= 80 ? '🟢' : skill.health >= 60 ? '🟡' : '🔴'}</span>
                          <div className="health-badge-info">
                            <span className="health-score">{skill.health}%</span>
                            <span className="health-score-label">Health</span>
                          </div>
                        </div>
                      )}
                      {skill.lastPracticeScore !== undefined && (
                        <div className="last-score-badge">
                          <span className="last-score-value">{skill.lastPracticeScore}%</span>
                          <span className="last-score-label">Last Score</span>
                        </div>
                      )}
                    </div>
                    {skill.trend && <TrendIndicator trend={skill.trend} change={skill.trendChange} size="small" />}
                  </div>
                  <p className="skill-category">{skill.category}</p>
                  <p className="skill-proficiency">Proficiency: {skill.proficiency}</p>
                  <p className="skill-importance">Importance: {skill.importance}</p>
                  {skill.learningDate && <p className="skill-date">Learning Date: {skill.learningDate}</p>}
                  {skill.nextReminderDate && <p className="skill-reminder">Next Reminder: {skill.nextReminderDate}</p>}
                  <div className="skill-card-actions">
                    <button onClick={() => handlePractice(skill)} className="practice-btn">Practice</button>
                    <button onClick={() => handleEdit(skill)} className="edit-btn">Edit</button>
                    <button onClick={() => handleDelete(skill.skillId)} className="delete-btn">Delete</button>
                  </div>
                </div>
              ))}
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
                      <option value="language">Language</option><option value="coding">Coding</option>
                      <option value="certification">Certification</option><option value="instrument">Instrument</option><option value="other">Other</option>
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
