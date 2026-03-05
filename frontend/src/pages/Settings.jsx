import { useState, useEffect, useRef } from 'react';
import { getNotificationPreferences, updateNotificationPreferences } from '../services/api';
import './Settings.css';

const NOTIFICATION_TYPES = [
  { key: 'practiceReminders',   icon: '🔔', label: 'Practice Reminders',   desc: 'Reminders when a skill is due for practice' },
  { key: 'overdueAlerts',       icon: '⚠️', label: 'Overdue Alerts',        desc: 'Alerts at 3, 7, and 30 days overdue' },
  { key: 'weeklyDigest',        icon: '📊', label: 'Weekly Summary',        desc: 'Sunday digest of your skill health and progress' },
  { key: 'streakAlerts',        icon: '🔥', label: 'Streak Milestones',     desc: 'Celebrate 7, 30, and 100-day streaks' },
  { key: 'scoreAlerts',         icon: '📈', label: 'Score Improvements',    desc: 'Notified when your score jumps significantly' },
  { key: 'inactivityAlerts',    icon: '😴', label: 'Inactivity Warnings',   desc: 'Reminder if you haven\'t practised in 14+ days' },
  { key: 'criticalHealthAlerts',icon: '❤️', label: 'Critical Health Alerts',desc: 'Alert when a skill health drops below 40%' },
];

const DEFAULT_PREFS = {
  emailEnabled: true,
  practiceReminders: true,
  overdueAlerts: true,
  weeklyDigest: true,
  streakAlerts: true,
  scoreAlerts: true,
  inactivityAlerts: true,
  criticalHealthAlerts: true,
  email: '',
  timezone: 'UTC',
};

function SavedBadge({ visible }) {
  return (
    <span className={`settings-saved-badge${visible ? ' settings-saved-badge--visible' : ''}`}>
      Saved ✓
    </span>
  );
}

function Settings({ userId }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState(null);
  const [error, setError] = useState(null);
  const savedTimers = useRef({});

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getNotificationPreferences(userId)
      .then(data => setPrefs(prev => ({ ...prev, ...data })))
      .catch(() => setError('Failed to load preferences.'))
      .finally(() => setLoading(false));
  }, [userId]);

  const showSaved = (key) => {
    clearTimeout(savedTimers.current[key]);
    setSavedKey(key);
    savedTimers.current[key] = setTimeout(() => setSavedKey(null), 2000);
  };

  const handleToggle = async (key) => {
    const newVal = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newVal }));
    setError(null);
    try {
      await updateNotificationPreferences(userId, { [key]: newVal });
      showSaved(key);
    } catch {
      // Revert on failure
      setPrefs(prev => ({ ...prev, [key]: !newVal }));
      setError('Failed to save. Please try again.');
    }
  };

  const masterOff = !(prefs.emailEnabled ?? true);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">Changes save automatically</p>
      </div>

      {/* Account section */}
      <div className="settings-card">
        <h2 className="settings-section-title">Account</h2>
        <div className="settings-info-row">
          <span className="settings-info-label">User ID</span>
          <span className="settings-info-value settings-info-value--mono">{userId}</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-label">Email</span>
          <span className="settings-info-value">{prefs.email || '—'}</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-label">Timezone</span>
          <span className="settings-info-value">{prefs.timezone || 'UTC'}</span>
        </div>
      </div>

      {error && <p className="settings-error">{error}</p>}

      {/* Email notifications */}
      <div className="settings-card">
        <h2 className="settings-section-title">
          Email Notifications
          <span className="settings-section-subtitle">Choose which emails you want to receive</span>
        </h2>

        {loading ? (
          <p className="settings-loading">Loading preferences…</p>
        ) : (<>

        {/* Master toggle */}
        <div className="toggle-row toggle-row--master">
          <div className="toggle-label-group">
            <span className="toggle-icon">📧</span>
            <div>
              <span className="toggle-label">All Email Notifications</span>
              <span className="toggle-description">Master switch — turns all emails on or off</span>
            </div>
          </div>
          <div className="toggle-right">
            <SavedBadge visible={savedKey === 'emailEnabled'} />
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={prefs.emailEnabled ?? true}
                onChange={() => handleToggle('emailEnabled')}
              />
              <span className="toggle-track" />
            </label>
          </div>
        </div>

        {/* Individual toggles */}
        <div className={`toggle-group${masterOff ? ' toggle-group--disabled' : ''}`}>
          {NOTIFICATION_TYPES.map(({ key, icon, label, desc }) => (
            <div key={key} className="toggle-row">
              <div className="toggle-label-group">
                <span className="toggle-icon">{icon}</span>
                <div>
                  <span className="toggle-label">{label}</span>
                  <span className="toggle-description">{desc}</span>
                </div>
              </div>
              <div className="toggle-right">
                <SavedBadge visible={savedKey === key} />
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={!!prefs[key] && !masterOff}
                    disabled={masterOff}
                    onChange={() => handleToggle(key)}
                  />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
          ))}
        </div>

        </>)}
      </div>
    </div>
  );
}

export default Settings;
