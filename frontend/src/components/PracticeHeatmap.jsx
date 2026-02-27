import { useState } from 'react';
import './PracticeHeatmap.css';

function PracticeHeatmap({ practiceData }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  // Generate last 30 days
  const generateDays = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Find practice sessions for this day
      const dayData = practiceData.find(d => d.date === dateStr);
      const sessions = dayData ? dayData.sessions : 0;
      
      days.push({
        date: dateStr,
        sessions,
        day: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
        intensity: getIntensity(sessions)
      });
    }
    
    return days;
  };

  const getIntensity = (sessions) => {
    if (sessions === 0) return 0;
    if (sessions === 1) return 1;
    if (sessions === 2) return 2;
    if (sessions <= 4) return 3;
    return 4;
  };

  const days = generateDays();

  // Group by week for grid layout
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="heatmap-container">
      <h2>🗓️ Practice Activity</h2>
      <p className="heatmap-subtitle">Last 30 Days</p>
      
      <div className="heatmap-grid">
        {days.map((day, index) => (
          <div
            key={index}
            className={`heatmap-day intensity-${day.intensity}`}
            onMouseEnter={() => setHoveredDay(day)}
            onMouseLeave={() => setHoveredDay(null)}
            title={`${day.date}: ${day.sessions} session${day.sessions !== 1 ? 's' : ''}`}
          >
            {hoveredDay?.date === day.date && (
              <div className="heatmap-tooltip">
                <div className="tooltip-date">{day.weekday}, {day.month} {day.day}</div>
                <div className="tooltip-sessions">
                  {day.sessions === 0 ? 'No practice' : `${day.sessions} session${day.sessions !== 1 ? 's' : ''}`}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span className="legend-label">Less</span>
        <div className="heatmap-day intensity-0"></div>
        <div className="heatmap-day intensity-1"></div>
        <div className="heatmap-day intensity-2"></div>
        <div className="heatmap-day intensity-3"></div>
        <div className="heatmap-day intensity-4"></div>
        <span className="legend-label">More</span>
      </div>
    </div>
  );
}

export default PracticeHeatmap;