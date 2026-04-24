import React from 'react';
import { Navigate } from 'react-router-dom';

const getUserProfile = () => {
  try {
    return JSON.parse(localStorage.getItem('user_profile') || '{}') || {};
  } catch (error) {
    return {};
  }
};

const AuthGuard = ({ children, requiredRoles = [], requiredMenus = [] }) => {
  const userProfile = getUserProfile();

  if (!userProfile?.id) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(userProfile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    userProfile.role !== 'admin' &&
    requiredMenus.length > 0 &&
    !requiredMenus.some((menu) => userProfile.access_menus?.includes(menu))
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
