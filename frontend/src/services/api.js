import axios from 'axios';

// Vite uses import.meta.env instead of process.env
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const signIn = async (email) => {
  try {
    const response = await axios.get(`${API_URL}/users?email=${encodeURIComponent(email)}`);
    return response.data;
  } catch (error) {
    const data = error.response?.data || {};
    throw { ...data, statusCode: error.response?.status };
  }
};

export const registerUser = async (email, name, timezone = 'UTC') => {
  try {
    const response = await axios.post(`${API_URL}/users`, {
      email,
      name,
      timezone
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const createSkill = async (userId, skillData) => {
  try {
    const response = await axios.post(`${API_URL}/skills`, {
      userId,
      ...skillData
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getSkills = async (userId) => {
  try {
    const response = await axios.get(`${API_URL}/skills?userId=${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const updateSkill = async (skillId, userId, updates) => {
  try {
    const response = await axios.put(`${API_URL}/skills`, {
      skillId,
      userId,
      ...updates
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const deleteSkill = async (skillId, userId) => {
  try {
    const response = await axios.delete(
      `${API_URL}/skills?skillId=${skillId}&userId=${userId}`
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Generate AI practice exercise
export const generateExercise = async (userId, skillId, skillName, category, proficiency, adaptiveDifficulty) => {
  try {
    const response = await axios.post(`${API_URL}/practice`, {
      userId,
      skillId,
      skillName,
      category,
      proficiency,
      adaptiveDifficulty,
      exerciseType: 'coding_challenge'
    });
    return response.data;
  } catch (error) {
    console.error('Generate exercise error:', error);
    throw error;
  }
};

// Submit practice session score
export const submitPracticeSession = async (userId, skillId, exerciseId, score, timeSpent, actualTimeSeconds, estimatedTimeMinutes, aiData = null) => {
  try {
    const body = { userId, skillId, exerciseId, score, timeSpent, actualTimeSeconds, estimatedTimeMinutes };
    if (aiData) Object.assign(body, aiData);
    const response = await axios.post(`${API_URL}/practice-session`, body);
    return response.data;
  } catch (error) {
    console.error('Submit practice session error:', error);
    throw error;
  }
};

// Evaluate a user's answer with AI
export const evaluateAnswer = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/evaluate-answer`, data);
    return response.data;
  } catch (error) {
    console.error('Evaluate answer error:', error);
    // Return graceful fallback so frontend can show self-mark option
    return {
      score: null,
      detailedFeedback: 'AI feedback is temporarily unavailable. Please use self-marking instead.',
      error: true,
    };
  }
};

// Send message to AI Learning Coach
export const postCoachMessage = async (userId, message, conversationHistory = []) => {
  try {
    const response = await axios.post(`${API_URL}/coach`, {
      userId,
      message,
      conversationHistory,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get analytics data
export const getAnalytics = async (userId) => {
  try {
    const response = await axios.get(`${API_URL}/analytics?userId=${userId}`);
    return response.data;
  } catch (error) {
    console.error('Get analytics error:', error);
    throw error.response?.data || error.message;
  }
};

// Get notification preferences
export const getNotificationPreferences = async (userId) => {
  try {
    const response = await axios.get(`${API_URL}/notifications/preferences?userId=${encodeURIComponent(userId)}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Update notification preferences
export const updateNotificationPreferences = async (userId, prefs) => {
  try {
    const response = await axios.put(`${API_URL}/notifications/preferences`, { userId, ...prefs });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get recent notifications for the notification centre
export const getNotifications = async (userId, limit = 20) => {
  try {
    const response = await axios.get(`${API_URL}/notifications?userId=${encodeURIComponent(userId)}&limit=${limit}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Mark specific notifications as read
export const markNotificationsRead = async (userId, notificationIds) => {
  try {
    const response = await axios.put(`${API_URL}/notifications/read`, { userId, notificationIds });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get AI progress analysis (full_analysis or session_insight)
export const getProgressAnalysis = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/progress-analysis`, data);
    return response.data;
  } catch (error) {
    console.error('Progress analysis error:', error);
    throw error.response?.data || error.message;
  }
};

// Mark all notifications as read
export const markAllNotificationsRead = async (userId) => {
  try {
    const response = await axios.put(`${API_URL}/notifications/read`, { userId, markAllRead: true });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
