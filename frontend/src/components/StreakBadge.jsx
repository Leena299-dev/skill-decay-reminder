import './StreakBadge.css';

const BADGES = {
  '7-day': {
    icon: '🔥',
    title: '7-Day Streak',
    description: 'Practiced for 7 days straight',
    color: '#ff6b6b'
  },
  '30-day': {
    icon: '⭐',
    title: '30-Day Champion',
    description: 'Practiced for 30 days straight',
    color: '#ffd93d'
  },
  '100-day': {
    icon: '🏆',
    title: '100-Day Legend',
    description: 'Practiced for 100 days straight',
    color: '#6bcf7f'
  },
  'perfect-week': {
    icon: '🎯',
    title: 'Perfect Week',
    description: 'Practiced every day this week',
    color: '#667eea'
  }
};

function StreakBadge({ type, earned = false, size = 'medium' }) {
  const badge = BADGES[type];
  
  if (!badge) return null;

  return (
    <div 
      className={`streak-badge ${size} ${earned ? 'earned' : 'locked'}`}
      style={{ borderColor: earned ? badge.color : '#ccc' }}
      title={badge.description}
    >
      <div className="badge-icon" style={{ opacity: earned ? 1 : 0.3 }}>
        {badge.icon}
      </div>
      {size === 'large' && (
        <div className="badge-info">
          <div className="badge-title">{badge.title}</div>
          <div className="badge-description">{badge.description}</div>
        </div>
      )}
    </div>
  );
}

export default StreakBadge;