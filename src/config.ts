// src/config.ts
export const BACKEND_URL = (
  process.env.REACT_APP_API_URL || 'http://localhost:5000'
).replace(/\/$/, '');

export const IOT_SERVER_URL = (
  process.env.REACT_APP_IOT_URL || BACKEND_URL
).replace(/\/$/, '');

export const API_URL = `${BACKEND_URL}/api`;
export const IOT_API_URL = `${IOT_SERVER_URL}/api`;