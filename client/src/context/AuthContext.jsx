import React, { createContext, useContext, useState, useEffect } from 'react';
import API_BASE_URL from '../config.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('sos_token');
    const storedUser = localStorage.getItem('sos_user');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('sos_token');
        localStorage.removeItem('sos_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (tokenVal, userData) => {
    setToken(tokenVal);
    setUser(userData);
    localStorage.setItem('sos_token', tokenVal);
    localStorage.setItem('sos_user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sos_token');
    localStorage.removeItem('sos_user');
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('sos_user', JSON.stringify(updatedUser));
  };

  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    return fetch(fullUrl, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
