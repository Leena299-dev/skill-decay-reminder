import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Analytics.css';

function Analytics({ userId, onBack }) {
  const [analyticsData, setAnalyticsData] = useState({
    streak: 1,
    totalSessions: 2,
    totalTime: 30,
    averageScore: 82.5,
    practiceFrequency: [
      { date: '2026-02-20', sessions: 1 },
      { date: '2026-02-23', sessions: 1 }
    ],
    practiceBySkill: [
      { skillName: 'Spanish', sessions: 2, totalTime: 30, avgScore: 82.5 }
    ]
  });

 return (
  <div className="analytics-container">
    {/* Back Button */}
    <div className="analytics-header">
      <button 
        onClick={onBack} 
        className="back-to-dashboard-btn"
      >
        ← Back to Dashboard
      </button>
    </div>

    <h1>📊 Practice Analytics</h1>
    
    {/* Stats Cards */}
    <div className="stats-grid">
      <div className="stat-card streak">
        <div className="stat-icon">🔥</div>
        <div className="stat-info">
          <div className="stat-value">{analyticsData.streak}</div>
          <div className="stat-label">Day Streak</div>
        </div>
      </div>
      
      <div className="stat-card sessions">
        <div className="stat-icon">📊</div>
        <div className="stat-info">
          <div className="stat-value">{analyticsData.totalSessions}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
      </div>
      
      <div className="stat-card time">
        <div className="stat-icon">⏱️</div>
        <div className="stat-info">
          <div className="stat-value">{analyticsData.totalTime}m</div>
          <div className="stat-label">Practice Time</div>
        </div>
      </div>
      
      <div className="stat-card score">
        <div className="stat-icon">🎯</div>
        <div className="stat-info">
          <div className="stat-value">{analyticsData.averageScore}%</div>
          <div className="stat-label">Avg Score</div>
        </div>
      </div>
    </div>

    {/* Charts Container - Side by Side */}
    <div className="charts-container">
      {/* Practice Frequency Chart */}
      {analyticsData.practiceFrequency.length > 0 && (
        <div className="chart-card">
          <h2>📈 Practice Frequency</h2>
          <p className="chart-subtitle">Last 30 Days</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analyticsData.practiceFrequency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="date" 
                stroke="#666"
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{
                  background: 'white',
                  border: '2px solid #667eea',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sessions" 
                stroke="#667eea" 
                strokeWidth={3}
                dot={{ fill: '#667eea', r: 5 }}
                activeDot={{ r: 8 }}
                name="Practice Sessions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Practice by Skill Chart */}
      {analyticsData.practiceBySkill.length > 0 && (
        <div className="chart-card">
          <h2>🎯 Practice by Skill</h2>
          <p className="chart-subtitle">Sessions & Average Scores</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analyticsData.practiceBySkill}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="skillName" 
                stroke="#666"
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{
                  background: 'white',
                  border: '2px solid #764ba2',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar 
                dataKey="sessions" 
                fill="#667eea" 
                name="Sessions"
                radius={[8, 8, 0, 0]}
              />
              <Bar 
                dataKey="avgScore" 
                fill="#764ba2" 
                name="Avg Score"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  </div>
);
}

export default Analytics;