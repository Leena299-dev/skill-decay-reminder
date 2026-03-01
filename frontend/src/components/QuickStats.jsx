import './QuickStats.css';

function QuickStats({ skills, practiceData = { streak: 1, totalSessions: 2, averageScore: 82.5 } }) {
  // Calculate stats
  const calculateStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Sessions this week (mock for now)
    const sessionsThisWeek = practiceData.totalSessions || 0;
    
    // Skills practiced today (mock)
    const skillsPracticedToday = 0;
    
    // Average score
    const avgScore = practiceData.averageScore || 0;
    
    // Current streak
    const currentStreak = practiceData.streak || 0;
    
    // Next practice due
    let nextDue = null;
    let daysUntilNext = null;
    
    if (skills.length > 0) {
      const sortedSkills = [...skills].sort((a, b) => {
        const dateA = new Date(a.nextReminderDate);
        const dateB = new Date(b.nextReminderDate);
        return dateA - dateB;
      });
      
      const nextSkill = sortedSkills[0];
      if (nextSkill?.nextReminderDate) {
        const reminderDate = new Date(nextSkill.nextReminderDate);
        const todayDate = new Date();
        daysUntilNext = Math.ceil((reminderDate - todayDate) / (1000 * 60 * 60 * 24));
        nextDue = nextSkill.skillName;
      }
    }
    
    return {
      sessionsThisWeek,
      skillsPracticedToday,
      avgScore,
      currentStreak,
      nextDue,
      daysUntilNext
    };
  };

  const stats = calculateStats();

  return (
    <div className="quick-stats-container">
      <div className="quick-stat">
        <div className="stat-icon">📊</div>
        <div className="stat-content">
          <div className="stat-value">{stats.sessionsThisWeek}</div>
          <div className="stat-label">This Week</div>
        </div>
      </div>

      <div className="quick-stat">
        <div className="stat-icon">🔥</div>
        <div className="stat-content">
          <div className="stat-value">{stats.currentStreak}</div>
          <div className="stat-label">Day Streak</div>
        </div>
      </div>

      <div className="quick-stat">
        <div className="stat-icon">🎯</div>
        <div className="stat-content">
          <div className="stat-value">{stats.avgScore}%</div>
          <div className="stat-label">Avg Score</div>
        </div>
      </div>

      {stats.nextDue && (
        <div className="quick-stat next-due">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <div className="stat-value">
              {stats.daysUntilNext === 0 ? 'Today' : 
               stats.daysUntilNext === 1 ? 'Tomorrow' : 
               `${stats.daysUntilNext}d`}
            </div>
            <div className="stat-label">{stats.nextDue}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickStats;