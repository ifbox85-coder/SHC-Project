import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './configs/database';
import { themeConfig as defaultTheme } from './configs/settings';
import AuthGuard from './pages/AuthGuard';
import LoginPage from './pages/LoginPage';
import InputPasien from './pages/InputPasien';
import Registrasi from './pages/Registrasi';
import Konsultasi from './pages/Konsultasi';
import Treatment from './pages/Treatment';
import Kasir from './pages/Kasir';
import MasterData from './pages/MasterData';
import Manajemen from './pages/Manajemen';
import SettingsApp from './pages/SettingsApp';
import Dashboard from './pages/Dashboard';
import Personalia from './pages/Personalia';
import Logistik from './pages/Logistik';
import Keuangan from './pages/Keuangan';
import CRM from './pages/CRM';
import Presensi from './pages/Presensi';

export const ThemeContext = createContext();

function App() {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (data) {
        setTheme({
          clinicName: data.clinic_name,
          address: data.address,
          logo: data.logo_url || defaultTheme.logo,
          primaryColor: data.primary_color,
          footerNota: data.footer_nota,
          productIdentity: defaultTheme.productIdentity
        });
      }
    };
    fetchSettings();
  }, []);

  return (
    <ThemeContext.Provider value={theme}>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/input-pasien"
            element={
              <AuthGuard>
                <InputPasien />
              </AuthGuard>
            }
          />
          <Route
            path="/registrasi"
            element={
              <AuthGuard>
                <Registrasi />
              </AuthGuard>
            }
          />
          <Route
            path="/konsultasi"
            element={
              <AuthGuard>
                <Konsultasi />
              </AuthGuard>
            }
          />
          <Route
            path="/treatment"
            element={
              <AuthGuard>
                <Treatment />
              </AuthGuard>
            }
          />
          <Route
            path="/kasir"
            element={
              <AuthGuard>
                <Kasir />
              </AuthGuard>
            }
          />
          <Route
            path="/personalia"
            element={
              <AuthGuard>
                <Personalia />
              </AuthGuard>
            }
          />
          <Route
            path="/logistik"
            element={
              <AuthGuard>
                <Logistik />
              </AuthGuard>
            }
          />
          <Route
            path="/keuangan"
            element={
              <AuthGuard>
                <Keuangan />
              </AuthGuard>
            }
          />
          <Route
            path="/crm"
            element={
              <AuthGuard>
                <CRM />
              </AuthGuard>
            }
          />
          <Route
            path="/presensi"
            element={
              <AuthGuard>
                <Presensi />
              </AuthGuard>
            }
          />
          <Route
            path="/master"
            element={
              <AuthGuard>
                <MasterData />
              </AuthGuard>
            }
          />
          <Route
            path="/manajemen"
            element={
              <AuthGuard>
                <Manajemen />
              </AuthGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthGuard>
                <SettingsApp />
              </AuthGuard>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ThemeContext.Provider>
  );
}
export default App;
