import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './Analytics.css';
import StreakBadge from '../components/StreakBadge';
import PracticeHeatmap from '../components/PracticeHeatmap';
import { getAnalytics, getSkills, getProgressAnalysis } from '../services/api';

const INTERVALS = [1, 3, 7, 14, 30, 60];

function getDaysSincePractice(skill) {
  if ((skill.totalPracticeCount ?? 0) === 0) return null;
  const idx = Math.min(skill.currentIntervalIndex ?? 0, INTERVALS.length - 1);
  const intervalDays = INTERVALS[idx];
  const nextDate = new Date(skill.nextReminderDate + 'T00:00:00');
  const lastDate = new Date(nextDate);
  lastDate.setDate(lastDate.getDate() - intervalDays);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - lastDate) / 86400000));
}

function getDecayRisk(days) {
  if (days === null) return { level: 'none', label: 'Never practised', color: '#9ca3af', pct: 0 };
  if (days <= 3)  return { level: 'low',      label: 'Low Risk',  color: '#4caf50', pct: Math.max(4, Math.round(days / 3 * 30)) };
  if (days <= 7)  return { level: 'medium',   label: 'Medium',    color: '#ffc107', pct: Math.round(30 + (days - 3) / 4 * 25) };
  if (days <= 30) return { level: 'high',     label: 'High Risk', color: '#ff7043', pct: Math.round(55 + (days - 7) / 23 * 30) };
  return               { level: 'critical', label: 'Critical',  color: '#f44336', pct: Math.min(100, Math.round(85 + (days - 30) / 30 * 15)) };
}

function formatTime(totalSeconds) {
  if (!totalSeconds) return '—';
  const mins = Math.round(totalSeconds / 60);
  if (mins === 0) return '< 1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function healthLabel(status) {
  const map = { excellent: 'Excellent', good: 'Good', 'at-risk': 'At Risk', critical: 'Critical', new: 'New' };
  return map[status] || status;
}

function formatLastUpdated(isoString) {
  if (!isoString) return 'unknown';
  try {
    const date = new Date(isoString);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1)  return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return 'recently';
  }
}

function trendIcon(trend) {
  return { improving: '📈', stable: '➡️', declining: '📉', new: '✨' }[trend] || '➡️';
}

function trendLabel(trend) {
  return { improving: 'Improving', stable: 'Stable', declining: 'Needs Attention', new: 'New' }[trend] || trend;
}

