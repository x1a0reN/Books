import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const res = await authAPI.getMe();
          setUser(res.data);
        } catch (error) {
          console.error("Failed to fetch user:", error);
          localStorage.removeItem('access_token');
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const login = async (username, password) => {
    const res = await authAPI.login(username, password);
    const token = res.data.access_token;
    const refreshToken = res.data.refresh_token;
    if (!token) throw new Error('No access token returned');
    localStorage.setItem('access_token', token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    
    // Fetch user info immediately after login
    const userRes = await authAPI.getMe();
    setUser(userRes.data);
    return userRes.data;
  };

  const register = async (username, password) => {
    const res = await authAPI.register(username, password);
    const token = res.data.access_token;
    const refreshToken = res.data.refresh_token;
    if (!token) throw new Error('No access token returned');
    localStorage.setItem('access_token', token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    
    // Fetch user info after registration
    const userRes = await authAPI.getMe();
    setUser(userRes.data);
    return userRes.data;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
