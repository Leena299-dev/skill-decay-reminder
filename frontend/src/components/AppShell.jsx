import { useState, useEffect, useCallback } from 'react';
import SkillsDashboard from '../pages/SkillsDashboard';
import Analytics from '../pages/Analytics';
import Welcome from '../pages/Welcome';
import Settings from '../pages/Settings';
import NotificationCentre from './NotificationCentre';
import { getNotifications } from '../services/api';
import './AppShell.css';

const NAV_ITEMS = [
  { id: 'welcome',    icon: '🏠', label: 'Welcome'   },
  { id: 'dashboard',  icon: '🎯', label: 'Dashboard'  },
  { id: 'analytics',  icon: '📊', label: 'Analytics'  },
  { id: 'settings',   icon: '⚙️', label: 'Settings'   },
];

function AppShell({ userId, userName, onLogout, defaultPage = 'welcome' }) {
  const [currentPage, setCurrentPage] = useState(defaultPage);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // When set, SkillsDashboard will auto-open practice for this skillId
  const [pendingPracticeSkillId, setPendingPracticeSkillId] = useState(null);

  // Poll unread count every 60 s (and on mount)
  const refreshUnread = useCallback(async () => {
    try {
      const data = await getNotifications(userId, 20);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silently ignore — badge stays at last value
    }
  }, [userId]);

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 60_000);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  // When panel closes, refresh the count so badge is accurate
  const handleClosePanel = () => {
    setPanelOpen(false);
    refreshUnread();
  };

  // Called by NotificationCentre "Practice Now" button
  const handlePracticeSkill = (skillId) => {
    setPendingPracticeSkillId(skillId);
    setCurrentPage('dashboard');
  };

  const renderPage = () => {
    if (currentPage === 'analytics') return <Analytics userId={userId} />;
    if (currentPage === 'welcome')   return <Welcome userName={userName} onNavigate={setCurrentPage} />;
    if (currentPage === 'settings')  return <Settings userId={userId} />;
    return (
      <SkillsDashboard
        userId={userId}
        onNavigate={setCurrentPage}
        autoOpenPracticeSkillId={pendingPracticeSkillId}
        onPracticeSkillOpened={() => setPendingPracticeSkillId(null)}
      />
    );
  };

  const avatarLetter = userName ? userName[0].toUpperCase() : 'U';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">SharpEdge</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item${currentPage === item.id ? ' active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{avatarLetter}</div>
            <div className="user-info">
              <span className="user-name">{userName || 'My Account'}</span>
              <span className="user-role">Learner</span>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <span className="logout-icon">⏻</span>
            <span className="logout-label">Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        {/* Top bar with bell */}
        <div className="top-bar">
          <div className="top-bar-spacer" />
          <button
            className="bell-btn"
            onClick={() => setPanelOpen(prev => !prev)}
            aria-label="Notifications"
            aria-expanded={panelOpen}
          >
            🔔
            {unreadCount > 0 && (
              <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
        </div>

        <main className="main-content">
          {renderPage()}
        </main>
      </div>

      <NotificationCentre
        userId={userId}
        isOpen={panelOpen}
        onClose={handleClosePanel}
        onNavigate={setCurrentPage}
        onPracticeSkill={handlePracticeSkill}
      />
    </div>
  );
}

export default AppShell;
