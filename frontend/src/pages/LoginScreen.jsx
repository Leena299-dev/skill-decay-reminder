import { useState } from 'react';
import { signIn } from '../services/api';
import './LoginScreen.css';

function LoginScreen({ onFound, onNotFound }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await signIn(email.trim());
      onFound(data.userId, data.name);
    } catch (err) {
      const status = err?.statusCode || err?.status;
      if (status === 404 || err === 'User not found') {
        onNotFound(email.trim());
      } else {
        setError(err?.error || err?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-icon">⚡</span>
          <span className="login-brand-name">SharpEdge</span>
        </div>
        <p className="login-tagline">
          Keep your skills sharp. Never forget what you worked hard to learn.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            className="login-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="login-error">{error}</p>}
          <button
            className="login-btn"
            type="submit"
            disabled={loading || !email.trim()}
          >
            {loading ? 'Checking…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;
