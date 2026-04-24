import React from 'react';
import { themeConfig } from '../configs/settings';

const Layout = ({ children, title }) => {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col shadow-2xl">
      {/* Top Navbar */}
      <header className="p-4 text-white flex justify-between items-center sticky top-0 z-50" 
              style={{ backgroundColor: themeConfig.primaryColor }}>
        <h1 className="font-bold text-lg">{title || themeConfig.clinicName}</h1>
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-xs" style={{ color: themeConfig.primaryColor }}>
          👤
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto mb-20">
        {children}
      </main>

      {/* Bottom Menu (Mobile Navigation) */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white border-t flex justify-around py-3 shadow-inner">
        <button className="flex flex-col items-center text-[10px] text-gray-400">🏠<span>Home</span></button>
        <button className="flex flex-col items-center text-[10px] text-gray-400">➕<span>Pasien</span></button>
        <button className="flex flex-col items-center text-[10px] text-gray-400 font-bold" style={{ color: themeConfig.primaryColor }}>📄<span>Antrian</span></button>
        <button className="flex flex-col items-center text-[10px] text-gray-400">⚙️<span>Setting</span></button>
      </nav>
    </div>
  );
};

export default Layout;