import { useState } from 'react';
import LoginScreen from './pages/LoginScreen';
import WelcomeScreen from './pages/WelcomeScreen';
import AppShell from './components/AppShell';
import './App.css';

function App() {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [defaultPage, setDefaultPage] = useState('welcome');

  const handleFound = (id, name) => {
    setUserId(id);
    setUserName(name);
    setDefaultPage('dashboard');
  };

  const handleNotFound = (email) => {
    setUserEmail(email);
    setIsNewUser(true);
  };

  // Registration succeeded — stay on WelcomeScreen so the user can add skills
  const handleRegistered = (id, name) => {
    setUserId(id);
    setUserName(name);
    // isNewUser intentionally left true — WelcomeScreen stays visible
  };

  // User clicked "Go to My Dashboard" after adding skills
  const handleReadyForDashboard = () => {
    setIsNewUser(false);
  };

  const handleBackToLogin = () => {
    setIsNewUser(false);
    setUserEmail('');
    setUserId(null);
    setUserName('');
  };

  const handleLogout = () => {
    setUserId(null);
    setUserName('');
    setIsNewUser(false);
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
