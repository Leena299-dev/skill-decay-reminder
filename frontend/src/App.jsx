import { useState } from 'react';
import UserRegistration from './pages/UserRegistration';
import AppShell from './components/AppShell';
import './App.css';

function App() {
  const [userId, setUserId] = useState('b77195e1-4a68-47da-9621-e4d21f049b19');

  return (
    <div className="App">
      {!userId ? (
        <UserRegistration onSuccess={setUserId} />
      ) : (
        <AppShell userId={userId} />
      )}
    </div>
  );
}

export default App;