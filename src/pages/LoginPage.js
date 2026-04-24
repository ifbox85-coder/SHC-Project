import React, { useState, useContext } from 'react';
import { ThemeContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../configs/database';
import { Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const theme = useContext(ThemeContext);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    const cleanUserId = userId.trim().toUpperCase(); // Pastikan ID dikirim dalam huruf besar

    // SEC-01: Verify hashed password using custom PostgreSQL function
    const { data, error } = await supabase
      .rpc('verify_login', { 
        p_user_id: cleanUserId, 
        p_password: password 
      });

    if (error) {
      alert("Kesalahan Sistem: " + error.message);
      return;
    }

    if (data && data.length > 0) {
      const userData = data[0];
      // FIXED: Store FULL user profile for menu access

      // Catat Log Login
      await supabase.from('activity_logs').insert([{
        staff_id: userData.id,
        action: 'LOGIN',
        description: `User ${userData.name} berhasil masuk ke sistem.`
      }]);

      localStorage.setItem('user_profile', JSON.stringify(userData));
      navigate('/dashboard');
    } else {
      alert("ID atau Password salah, atau akun tidak aktif!");
    }
  };

  const primaryStyle = {
    backgroundColor: theme.primaryColor,
    color: '#fff'
  };

  const borderStyle = {
    borderColor: theme.primaryColor
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border-t-8" style={borderStyle}>
        
        {/* Logo & Identitas Klinik */}
        <div className="text-center mb-8">
          <img 
            src={theme.logo} 
            alt="Logo" 
            className="mx-auto h-20 w-auto mb-3"
            onError={(e) => e.target.src = "https://via.placeholder.com/150?text=Logo+Klinik"}
          />
          <h1 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
            {theme.clinicName}
          </h1>
          <p className="text-xs text-gray-500 mt-1 italic">
            {theme.address}
          </p>
        </div>

        {/* Form Login */}
        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-gray-700">ID / Username</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              spellCheck="false"
              className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none transition-all"
              style={{ borderLeft: userId ? `4px solid ${theme.primaryColor}` : '1px solid #d1d5db' }}
              placeholder="Masukkan ID Anda"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none transition-all"
                style={{ borderLeft: password ? `4px solid ${theme.primaryColor}` : '1px solid #d1d5db' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-md font-bold transition-opacity hover:opacity-90 shadow-md"
            style={primaryStyle}
          >
            MASUK SISTEM
          </button>
        </form>

        {/* Identitas Produk */}
        <div className="mt-10 text-center">
          <hr className="mb-4" />
          <p className="text-[10px] text-gray-400 tracking-widest uppercase">
            {theme.productIdentity}
          </p>
        </div>
      </div>
      
      {/* Footer Support Mobile */}
      <p className="mt-4 text-gray-400 text-xs">Optimized for Mobile & Tablet</p>
    </div>
  );
};

export default LoginPage;
