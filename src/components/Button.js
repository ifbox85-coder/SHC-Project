import React from 'react';
import { themeConfig } from '../configs/settings';

const Button = ({ children, onClick, type = "button", variant = "primary", className = "" }) => {
  const isPrimary = variant === "primary";
  
  const style = {
    backgroundColor: isPrimary ? themeConfig.primaryColor : 'transparent',
    color: isPrimary ? '#ffffff' : themeConfig.primaryColor,
    border: isPrimary ? 'none' : `1px solid ${themeConfig.primaryColor}`
  };

  return (
    <button
      type={type}
      onClick={onClick}
      style={style}
      className={`w-full py-3 px-4 rounded-xl font-bold shadow-md active:scale-95 transition-all ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;