import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const me = await base44.auth.me();
      setUser(me);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (err) {
      setIsAuthenticated(false);
      setUser(null);
      if (err?.status === 401 || err?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        setAuthError({ type: 'unknown', message: err?.message || 'Auth check failed' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const setup = await base44.auth.setupState();
        setNeedsSetup(!!setup?.needs_setup);
      } catch { /* ignore */ }
      setIsLoadingPublicSettings(false);
      await checkUserAuth();
    })();
  }, [checkUserAuth]);

  const login = useCallback(async (email, password) => {
    const resp = await base44.auth.login(email, password);
    setUser(resp.user);
    setIsAuthenticated(true);
    setAuthError(null);
    setNeedsSetup(false);
    return resp.user;
  }, []);

  const register = useCallback(async (payload) => {
    const resp = await base44.auth.register(payload);
    setUser(resp.user);
    setIsAuthenticated(true);
    setAuthError(null);
    setNeedsSetup(false);
    return resp.user;
  }, []);

  const logout = useCallback(async () => {
    await base44.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    window.location.assign('/login');
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.assign(`/login?from=${encodeURIComponent(window.location.href)}`);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      needsSetup,
      login,
      register,
      logout,
      navigateToLogin,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
