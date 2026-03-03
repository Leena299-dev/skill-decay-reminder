import { useState } from 'react';
import UserRegistration from './pages/UserRegistration';
import AppShell from './components/AppShell';
import './App.css';

function App() {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');

  const handleAuthSuccess = (id, name = '') => {
    setUserId(id);
    setUserName(name);
  };

  const handleLogout = () => {
    setUserId(null);
    setUserName('');
  };

  return (
    <div className="App">
      {!userId ? (
        <UserRegistration onSuccess={handleAuthSuccess} />
      ) : (
        <AppShell userId={userId} userName={userName} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;