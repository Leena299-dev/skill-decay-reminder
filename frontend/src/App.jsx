import { useState } from 'react';
import UserRegistration from './pages/UserRegistration';
import SkillsDashboard from './pages/SkillsDashboard';
import './App.css';

function App() {
  const [userId, setUserId] = useState('b77195e1-4a68-47da-9621-e4d21f049b19');

  const handleRegistrationSuccess = (newUserId) => {
    setUserId(newUserId);
  };

  return (
    <div className="App">
      {!userId ? (
        <UserRegistration onSuccess={handleRegistrationSuccess} />
      ) : (
        <SkillsDashboard userId={userId} />
      )}
    </div>
  );
}

export default App;