function Analytics({ userId }) {
  const [analytics, setAnalytics] = useState({
    streak: 0, totalSessions: 0, totalTime: 0, averageScore: 0,
    practiceFrequency: [], practiceBySkill: [],
    aiSessions: 0, selfMarkSessions: 0, avgAIScore: 0, avgSelfMarkScore: 0,
  });
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  // AI insights state
  const [aiAnalysis, setAiAnalysis]           = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError]     = useState(false);
  const [expandedInsights, setExpandedInsights] = useState({});

  const parseAnalysisResult = (raw) => {
    console.log('=== PROGRESS ANALYSIS RAW ===');
    console.log(JSON.stringify(raw, null, 2));

    if (!raw) return null;

    // Shape B: body is a nested JSON string
    if (typeof raw.body === 'string') {
      try {
        const parsed = JSON.parse(raw.body);
        console.log('Parsed from body string:', parsed);
        return parsed;
      } catch (e) {
        console.error('Failed to parse body string:', e);
      }
    }

    // Shape B: body is already an object
    if (raw.body && typeof raw.body === 'object') {
      return raw.body;
    }

    // Shape A: response IS the data directly
    if (raw.overallInsight) {
      console.log('Direct shape detected');
      return raw;
    }

    // Unknown shape
    console.error('Unknown response shape:', JSON.stringify(raw));
    return null;
  };

  const handleAnalysisResponse = (raw) => {
    const result = parseAnalysisResult(raw);
    console.log('Final result:', result);
    console.log('Has overallInsight:', !!result?.overallInsight);

    if (result && result.overallInsight) {
      setAiAnalysis(result);
      setAnalysisError(false);
    } else if (result && result.error === true) {
      console.error('Lambda error:', result.message);
      setAnalysisError(true);
    } else {
      console.error('No usable data in result:', result);
      setAnalysisError(true);
    }
  };

  const loadAnalysis = (forceRefresh = false) => {
    setAnalysisLoading(true);
    setAnalysisError(false);
    getProgressAnalysis({ userId, requestType: 'full_analysis', forceRefresh })
      .then(handleAnalysisResponse)
      .catch(() => setAnalysisError(true))
      .finally(() => setAnalysisLoading(false));
  };

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      setAnalysisLoading(true);
      setAnalysisError(false);
      try {
        const [analyticsResult, skillsResult] = await Promise.all([
          getAnalytics(userId),
          getSkills(userId),
        ]);
        setAnalytics(analyticsResult);
        setSkills(skillsResult.skills || []);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
      // Load AI analysis independently so main content isn't blocked
      getProgressAnalysis({ userId, requestType: 'full_analysis' })
        .then(handleAnalysisResponse)
        .catch(() => setAnalysisError(true))
        .finally(() => setAnalysisLoading(false));
    };
    load();
  }, [userId]);

  const earnedBadges = {
    '7-day':        analytics.streak >= 7,
    '30-day':       analytics.streak >= 30,
    '100-day':      analytics.streak >= 100,
    'perfect-week': analytics.streak >= 7 && analytics.totalSessions >= 7,
  };
  const anyBadgeEarned = Object.values(earnedBadges).some(Boolean);

  // Skill health: worst first
  const skillsByHealth = [...skills].sort((a, b) => {
    const aNew = (a.totalPracticeCount ?? 0) === 0;
    const bNew = (b.totalPracticeCount ?? 0) === 0;
    if (aNew && !bNew) return 1;
    if (!aNew && bNew) return -1;
    return (a.health || 0) - (b.health || 0);
  });

  // Forgetting curve: most at-risk first, never-practised at end
  const skillsForRisk = [...skills].sort((a, b) => {
    const dA = getDaysSincePractice(a);
    const dB = getDaysSincePractice(b);
    if (dA === null && dB === null) return 0;
    if (dA === null) return 1;
    if (dB === null) return -1;
    return dB - dA;
  });

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="an-loading">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="an-page-header">
        <h1>📊 Analytics</h1>
      </div>

      {/* ── Section 0: AI Learning Insights ───────────────────────────────── */}
      <div className="an-card an-card--full an-ai-insights-card">
        <div className="an-insights-header">
          <h2 className="an-card-title">🤖 Your AI Learning Insights</h2>
          <button
            className="an-refresh-btn"
            onClick={() => loadAnalysis(true)}
            disabled={analysisLoading}
          >
            {analysisLoading ? '...' : '↻ Refresh'}
          </button>
        </div>

        {analysisLoading && (
          <div className="an-insights-loading">
            <div className="an-insights-pulse" />
            <div className="an-insights-pulse an-insights-pulse--sm" />
            <p className="an-insights-loading-text">Generating your personalised insights...</p>
          </div>
        )}

        {!analysisLoading && analysisError && (
          <p className="an-insights-error">
            Could not generate insights. Make sure you have practice sessions recorded, then try Refresh.
          </p>
        )}

        {!analysisLoading && aiAnalysis && (
          <>
            <p className="an-overall-insight">{aiAnalysis.overallInsight}</p>

            {/* Spotlight row */}
            <div className="an-spotlight-row">
              {aiAnalysis.focusSkill?.name && (
                <div className="an-spotlight-card an-spotlight-focus">
                  <span className="an-spotlight-icon">🎯</span>
                  <span className="an-spotlight-type">Focus</span>
                  <span className="an-spotlight-skill">{aiAnalysis.focusSkill.name}</span>
                  <span className="an-spotlight-reason">{aiAnalysis.focusSkill.reason}</span>
                </div>
              )}
              {aiAnalysis.momentumSkill?.name && (
                <div className="an-spotlight-card an-spotlight-momentum">
                  <span className="an-spotlight-icon">🚀</span>
                  <span className="an-spotlight-type">Momentum</span>
                  <span className="an-spotlight-skill">{aiAnalysis.momentumSkill.name}</span>
                  <span className="an-spotlight-reason">{aiAnalysis.momentumSkill.reason}</span>
                </div>
              )}
              {aiAnalysis.strengthSkill?.name && (
                <div className="an-spotlight-card an-spotlight-strength">
                  <span className="an-spotlight-icon">⭐</span>
                  <span className="an-spotlight-type">Strength</span>
                  <span className="an-spotlight-skill">{aiAnalysis.strengthSkill.name}</span>
                  <span className="an-spotlight-reason">{aiAnalysis.strengthSkill.reason}</span>
                </div>
              )}
            </div>

            {/* Weekly recommendation */}
            {aiAnalysis.weeklyRecommendation && (
              <div className="an-weekly-rec">
                📋 <strong>This week:</strong> {aiAnalysis.weeklyRecommendation}
              </div>
            )}

            {/* Per-skill insights — expandable rows */}
            {aiAnalysis.skillInsights?.length > 0 && (
              <div className="an-skill-insights-list">
                {aiAnalysis.skillInsights.map(si => (
                  <div key={si.skillName} className={`an-skill-insight trend-${si.trend}`}>
                    <button
                      className="an-skill-insight-toggle"
                      onClick={() => setExpandedInsights(prev => ({
                        ...prev,
                        [si.skillName]: !prev[si.skillName],
                      }))}
                    >
                      <span className="an-si-chevron">
                        {expandedInsights[si.skillName] ? '▼' : '▶'}
                      </span>
                      <span className="an-si-name">{si.skillName}</span>
                      <span className="an-si-trend-badge">
                        {trendIcon(si.trend)} {trendLabel(si.trend)}
                      </span>
                    </button>
                    {expandedInsights[si.skillName] && (
                      <div className="an-skill-insight-body">
                        <p className="an-si-insight">"{si.insight}"</p>
                        <p className="an-si-action">→ {si.action}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="an-insights-footer">
              {aiAnalysis.fromCache ? 'Cached · ' : ''}
              Last updated: {formatLastUpdated(aiAnalysis.generatedAt)}
            </div>
          </>
        )}
      </div>

      {/* ── Section 1: Learning Snapshot ─────────────────────────────────── */}
      <div className="an-stats-row">
        <div className="an-stat-card">
          <div className="an-stat-icon">🔥</div>
          <div className="an-stat-value">{analytics.streak}</div>
          <div className="an-stat-label">Day Streak</div>
        </div>
        <div className="an-stat-card">
          <div className="an-stat-icon">📊</div>
          <div className="an-stat-value">{analytics.totalSessions}</div>
          <div className="an-stat-label">Total Sessions</div>
        </div>
        <div className="an-stat-card">
          <div className="an-stat-icon">🎯</div>
          <div className="an-stat-value">{analytics.averageScore}%</div>
          <div className="an-stat-label">Average Score</div>
        </div>
        <div className="an-stat-card">
          <div className="an-stat-icon">⏱</div>
          <div className="an-stat-value">{formatTime(analytics.totalTime)}</div>
          <div className="an-stat-label">Time Spent</div>
        </div>
      </div>

      {/* ── Sections 2 + 3: Left col (health + risk) | Right col (heatmap) ── */}
      <div className="an-two-col an-two-col--stretch">

        {/* Left column: Health Overview stacked above Forgetting Curve Risk */}
        <div className="an-left-col">
          <div className="an-card">
            <h2 className="an-card-title">Skill Health Overview</h2>
            <p className="an-card-subtitle">Sorted by lowest health first</p>
            {skillsByHealth.length === 0 ? (
              <p className="an-empty">No skills added yet.</p>
            ) : (
              <div className="an-health-list">
                {skillsByHealth.map(skill => {
                  const isNew = (skill.totalPracticeCount ?? 0) === 0;
                  const h = isNew ? 0 : (skill.health || 0);
                  const st = isNew ? 'new' : (skill.healthStatus || 'critical');
                  return (
                    <div key={skill.skillId} className="an-health-row">
                      <div className="an-health-name" title={skill.skillName}>{skill.skillName}</div>
                      <div className="an-health-bar-wrap">
                        <div className="an-health-bar-track">
                          <div className={`an-health-bar-fill status-${st}`} style={{ width: `${h}%` }} />
                        </div>
                        <span className="an-health-pct">{h}%</span>
                      </div>
                      <span className={`an-health-badge status-${st}`}>{healthLabel(st)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="an-card">
            <h2 className="an-card-title">Forgetting Curve Risk</h2>
            <p className="an-card-subtitle">How much is your knowledge at risk right now?</p>
            {skillsForRisk.length === 0 ? (
              <p className="an-empty">Add skills to see decay risk.</p>
            ) : (
              <div className="an-risk-list">
                {skillsForRisk.map(skill => {
                  const days = getDaysSincePractice(skill);
                  const risk = getDecayRisk(days);
                  return (
                    <div key={skill.skillId} className="an-risk-row">
                      <div className="an-risk-name" title={skill.skillName}>{skill.skillName}</div>
                      <div className="an-risk-days">
                        {days === null
                          ? 'Never practised'
                          : `${days} day${days !== 1 ? 's' : ''} ago`}
                      </div>
                      <div className="an-risk-bar-track">
                        <div
                          className="an-risk-bar-fill"
                          style={{ width: `${risk.pct}%`, background: risk.color }}
                        />
                      </div>
                      <span className="an-risk-label" style={{ color: risk.color }}>
                        {risk.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Heatmap stretches to match the full left column height */}
        <div className="an-heatmap-col">
          <PracticeHeatmap practiceData={analytics.practiceFrequency} />
        </div>
      </div>

      {/* ── Section 4: Charts ─────────────────────────────────────────────── */}
      <div className="an-two-col">
        <div className="an-card">
          <h2 className="an-card-title">🎯 Practice by Skill</h2>
          <p className="an-card-subtitle">Sessions &amp; average scores per skill</p>
          {analytics.practiceBySkill.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.practiceBySkill} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="skillName" stroke="#666" tick={{ fontSize: 11 }} />
                <YAxis stroke="#666" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'white', border: '2px solid #764ba2', borderRadius: '8px', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sessions"  fill="#667eea" name="Sessions"   radius={[6, 6, 0, 0]} />
                <Bar dataKey="avgScore"  fill="#764ba2" name="Avg Score %" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="an-empty">No practice sessions recorded yet.</p>
          )}
        </div>

        <div className="an-card">
          <h2 className="an-card-title">📈 Practice Frequency</h2>
          <p className="an-card-subtitle">Last 30 days</p>
          {analytics.practiceFrequency.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analytics.practiceFrequency} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} />
                <YAxis stroke="#666" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'white', border: '2px solid #667eea', borderRadius: '8px', fontSize: 12 }} />
                <Line
                  type="monotone" dataKey="sessions" stroke="#667eea"
                  strokeWidth={3} dot={{ fill: '#667eea', r: 4 }} activeDot={{ r: 7 }}
                  name="Sessions"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="an-empty">Practice sessions will appear here.</p>
          )}
        </div>
      </div>

      {/* ── Section 5: AI Feedback Summary ───────────────────────────────── */}
      {(analytics.aiSessions > 0 || analytics.selfMarkSessions > 0) && (
        <div className="an-card an-card--full">
          <h2 className="an-card-title">🤖 AI Feedback Summary</h2>
          <p className="an-card-subtitle">How you're using AI-powered answer evaluation</p>
          <div className="an-ai-summary">
            <div className="an-ai-stat">
              <div className="an-ai-stat-value">{analytics.aiSessions}</div>
              <div className="an-ai-stat-label">AI-evaluated sessions</div>
              {analytics.avgAIScore > 0 && (
                <div className="an-ai-stat-avg">avg {analytics.avgAIScore}%</div>
              )}
            </div>
            <div className="an-ai-divider" />
            <div className="an-ai-stat">
              <div className="an-ai-stat-value">{analytics.selfMarkSessions}</div>
              <div className="an-ai-stat-label">Self-marked sessions</div>
              {analytics.avgSelfMarkScore > 0 && (
                <div className="an-ai-stat-avg">avg {analytics.avgSelfMarkScore}%</div>
              )}
            </div>
            {analytics.aiSessions > 0 && analytics.selfMarkSessions > 0 && (
              <>
                <div className="an-ai-divider" />
                <div className="an-ai-stat">
                  <div
                    className="an-ai-stat-value"
                    style={{ color: analytics.avgAIScore >= analytics.avgSelfMarkScore ? '#4caf50' : '#ff9800' }}
                  >
                    {analytics.avgAIScore >= analytics.avgSelfMarkScore ? '+' : ''}
                    {Math.round(analytics.avgAIScore - analytics.avgSelfMarkScore)}%
                  </div>
                  <div className="an-ai-stat-label">AI vs self-mark difference</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Section 6: Achievements ───────────────────────────────────────── */}
      <div className="an-card an-card--full">
        <h2 className="an-card-title">🏆 Achievements</h2>
        {anyBadgeEarned ? (
          <div className="an-badges-earned">
            {Object.entries(earnedBadges)
              .filter(([, earned]) => earned)
              .map(([type]) => (
                <StreakBadge key={type} type={type} earned={true} size="large" />
              ))}
          </div>
        ) : (
          <div className="an-badges-empty">
            <p className="an-badges-empty-msg">Complete practice sessions to earn badges</p>
            <div className="an-badges-locked-row">
              {Object.keys(earnedBadges).map(type => (
                <StreakBadge key={type} type={type} earned={false} size="small" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;
