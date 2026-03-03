import React, { useState } from 'react';
import { signIn, registerUser } from '../services/api';
import './UserRegistration.css';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo'
];

const validateEmail = (email) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

const UserRegistration = ({ onSuccess }) => {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clearForm = (newMode) => {
    setMode(newMode);
    setEmail('');
    setName('');
    setTimezone('UTC');
    setError('');
  };

  const handleInputChange = (setter) => (e) => {
    setError('');
    setter(e.target.value);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError('Invalid email format');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await signIn(email);
      onSuccess(response.userId, response.name || '');
    } catch (err) {
      if (err.error) setError(err.error);
      else if (typeof err === 'string') setError(err);
      else setError('Sign in failed. Please check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError('Invalid email format');
      return;
    }
    if (name.length < 2 || name.length > 100) {
      setError('Name must be 2–100 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await registerUser(email, name, timezone);
      onSuccess(response.userId, name);
    } catch (err) {
      if (err.error) setError(err.error);
      else if (typeof err === 'string') setError(err);
      else setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-icon">⚡</span>
          <span className="auth-brand-name">SharpEdge</span>
        </div>
        <p className="auth-tagline">Track and maintain your technical skills</p>

        {/* Tab toggle */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === 'signin' ? ' active' : ''}`}
            onClick={() => clearForm('signin')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => clearForm('register')}
            type="button"
          >
            Register
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {mode === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <div className="auth-form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={handleInputChange(setEmail)}
                placeholder="your.email@example.com"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? <><span className="auth-spinner" /> Signing in...</> : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="auth-form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={handleInputChange(setEmail)}
                placeholder="your.email@example.com"
                required
                disabled={loading}
              />
            </div>
            <div className="auth-form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={handleInputChange(setName)}
                placeholder="Your full name"
                required
                minLength={2}
                maxLength={100}
                disabled={loading}
              />
            </div>
            <div className="auth-form-group">
              <label>Timezone</label>
              <select
                value={timezone}
                onChange={handleInputChange(setTimezone)}
                disabled={loading}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? <><span className="auth-spinner" /> Creating account...</> : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default UserRegistration;
