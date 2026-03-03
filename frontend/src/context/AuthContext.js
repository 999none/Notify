import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { userAPI } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('notify_token'));
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await userAPI.getMe();
      setUser(response.data);
      const premiumRes = await userAPI.checkPremium();
      setIsPremium(premiumRes.data.is_premium);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      logout();
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = (jwtToken, userData) => {
    localStorage.setItem('notify_token', jwtToken);
    localStorage.setItem('notify_user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('notify_token');
    localStorage.removeItem('notify_user');
    setToken(null);
    setUser(null);
    setIsPremium(false);
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, isPremium, isAuthenticated, login, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
