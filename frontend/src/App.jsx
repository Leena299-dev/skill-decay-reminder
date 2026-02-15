import { useState } from 'react';
import UserRegistration from './pages/UserRegistration';
import SkillsDashboard from './pages/SkillsDashboard';
import './App.css';

function App() {
  const [userId, setUserId] = useState(null);

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