import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../App';
import { supabase } from '../configs/database';
import { 
  UserPlus, 
  ClipboardCheck, 
  Stethoscope, 
  Sparkles, 
  Wallet, 
  Database, 
  BarChart3, 
  Users2,
  Truck,
  CreditCard,
  MessagesSquare,
  Clock,
  Key,
  Settings,
  LogOut,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const theme = useContext(ThemeContext);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  useEffect(() => {
    fetchLowStock();
  }, []);

  const fetchLowStock = async () => {
    const { count } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'Produk')
      .lte('stock', 5)
      .eq('is_deleted', false);
    if (count) setLowStockCount(count);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) return alert("Masukkan password baru!");
    if (newPassword !== confirmPassword) return alert("Konfirmasi password tidak cocok!");
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('staff')
        .update({ password: newPassword })
        .eq('id', userProfile.id);

      if (error) throw error;
      alert("Password Anda berhasil diperbarui!");
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      alert("Gagal memperbarui password: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const menus = [
    { id: 'input-pasien', title: 'Input Pasien', path: '/input-pasien', icon: UserPlus, desc: 'Pendaftaran Pasien Baru' },
    { id: 'registrasi', title: 'Registrasi & TTV', path: '/registrasi', icon: ClipboardCheck, desc: 'Antrian & Cek Vital' },
    { id: 'konsultasi', title: 'Konsultasi', path: '/konsultasi', icon: Stethoscope, desc: 'Pemeriksaan Dokter' },
    { id: 'treatment', title: 'Treatment', path: '/treatment', icon: Sparkles, desc: 'Ruang Tindakan' },
    { id: 'kasir', title: 'Kasir', path: '/kasir', icon: Wallet, desc: 'Pembayaran & Nota' },
    { id: 'personalia', title: 'Personalia', path: '/personalia', icon: Users2, desc: 'SDM & Karyawan' },
    { id: 'logistik', title: 'Logistik', path: '/logistik', icon: Truck, desc: 'Stok & Farmasi' },
    { id: 'keuangan', title: 'Keuangan', path: '/keuangan', icon: CreditCard, desc: 'Biaya & Pengeluaran' },
    { id: 'crm', title: 'CRM & Promo', path: '/crm', icon: MessagesSquare, desc: 'Retensi & Reminder' },
    { id: 'presensi', title: 'Presensi', path: '/presensi', icon: Clock, desc: 'Absensi Geolocation' },
    { id: 'master', title: 'Master Data', path: '/master', icon: Database, desc: 'Tarif & Stok' },
    { id: 'manajemen', title: 'Manajemen', path: '/manajemen', icon: BarChart3, desc: 'Laporan & KPI' },
    { id: 'settings', title: 'Settings', path: '/settings', icon: Settings, desc: 'Konfigurasi Klinik' },
  ];

  // Filter menu berdasarkan hak akses (Admin melihat semua)
  // FIXED: Fallback to all menus if no access_menus
  const filteredMenus = userProfile.role === 'admin' 
    ? menus 
    : (userProfile.access_menus && Array.isArray(userProfile.access_menus))
      ? menus.filter(m => userProfile.access_menus.includes(m.id))
      : menus.filter(m => ['presensi'].includes(m.id)); // Default safe access

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Dashboard */}
      <div className="p-6 text-white shadow-lg flex justify-between items-center rounded-b-3xl" style={{ backgroundColor: theme.primaryColor }}>
        <div>
          <h1 className="text-xl font-bold uppercase">{theme.clinicName}</h1>
          <p className="text-[10px] opacity-80 uppercase tracking-widest">Login: {userProfile.name || 'User'} ({userProfile.role})</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowPasswordModal(true)}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-2.5 rounded-xl active:scale-95 transition-all flex items-center justify-center"
            title="Ganti Password"
          >
            <Key size={16} />
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('user_profile');
              navigate('/');
            }} 
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center gap-2"
          >
            <LogOut size={14} /> LOGOUT
          </button>
        </div>
      </div>

      {/* CRM Quick Action */}
      {(userProfile.role === 'admin' || userProfile.role === 'owner') && (
        <div className="px-6 mt-4 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => navigate('/crm')}
            className="w-full bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer active:scale-95 transition-all text-left"
            aria-label="Buka CRM dan reminder pasien"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 text-white rounded-xl">
                <MessagesSquare size={20} />
              </div>
              <div>
                <p className="text-xs font-black text-blue-700 uppercase leading-none">CRM & Reminder</p>
                <p className="text-[10px] text-blue-500 mt-1 font-bold italic">Kelola follow-up, reminder kontrol, dan pesan ke pasien.</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-blue-300" />
          </button>
        </div>
      )}

      {/* Notification Area for Admin/Logistik */}
      {lowStockCount > 0 && (userProfile.role === 'admin' || userProfile.role === 'cashier') && (
        <div className="px-6 mt-4 max-w-md mx-auto">
          <div 
            onClick={() => navigate('/logistik', { state: { activeTab: 'pengadaan' } })}
            className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center justify-between cursor-pointer active:scale-95 transition-all shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 text-white rounded-xl"><AlertTriangle size={20} /></div>
              <div>
                <p className="text-xs font-black text-red-700 uppercase leading-none">Peringatan Stok</p>
                <p className="text-[10px] text-red-500 mt-1 font-bold italic">{lowStockCount} produk habis atau hampir habis. Butuh PO segera!</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-red-300" />
          </div>
        </div>
      )}

      {/* Grid Menu */}
      <div className="p-6 grid grid-cols-2 gap-4 max-w-md mx-auto">
        {filteredMenus.map((menu) => (
          <button
            key={menu.path}
            onClick={() => navigate(menu.path)}
            className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 hover:shadow-xl hover:-translate-y-1 group"
          >
            <div className="p-3 rounded-2xl transition-colors" style={{ color: theme.primaryColor }}>
              <menu.icon size={28} strokeWidth={2} />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-tight leading-none">{menu.title}</p>
              <p className="text-[9px] text-slate-400 mt-1.5 leading-tight">{menu.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Modal Ganti Password Mandiri */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-slide-up">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Key size={32} />
              </div>
              <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Keamanan Akun</h3>
              <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Ganti Password Untuk ID: {userProfile.id}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Password Baru</label>
                <input 
                  type="password" 
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl mt-1 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Konfirmasi Password</label>
                <input 
                  type="password" 
                  className="w-full p-4 bg-gray-50 border-none rounded-2xl mt-1 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              
              <div className="pt-2">
                <button 
                  onClick={handleUpdatePassword}
                  disabled={isLoading}
                  className="w-full py-4 bg-gray-800 text-white rounded-2xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-transform disabled:bg-gray-400"
                >
                  {isLoading ? 'Memproses...' : 'UPDATE PASSWORD SAYA'}
                </button>
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="w-full py-3 text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-2"
                >
                  Batalkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
