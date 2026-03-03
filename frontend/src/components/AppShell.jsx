import { useState } from 'react';
import SkillsDashboard from '../pages/SkillsDashboard';
import Analytics from '../pages/Analytics';
import Welcome from '../pages/Welcome';
import './AppShell.css';

const NAV_ITEMS = [
  { id: 'welcome',    icon: '🏠', label: 'Welcome'   },
  { id: 'dashboard',  icon: '🎯', label: 'Dashboard'  },
  { id: 'analytics',  icon: '📊', label: 'Analytics'  },
];

function AppShell({ userId, userName, onLogout }) {
  const [currentPage, setCurrentPage] = useState('welcome');

  const renderPage = () => {
    if (currentPage === 'analytics') return <Analytics userId={userId} />;
    if (currentPage === 'welcome')   return <Welcome userName={userName} onNavigate={setCurrentPage} />;
    return <SkillsDashboard userId={userId} onNavigate={setCurrentPage} />;
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

      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default AppShell;
