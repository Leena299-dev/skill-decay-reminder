import axios from 'axios';

// Vite uses import.meta.env instead of process.env
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const signIn = async (email) => {
  try {
    const response = await axios.get(`${API_URL}/users?email=${encodeURIComponent(email)}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
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
export const generateExercise = async (userId, skillId, skillName, category, proficiency) => {
  try {
    const response = await axios.post(`${API_URL}/practice`, {
      userId,
      skillId,
      skillName,
      category,
      proficiency,
      exerciseType: 'coding_challenge'
    });
    return response.data;
  } catch (error) {
    console.error('Generate exercise error:', error);
    throw error;
  }
};

// Submit practice session score
export const submitPracticeSession = async (userId, skillId, exerciseId, score, timeSpent) => {
  try {
    const response = await axios.post(`${API_URL}/practice-session`, {
      userId,
      skillId,
      exerciseId,
      score,
      timeSpent
    });
    return response.data;
  } catch (error) {
    console.error('Submit practice session error:', error);
    throw error;
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
