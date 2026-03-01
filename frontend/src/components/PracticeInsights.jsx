import './PracticeInsights.css';

function PracticeInsights({ skills }) {
  // Generate insights based on skill data
  const generateInsights = () => {
    const insights = [];
    const today = new Date();

    skills.forEach(skill => {
      const reminderDate = new Date(skill.nextReminderDate);
      const daysUntil = Math.ceil((reminderDate - today) / (1000 * 60 * 60 * 24));
      
      // Overdue skills (critical)
      if (daysUntil < 0) {
        insights.push({
          type: 'critical',
          icon: '⚠️',
          message: `${skill.skillName} needs practice - overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''}!`,
          skillId: skill.skillId,
          priority: 1
        });
      }
      // Due soon (warning)
      else if (daysUntil === 0) {
        insights.push({
          type: 'warning',
          icon: '📅',
          message: `${skill.skillName} practice is due today!`,
          skillId: skill.skillId,
          priority: 2
        });
      }
      else if (daysUntil <= 2) {
        insights.push({
          type: 'warning',
          icon: '🔔',
          message: `${skill.skillName} practice coming up in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
          skillId: skill.skillId,
          priority: 3
        });
      }
      // Healthy skills (positive)
      else if (skill.health >= 90) {
        insights.push({
          type: 'success',
          icon: '✨',
          message: `Great job! ${skill.skillName} skills are thriving!`,
          skillId: skill.skillId,
          priority: 4
        });
      }
    });

    // Add general insights
    const criticalCount = skills.filter(s => s.health < 60).length;
    const healthyCount = skills.filter(s => s.health >= 80).length;

    if (criticalCount > 0) {
      insights.push({
        type: 'info',
        icon: '📊',
        message: `${criticalCount} skill${criticalCount !== 1 ? 's' : ''} need${criticalCount === 1 ? 's' : ''} urgent attention`,
        priority: 1
      });
    }

    if (healthyCount === skills.length && skills.length > 0) {
      insights.push({
        type: 'success',
        icon: '🎉',
        message: `Perfect! All ${skills.length} skills are in excellent health!`,
        priority: 5
      });
    }

    // Sort by priority (lower = more important)
    return insights.sort((a, b) => a.priority - b.priority).slice(0, 5);
  };

  const insights = generateInsights();

  if (insights.length === 0) {
    return (
      <div className="insights-container">
        <h2>💡 Practice Insights</h2>
        <div className="insight-card info">
          <span className="insight-icon">📚</span>
          <p className="insight-message">Add some skills to get personalized insights!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-container">
      <h2>💡 Practice Insights</h2>
      <div className="insights-list">
        {insights.map((insight, index) => (
          <div key={index} className={`insight-card ${insight.type}`}>
            <span className="insight-icon">{insight.icon}</span>
            <p className="insight-message">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PracticeInsights;