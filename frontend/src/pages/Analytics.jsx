import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Analytics.css';
import StreakBadge from '../components/StreakBadge';
import TrendIndicator from '../components/TrendIndicator';
import PracticeHeatmap from '../components/PracticeHeatmap';
import { getAnalytics } from '../services/api';

function Analytics({ userId, onBack }) {
  const [analyticsData, setAnalyticsData] = useState({
    streak: 0,
    totalSessions: 0,
    totalTime: 0,
    averageScore: 0,
    practiceFrequency: [],
    practiceBySkill: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAnalytics(userId);
        setAnalyticsData(data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchAnalytics();
    }
  }, [userId]);

  const calculateBadges = () => ({
    '7-day': analyticsData.streak >= 7,
    '30-day': analyticsData.streak >= 30,
    '100-day': analyticsData.streak >= 100,
    'perfect-week': analyticsData.streak >= 7 && analyticsData.totalSessions >= 7
  });

  const earnedBadges = calculateBadges();

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">

      <h1>📊 Practice Analytics</h1>

      {/* ROW 1: Achievements + Heatmap side by side */}
      <div className="achievements-activity-container">

        {/* Achievements */}
        <div className="achievements-section">
          <h2>🏆 Achievements</h2>
          <div className="badges-grid">
            <StreakBadge type="7-day"       earned={earnedBadges['7-day']}       size="large" />
            <StreakBadge type="30-day"      earned={earnedBadges['30-day']}      size="large" />
            <StreakBadge type="100-day"     earned={earnedBadges['100-day']}     size="large" />
            <StreakBadge type="perfect-week" earned={earnedBadges['perfect-week']} size="large" />
          </div>
        </div>

        {/* Practice Activity Heatmap */}
        <div className="activity-section">
          <PracticeHeatmap practiceData={analyticsData.practiceFrequency} />
        </div>

      </div>

      {/* ROW 2: Proficiency Trends */}
      <div className="trends-section">
        <h2>📈 Proficiency Trends</h2>
        <div className="trends-grid">
          {analyticsData.practiceBySkill.map(skill => (
            <div key={skill.skillName} className="trend-card">
              <div className="trend-card-header">
                <span className="trend-skill-name">{skill.skillName}</span>
                <TrendIndicator
                  trend={skill.avgScore >= 80 ? 'improving' : skill.avgScore >= 60 ? 'stable' : 'declining'}
                  change={skill.avgScore >= 80 ? '+5' : skill.avgScore >= 60 ? '0' : '-3'}
                  size="large"
                />
              </div>
              <div className="trend-stats">
                <div className="trend-stat">
                  <span className="trend-stat-label">Avg Score</span>
                  <span className="trend-stat-value">{skill.avgScore}%</span>
                </div>
                <div className="trend-stat">
                  <span className="trend-stat-label">Sessions</span>
                  <span className="trend-stat-value">{skill.sessions}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROW 3: Charts side by side */}
      <div className="charts-container">

        {/* Practice by Skill Bar Chart */}
        {analyticsData.practiceBySkill.length > 0 && (
          <div className="chart-card">
            <h2>🎯 Practice by Skill</h2>
            <p className="chart-subtitle">Sessions & Average Scores</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analyticsData.practiceBySkill}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="skillName" stroke="#666" tick={{ fontSize: 12 }} />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={{ background: 'white', border: '2px solid #764ba2', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="sessions" fill="#667eea" name="Sessions"  radius={[8, 8, 0, 0]} />
                <Bar dataKey="avgScore" fill="#764ba2" name="Avg Score" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Practice Frequency Line Chart */}
        {analyticsData.practiceFrequency.length > 0 && (
          <div className="chart-card">
            <h2>📈 Practice Frequency</h2>
            <p className="chart-subtitle">Last 30 Days</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analyticsData.practiceFrequency}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 11 }} />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={{ background: 'white', border: '2px solid #667eea', borderRadius: '8px' }} />
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

      </div>
    </div>
  );
}

export default Analytics;
