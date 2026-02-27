import './TrendIndicator.css';

const TREND_CONFIG = {
  improving: {
    icon: '↗️',
    label: 'Improving',
    color: '#22c55e'
  },
  stable: {
    icon: '➡️',
    label: 'Stable',
    color: '#3b82f6'
  },
  declining: {
    icon: '↘️',
    label: 'Declining',
    color: '#f59e0b'
  }
};

function TrendIndicator({ trend, change, size = 'small' }) {
  const config = TREND_CONFIG[trend] || TREND_CONFIG.stable;
  
  return (
    <div 
      className={`trend-indicator ${trend} ${size}`}
      style={{ borderColor: config.color }}
    >
      <span className="trend-icon">{config.icon}</span>
      {size === 'large' && (
        <>
          <span className="trend-label">{config.label}</span>
          {change && (
            <span 
              className="trend-change"
              style={{ color: config.color }}
            >
              {change > 0 ? '+' : ''}{change}%
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default TrendIndicator;