import { useState } from 'react';
import UserRegistration from './pages/UserRegistration';
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
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxWidth: '500px'
          }}>
            <h2>Registration Complete! 🎉</h2>
            <p>Your User ID: <code>{userId}</code></p>
            <p style={{ marginTop: '20px', color: '#666' }}>
              Skills Dashboard coming soon! For now, you can use the API directly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;