import axios from 'axios';

// Vite uses import.meta.env instead of process.env
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
