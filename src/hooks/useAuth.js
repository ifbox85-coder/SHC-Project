import { useState, useEffect } from 'react';

export const useAuth = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FIXED: Read user_profile (consistent with LoginPage/Dashboard)
    const savedSession = localStorage.getItem('user_profile');
    if (savedSession) {
      setSession(JSON.parse(savedSession));
    }
    setLoading(false);
  }, []);

  const logout = () => {
    setSession(null);
    localStorage.removeItem('user_profile');
    window.location.href = '/';
  };

  // No login method - handled in LoginPage via RPC

  return { session, logout, loading };
};
