import { useState, useEffect } from 'react';
import { getSkills, createSkill, updateSkill, deleteSkill } from '../services/api';
import './SkillsDashboard.css';

function SkillsDashboard({ userId }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [formData, setFormData] = useState({
    skillName: '',
    category: 'coding',
    proficiency: 'beginner',
    learningDate: '',
    importance: 'medium'
  });

  // Load skills when component mounts
  useEffect(() => {
    loadSkills();
  }, [userId]);

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSkills(userId);
      setSkills(data.skills || []);
    } catch (err) {
      setError(err.error || 'Failed to load skills');
      console.error('Load skills error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingSkill(null);
    setFormData({
      skillName: '',
      category: 'coding',
      proficiency: 'beginner',
      learningDate: '',
      importance: 'medium'
    });
    setShowAddForm(true);
  };

  const handleEdit = (skill) => {
    console.log('Edit clicked for skill:', skill);
    setEditingSkill(skill);
    setFormData({
      skillName: skill.skillName,
      category: skill.category,
      proficiency: skill.proficiency,
      learningDate: skill.learningDate,
      importance: skill.importance
    });
    setShowAddForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingSkill) {
        // Update existing skill
        console.log('Updating skill:', editingSkill.skillId);
        await updateSkill(editingSkill.skillId, userId, formData);
      } else {
        // Create new skill
        console.log('Creating new skill');
        await createSkill(userId, formData);
      }
      
      setShowAddForm(false);
      setEditingSkill(null);
      await loadSkills();
    } catch (err) {
      setError(err.error || 'Failed to save skill');
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (skillId) => {
    if (!window.confirm('Are you sure you want to delete this skill?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteSkill(skillId, userId);
      await loadSkills();
    } catch (err) {
      setError(err.error || 'Failed to delete skill');
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingSkill(null);
  };

  if (loading && skills.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Skills Dashboard</h1>
        <p className="user-info">User ID: {userId}</p>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="dashboard-actions">
        <button className="add-skill-button" onClick={handleAddClick}>
          + Add New Skill
        </button>
      </div>

      {skills.length === 0 ? (
        <div className="empty-state">
          <h3>No skills yet</h3>
          <p>Add your first skill to start tracking your learning journey!</p>
          <button className="add-skill-button" onClick={handleAddClick} style={{marginTop: '20px'}}>
            Add Your First Skill
          </button>
        </div>
      ) : (
        <div className="skills-grid">
          {skills.map(skill => (
            <div 
              key={skill.skillId} 
              className={`skill-card importance-${skill.importance}`}
            >
              <h3>{skill.skillName}</h3>
              
              <div className="skill-meta">
                <span className="skill-badge badge-category">
                  {skill.category}
                </span>
                <span className="skill-badge badge-proficiency">
                  {skill.proficiency}
                </span>
                <span className={`skill-badge badge-importance ${skill.importance}`}>
                  {skill.importance}
                </span>
              </div>

              <div className="skill-info">
                <strong>Learning Date:</strong> {skill.learningDate}
              </div>
              <div className="skill-info">
                <strong>Next Reminder:</strong> {skill.nextReminderDate || 'Not set'}
              </div>

              <div className="skill-actions">
                <button 
                  className="edit-button" 
                  onClick={() => handleEdit(skill)}
                  disabled={loading}
                >
                  Edit
                </button>
                <button 
                  className="delete-button" 
                  onClick={() => handleDelete(skill.skillId)}
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="skill-form-modal" onClick={handleCancel}>
          <div className="skill-form" onClick={(e) => e.stopPropagation()}>
            <h2>{editingSkill ? 'Edit Skill' : 'Add New Skill'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Skill Name *</label>
                <input
                  type="text"
                  name="skillName"
                  value={formData.skillName}
                  onChange={handleInputChange}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g., Python Programming"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="language">Language</option>
                    <option value="coding">Coding</option>
                    <option value="certification">Certification</option>
                    <option value="instrument">Instrument</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Proficiency *</label>
                  <select
                    name="proficiency"
                    value={formData.proficiency}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Learning Date *</label>
                  <input
                    type="date"
                    name="learningDate"
                    value={formData.learningDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Importance *</label>
                  <select
                    name="importance"
                    value={formData.importance}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="form-buttons">
                <button 
                  type="submit" 
                  className="save-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Skill'
                  )}
                </button>
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SkillsDashboard;