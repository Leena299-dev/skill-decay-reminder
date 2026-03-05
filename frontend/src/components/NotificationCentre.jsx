import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../services/api';
import './NotificationCentre.css';

const QUICK_TOGGLES = [
  { key: 'practiceReminders',    icon: '🔔', label: 'Practice Reminders' },
  { key: 'overdueAlerts',        icon: '⚠️', label: 'Overdue Alerts' },
  { key: 'weeklyDigest',         icon: '📊', label: 'Weekly Summary' },
  { key: 'streakAlerts',         icon: '🔥', label: 'Streak Milestones' },
  { key: 'scoreAlerts',          icon: '📈', label: 'Score Improvements' },
  { key: 'inactivityAlerts',     icon: '😴', label: 'Inactivity Warnings' },
  { key: 'criticalHealthAlerts', icon: '❤️', label: 'Critical Health Alerts' },
];

function NotificationCentre({ userId, isOpen, onClose, onNavigate, onPracticeSkill }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState(null);

  const loadData = useCallback(async () => {
    if (!userId || !isOpen) return;
    setLoading(true);
    try {
      const [notifData, prefData] = await Promise.all([
        getNotifications(userId, 20),
        getNotificationPreferences(userId),
      ]);
      setNotifications(notifData.notifications || []);
      setUnreadCount(notifData.unreadCount || 0);
      setPrefs(prefData);
    } catch {
      // silently fail — panel still renders
    } finally {
      setLoading(false);
    }
  }, [userId, isOpen]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(userId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markNotificationsRead(userId, [notif.notificationKey]);
        setNotifications(prev =>
          prev.map(n => n.notificationKey === notif.notificationKey ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }
  };

  const handlePracticeNow = (notif) => {
    handleNotificationClick(notif);
    onClose();
    if (notif.skillId) {
      onPracticeSkill(notif.skillId);
    }
    onNavigate('dashboard');
  };

  const handleTogglePref = async (key) => {
    if (!prefs || savingKey) return;
    const newVal = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newVal }));
    setSavingKey(key);
    try {
      await updateNotificationPreferences(userId, { [key]: newVal });
    } catch {
      setPrefs(prev => ({ ...prev, [key]: !newVal }));
    } finally {
      setSavingKey(null);
    }
  };

  const masterOff = prefs ? !prefs.emailEnabled : false;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`nc-backdrop${isOpen ? ' nc-backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`nc-panel${isOpen ? ' nc-panel--open' : ''}`}
        role="dialog"
        aria-label="Notification Centre"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="nc-header">
          <h2 className="nc-title">Notification Centre</h2>
          <div className="nc-header-actions">
            {unreadCount > 0 && (
              <button className="nc-mark-all-btn" onClick={handleMarkAllRead}>
                Mark all as read
              </button>
            )}
            <button className="nc-close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="nc-body">
          {/* ── Recent Alerts ───────────────────────────────────── */}
          <section className="nc-section">
            <h3 className="nc-section-title">Recent Alerts</h3>

            {loading && (
              <p className="nc-empty">Loading…</p>
            )}

            {!loading && notifications.length === 0 && (
              <div className="nc-empty-state">
                <span className="nc-empty-icon">🔔</span>
                <p>No notifications yet. Complete your first practice session to get started!</p>
              </div>
            )}

            {!loading && notifications.map(notif => (
              <div
                key={notif.notificationKey}
                className={`nc-card${notif.isRead ? ' nc-card--read' : ' nc-card--unread'}`}
                onClick={() => handleNotificationClick(notif)}
              >
                <span className="nc-card-icon">{notif.icon}</span>
                <div className="nc-card-body">
                  <div className="nc-card-top">
                    <span className="nc-card-title">{notif.title}</span>
                    <span className="nc-card-time">{notif.timeAgo}</span>
                  </div>
                  <p className="nc-card-desc">{notif.description}</p>
                  {notif.skillId && (
                    <button
                      className="nc-practice-btn"
                      onClick={(e) => { e.stopPropagation(); handlePracticeNow(notif); }}
                    >
                      Practice Now →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* ── Quick Settings ──────────────────────────────────── */}
          <section className="nc-section">
            <h3 className="nc-section-title">Notification Settings</h3>

            {prefs ? (
              <div className="nc-toggles">
                {QUICK_TOGGLES.map(({ key, icon, label }) => (
                  <div key={key} className="nc-toggle-row">
                    <span className="nc-toggle-label">
                      <span className="nc-toggle-icon">{icon}</span>
                      {label}
                    </span>
                    <label className={`nc-toggle-switch${masterOff ? ' nc-toggle-switch--disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!!prefs[key] && !masterOff}
                        disabled={masterOff || savingKey === key}
                        onChange={() => handleTogglePref(key)}
                      />
                      <span className="nc-toggle-track" />
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="nc-empty">Loading settings…</p>
            )}

            <button
              className="nc-full-settings-link"
              onClick={() => { onClose(); onNavigate('settings'); }}
            >
              Full Settings →
            </button>
          </section>
        </div>
      </div>
    </>
  );
}

export default NotificationCentre;
