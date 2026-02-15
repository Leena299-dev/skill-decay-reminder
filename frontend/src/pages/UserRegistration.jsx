import React, { useState } from 'react';
import { registerUser } from '../services/api';
import './UserRegistration.css';

const UserRegistration = ({ onSuccess }) => {
  // State management
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [success, setSuccess] = useState(false);

  // Timezone options
  const timezoneOptions = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo'
  ];

  // Email validation regex
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Name validation
  const validateName = (name) => {
    return name.length >= 2 && name.length <= 100;
  };

  // Clear error on input change
  const handleInputChange = (setter) => (e) => {
    setError('');
    setter(e.target.value);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate email
    if (!validateEmail(email)) {
      setError('Invalid email format');
      return;
    }

    // Validate name
    if (!validateName(name)) {
      setError('Name must be 2-100 characters');
      return;
    }

    setLoading(true);

    try {
      // Call API to register user
      const response = await registerUser(email, name, timezone);
      
      // Set success state
      setUserId(response.userId);
      setSuccess(true);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(response.userId);
      }
    } catch (err) {
      // Handle different error types
      if (err.error) {
        setError(err.error);
      } else if (typeof err === 'string') {
        setError(err);
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
      padding: '40px',
      maxWidth: '500px',
      width: '100%'
    },
    title: {
      fontSize: '32px',
      fontWeight: 'bold',
      color: '#333',
      marginBottom: '8px',
      textAlign: 'center'
    },
    subtitle: {
      fontSize: '16px',
      color: '#666',
      marginBottom: '32px',
      textAlign: 'center'
    },
    formGroup: {
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '600',
      color: '#333',
      marginBottom: '8px'
    },
    input: {
      width: '100%',
      padding: '12px',
      fontSize: '16px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      boxSizing: 'border-box',
      transition: 'border-color 0.3s'
    },
    select: {
      width: '100%',
      padding: '12px',
      fontSize: '16px',
      border: '1px solid #ddd',
      borderRadius: '6px',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      cursor: 'pointer'
    },
    button: {
      width: '100%',
      padding: '14px',
      fontSize: '16px',
      fontWeight: '600',
      color: 'white',
      backgroundColor: '#667eea',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'background-color 0.3s',
      marginTop: '10px'
    },
    buttonDisabled: {
      backgroundColor: '#ccc',
      cursor: 'not-allowed'
    },
    error: {
      backgroundColor: '#fee',
      color: '#c33',
      padding: '12px',
      borderRadius: '6px',
      marginBottom: '20px',
      fontSize: '14px',
      border: '1px solid #fcc'
    },
    success: {
      backgroundColor: '#efe',
      color: '#3c3',
      padding: '20px',
      borderRadius: '6px',
      textAlign: 'center',
      fontSize: '16px',
      border: '1px solid #cfc'
    },
    successTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      marginBottom: '10px'
    },
    userId: {
      fontSize: '14px',
      color: '#666',
      marginTop: '10px',
      wordBreak: 'break-all'
    },
    spinner: {
      display: 'inline-block',
      width: '16px',
      height: '16px',
      border: '3px solid rgba(255, 255, 255, 0.3)',
      borderTop: '3px solid white',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginRight: '8px'
    }
  };

  // Success view
  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.success}>
            <div style={styles.successTitle}>✓ Account Created!</div>
            <p>Your account has been successfully created.</p>
            <div style={styles.userId}>User ID: {userId}</div>
          </div>
        </div>
      </div>
    );
  }

  // Registration form view
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create Your Account</h1>
        <p style={styles.subtitle}>Start tracking your skills today</p>

        {/* Error message */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Registration form */}
        <form onSubmit={handleSubmit}>
          {/* Email field */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={handleInputChange(setEmail)}
              placeholder="your.email@example.com"
              required
              disabled={loading}
              style={styles.input}
            />
          </div>

          {/* Name field */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={handleInputChange(setName)}
              placeholder="Your full name"
              required
              minLength={2}
              maxLength={100}
              disabled={loading}
              style={styles.input}
            />
          </div>

          {/* Timezone field */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Timezone</label>
            <select
              value={timezone}
              onChange={handleInputChange(setTimezone)}
              disabled={loading}
              style={styles.select}
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
          >
            {loading ? (
              <>
                <span style={styles.spinner}></span>
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </div>

      {/* CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        input:focus, select:focus {
          outline: none;
          border-color: #667eea;
        }
        button:hover:not(:disabled) {
          background-color: #5568d3;
        }
      `}</style>
    </div>
  );
};

export default UserRegistration;
