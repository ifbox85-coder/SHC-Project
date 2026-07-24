import React, { useState, useEffect } from 'react';
import { themeConfig } from '../configs/settings';
import { supabase, dbUploadFile } from '../configs/database';
import { useNavigate } from 'react-router-dom';
import { Navigation } from 'lucide-react';

const SettingsApp = () => {
  const [config, setConfig] = useState({
    clinicName: themeConfig.clinicName,
    address: themeConfig.address,
    primaryColor: themeConfig.primaryColor,
    footerNota: "Terima kasih atas kunjungan Anda",
    lat: -6.2000, // Default koordinat
    lng: 106.8166,
    radius: 50, // Meter
    ppnRate: 11,
    isRoundingActive: false
  });

  const [previewLogo, setPreviewLogo] = useState(themeConfig.logo);
  const [logoFile, setLogoFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle', 'active', 'denied'
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const navigate = useNavigate();

  // Muat pengaturan dari database saat pertama kali buka
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (data) {
        setConfig({
          clinicName: data.clinic_name,
          address: data.address,
          primaryColor: data.primary_color,
          footerNota: data.footer_nota || "Terima kasih atas kunjungan Anda",
          lat: data.clinic_lat || -6.2000,
          lng: data.clinic_lng || 106.8166,
          radius: data.attendance_radius || 50,
          ppnRate: data.ppn_rate != null ? data.ppn_rate : 11,
          isRoundingActive: data.is_rounding_active || false
        });
        if (data.logo_url) setPreviewLogo(data.logo_url);
      }
    };
    loadSettings();
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setPreviewLogo(URL.createObjectURL(file));
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return alert("Browser Anda tidak mendukung fitur lokasi/GPS.");

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Menggunakan functional update (prev) agar data lain di config tidak hilang/stale
        setConfig(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }));
        setGpsStatus('active');
        setIsLoading(false);
        alert("Koordinat berhasil diperbarui sesuai lokasi Anda.");
      },
      (err) => {
        setGpsStatus('denied');
        setIsLoading(false);
        alert("Gagal mengambil lokasi: " + err.message + ". Pastikan izin lokasi aktif.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      let logoUrl = previewLogo;

      // 1. Upload Logo jika diganti
      if (logoFile) {
        logoUrl = await dbUploadFile('medical-records', `branding/logo_${Date.now()}.png`, logoFile);
      }

      // 2. Ambil ID pengaturan yang sudah ada (jika ada)
      const { data: existing } = await supabase.from('settings').select('id').limit(1).maybeSingle();

      const payload = {
        clinic_name: config.clinicName,
        address: config.address,
        primary_color: config.primaryColor,
        logo_url: logoUrl,
        footer_nota: config.footerNota,
        clinic_lat: config.lat,
        clinic_lng: config.lng,
        attendance_radius: config.radius,
        ppn_rate: config.ppnRate,
        is_rounding_active: config.isRoundingActive
      };

      const { error } = existing 
        ? await supabase.from('settings').update(payload).eq('id', existing.id)
        : await supabase.from('settings').insert([payload]);

      if (error) throw error;

      await supabase.from('activity_logs').insert([{
        staff_id: userProfile.id,
        action: 'UPDATE_SETTINGS',
        description: `Mengubah pengaturan identitas klinik, koordinat, atau branding.`
      }]);

      alert("Pengaturan Berhasil Diperbarui!");
      // Refresh halaman untuk memuat ulang tema baru di seluruh aplikasi
      window.location.reload(); 
    } catch (err) {
      if (err.message?.includes('row-level security policy')) {
        alert("Gagal Simpan: Izin akses database ditolak (RLS) untuk tabel 'settings'.\n\nPastikan Anda sudah menjalankan SQL Policy INSERT & UPDATE di Dashboard Supabase.");
      } else {
        alert("Gagal menyimpan: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="p-4 text-white shadow-md flex justify-between items-center" style={{ backgroundColor: config.primaryColor }}>
        <div className="flex items-center">
          <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl active:scale-90 transition-transform">←</button>
          <h2 className="font-bold">Pengaturan Aplikasi</h2>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isLoading}
          className="bg-white text-xs px-4 py-2 rounded-full font-bold shadow-sm disabled:opacity-50" 
          style={{ color: config.primaryColor }}
        >
          {isLoading ? 'MEMPROSES...' : 'SIMPAN'}
        </button>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">
        
        {/* 1. Branding Klinik */}
        <div className="bg-white p-5 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-sm border-b pb-2 uppercase text-gray-400">Branding & Identitas</h3>
          
          <div className="flex flex-col items-center py-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <img 
              src={previewLogo} 
              alt="Logo Preview" 
              className="h-24 w-auto mb-3 object-contain"
              onError={(e) => e.target.src = "https://via.placeholder.com/150?text=Logo+Klinik"}
            />
            <label className="cursor-pointer bg-white px-4 py-2 rounded-lg shadow-sm border text-xs font-bold text-gray-600">
              GANTI LOGO
              <input type="file" className="hidden" onChange={handleLogoChange} accept="image/*" />
            </label>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">Nama Klinik</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-xl mt-1 outline-none" 
              value={config.clinicName}
              onChange={(e) => setConfig({...config, clinicName: e.target.value})}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">Alamat Lengkap</label>
            <textarea 
              className="w-full p-3 border rounded-xl mt-1 outline-none" 
              rows="2"
              value={config.address}
              onChange={(e) => setConfig({...config, address: e.target.value})}
            ></textarea>
          </div>
        </div>

        {/* 2. Tema Warna */}
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <h3 className="font-bold text-sm border-b pb-2 uppercase text-gray-400 mb-4">Warna Utama (Theme)</h3>
          <div className="flex items-center gap-4">
            <input 
              type="color" 
              className="w-16 h-16 rounded-lg cursor-pointer border-none"
              value={config.primaryColor}
              onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
            />
            <div>
              <p className="font-mono font-bold">{config.primaryColor}</p>
              <p className="text-[10px] text-gray-400 italic">Pilih warna yang mencerminkan brand klinik Anda.</p>
            </div>
          </div>
        </div>

        {/* 3. Konfigurasi Nota */}
        <div className="bg-white p-5 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-sm border-b pb-2 uppercase text-gray-400">Format Nota Kasir</h3>
          <div>
            <label className="text-xs font-bold text-gray-500">Pesan Footer Nota</label>
            <textarea 
              className="w-full p-3 border rounded-xl mt-1 outline-none" 
              rows="2"
              value={config.footerNota}
              onChange={(e) => setConfig({...config, footerNota: e.target.value})}
            ></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500">Tarif PPN (%)</label>
              <input 
                type="number" 
                className="w-full p-3 border rounded-xl mt-1 outline-none" 
                value={config.ppnRate}
                onChange={(e) => setConfig({...config, ppnRate: parseFloat(e.target.value)})}
              />
            </div>
            <div className="flex items-end pb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 accent-blue-600"
                  checked={config.isRoundingActive}
                  onChange={(e) => setConfig({...config, isRoundingActive: e.target.checked})}
                />
                <span className="text-xs font-bold text-gray-600 uppercase">Pembulatan</span>
              </label>
            </div>
          </div>
        </div>

        {/* 4. Lokasi Presensi */}
        <div className="bg-white p-5 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-sm border-b pb-2 uppercase text-gray-400">Titik Koordinat Absensi</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Latitude</label>
              <input type="number" step="any" className="w-full p-3 border rounded-xl mt-1 text-xs" 
                value={config.lat} onChange={(e) => setConfig({...config, lat: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Longitude</label>
              <input type="number" step="any" className="w-full p-3 border rounded-xl mt-1 text-xs" 
                value={config.lng} onChange={(e) => setConfig({...config, lng: parseFloat(e.target.value)})} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Radius Aman (Meter)</label>
            <input type="number" className="w-full p-3 border rounded-xl mt-1 text-xs" 
              value={config.radius} onChange={(e) => setConfig({...config, radius: parseInt(e.target.value)})} />
          </div>
          <button 
            onClick={handleGetCurrentLocation}
            disabled={isLoading}
            className="w-full py-2 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-bold uppercase"
          >Gunakan Lokasi Saya Saat Ini</button>
          
          {gpsStatus === 'denied' && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
              <Navigation size={14} className="text-red-500 mt-0.5" />
              <p className="text-[9px] text-red-600 font-bold leading-tight uppercase">
                Akses Lokasi Ditolak! Harap buka pengaturan Browser/HP Anda dan izinkan aplikasi ini mengakses lokasi agar koordinat otomatis berfungsi.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SettingsApp;