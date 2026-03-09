import { useState } from 'react';
import LoginScreen from './pages/LoginScreen';
import WelcomeScreen from './pages/WelcomeScreen';
import AppShell from './components/AppShell';
import { updateUser } from './services/api';
import './App.css';

function App() {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);       // routing: show WelcomeScreen
  const [isFirstRegistration, setIsFirstRegistration] = useState(false); // greeting: "Welcome!" vs "Welcome back!"
  const [userEmail, setUserEmail] = useState('');
  const [defaultPage, setDefaultPage] = useState('welcome');

  // Existing user signed in → always go straight to dashboard.
  // WelcomeScreen is never shown to returning users regardless of the DB flag.
  const handleFound = (id, name) => {
    setUserId(id);
    setUserName(name);
    setDefaultPage('dashboard');
  };

  // Email not found → show registration form (genuinely new user)
  const handleNotFound = (email) => {
    setUserEmail(email);
    setIsNewUser(true);
    setIsFirstRegistration(true); // brand new → "Welcome!"
  };

  // Registration succeeded — stay on WelcomeScreen so the user can add skills
  const handleRegistered = (id, name) => {
    setUserId(id);
    setUserName(name);
    // isNewUser intentionally left true — WelcomeScreen stays visible
  };

  // User clicked "Go to My Dashboard" after adding skills — clear the DB flag
  const handleReadyForDashboard = () => {
    setIsNewUser(false);
    setIsFirstRegistration(false);
    if (userId) {
      updateUser(userId, { isNewUser: false }).catch(() => {
        // Non-fatal: flag will be cleared next time
      });
    }
  };

  const handleBackToLogin = () => {
    setIsNewUser(false);
    setIsFirstRegistration(false);
    setUserEmail('');
    setUserId(null);
    setUserName('');
  };

  const handleLogout = () => {
    setUserId(null);
    setUserName('');
    setIsNewUser(false);
    setIsFirstRegistration(false);
    setUserEmail('');
    setDefaultPage('welcome');
  };

  return (
    <div className="App">
      {!isNewUser && !userId && (
        <LoginScreen onFound={handleFound} onNotFound={handleNotFound} />
      )}
      {isNewUser && (
        <WelcomeScreen
          email={userEmail}
          userId={userId}
          userName={userName}
          isNewUser={isFirstRegistration}
          onRegistered={handleRegistered}
          onReady={handleReadyForDashboard}
          onBack={handleBackToLogin}
        />
      )}
      {!isNewUser && userId && (
        <AppShell userId={userId} userName={userName} onLogout={handleLogout} defaultPage={defaultPage} />
      )}
    </div>
  );
}

export default App;
