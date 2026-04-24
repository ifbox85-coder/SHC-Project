import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { supabase } from '../configs/database';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const Personalia = () => {
  const theme = useContext(ThemeContext);
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [availableShifts, setAvailableShifts] = useState([]);

  // State untuk Form Pegawai (Tanpa Sertifikat/SIP sesuai permintaan)
  const [staffForm, setStaffForm] = useState({
    id: '',
    name: '',
    role: 'therapist', // Default role
    password: '',
    nik: '',
    phone_number: '',
    address: '',
    gender: 'Laki-laki',
    birth_place: '',
    birth_date: null,
    join_date: new Date().toISOString().split('T')[0],
    is_senior: false,
    is_active: true,
    work_shift: [],
    base_salary: 0,
    senior_bonus: 0
  });

  useEffect(() => {
    fetchStaff();
    fetchShifts();
  }, [showInactive]);

  const fetchStaff = async () => {
    setIsLoading(true);
    let query = supabase.from('staff')
      .select('*')
      .neq('id', 'superadmin') // Integrasi: Sembunyikan superadmin agar tidak teredit sembarang
      .order('name', { ascending: true });
      
    if (!showInactive) query = query.eq('is_active', true);
    
    const { data } = await query;
    if (data) setStaffList(data);
    setIsLoading(false);
  };

  const fetchShifts = async () => {
    const { data } = await supabase.from('shifts').select('*').order('name', { ascending: true });
    if (data) setAvailableShifts(data);
  };

  // Handler UX: Validasi NIK 16 Digit & Hanya Angka
  const handleNikChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // Hapus karakter non-angka
    if (val.length <= 16) {
      setStaffForm({ ...staffForm, nik: val });
    }
  };

  // Handler UX: Otomatisasi format WhatsApp +62
  const handlePhoneChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); // Ambil angka saja
    
    // Jika user mengetik '08...' ubah jadi '628...'
    if (val.startsWith('0')) {
      val = '62' + val.substring(1);
    } 
    // Jika user langsung ketik '8...' tambahkan '62' di depan
    else if (val.length > 0 && !val.startsWith('62')) {
      val = '62' + val;
    }

    const finalVal = val ? '+' + val : '';
    setStaffForm({ ...staffForm, phone_number: finalVal });
  };

  const handleSimpan = async (e) => {
    e.preventDefault();
    if (!staffForm.id || !staffForm.name) return alert("ID Login dan Nama wajib diisi");
    
    setIsLoading(true);
    
    const trimmedNik = staffForm.nik ? staffForm.nik.trim() : '';

    // Validasi NIK: Harus tepat 16 digit jika pengguna mulai mengisi
    if (trimmedNik !== '' && trimmedNik.length !== 16) {
      setIsLoading(false);
      return alert("NIK harus tepat 16 digit!");
    }

    const payload = { 
      ...staffForm,
      senior_bonus: Number(staffForm.senior_bonus) || 0,
      base_salary: Number(staffForm.base_salary) || 0
    };

    // Pastikan string kosong dikirim sebagai NULL agar tidak melanggar CHECK constraint
    Object.keys(payload).forEach(key => {
      if (typeof payload[key] === 'string' && payload[key].trim() === '') payload[key] = null;
    });

    try {
      // Integrasi: Menyimpan ke tabel 'staff' yang juga digunakan untuk login
      const { error } = await supabase.from('staff').upsert({
        ...payload,
        id: payload.id.toUpperCase(), // Standarisasi ID Capital
        updated_at: new Date().toISOString() // Integrasi waktu perubahan
      });

      if (error) throw error;
      
      alert("Data Pegawai Berhasil Disimpan!");
      resetForm();
      fetchStaff();
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStaffForm({
      id: '', name: '', role: 'therapist', password: '',
      nik: '', phone_number: '', address: '', gender: 'Laki-laki',
      birth_place: '', birth_date: null,
      join_date: new Date().toISOString().split('T')[0],
      is_senior: false, is_active: true, work_shift: [], base_salary: 0,
      senior_bonus: 0
    });
  };

  const handleEdit = (s) => {
    setStaffForm({
      ...s,
      work_shift: Array.isArray(s.work_shift) ? s.work_shift : []
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredStaff = staffList.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="p-4 text-white shadow-md flex items-center justify-between" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex items-center">
          <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl active:scale-90 transition-transform">←</button>
          <h2 className="font-bold text-lg">Manajemen Personalia (SDM)</h2>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {/* Form Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-black text-gray-700 uppercase text-[10px] tracking-widest mb-4 border-b pb-2">Kredensial & Profil Pegawai</h3>
          
          <form onSubmit={handleSimpan} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">ID Login / Username</label>
                <input type="text" className="w-full p-3 border rounded-xl mt-1 text-sm font-mono uppercase bg-gray-50" 
                  value={staffForm.id} onChange={e => setStaffForm({...staffForm, id: e.target.value})} placeholder="D001" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Password Akses</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password" 
                    autoComplete="new-password" 
                    className="w-full p-3 border rounded-xl mt-1 text-sm font-mono pr-10" 
                    value={staffForm.password} 
                    onChange={e => setStaffForm({...staffForm, password: e.target.value})} 
                    placeholder="****" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nama Lengkap</label>
                <input type="text" className="w-full p-3 border rounded-xl mt-1 text-sm font-bold" 
                  value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} placeholder="Ketik nama lengkap..." required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Role / Jabatan</label>
                <select className="w-full p-3 border rounded-xl mt-1 text-sm bg-white" 
                  value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})}>
                  <option value="doctor">Dokter</option>
                  <option value="therapist">Terapis</option>
                  <option value="cashier">Kasir</option>
                  <option value="admin">Administrator</option>
                  <option value="pharmacist">Apoteker</option>
                  <option value="owner">Owner / Pemilik</option>
                </select>
              </div>
            </div>

            {staffForm.role === 'therapist' && (
              <div className="space-y-3">
                <div className="bg-blue-50 p-4 rounded-xl flex items-center justify-between border border-blue-100">
                  <div>
                    <p className="text-xs font-bold text-blue-700">Terapis Senior</p>
                    <p className="text-[9px] text-blue-500 italic">Mendapatkan bagi hasil (fee) lebih tinggi.</p>
                  </div>
                  <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={staffForm.is_senior} onChange={e => setStaffForm({...staffForm, is_senior: e.target.checked})} />
                </div>
                
                {staffForm.is_senior && (
                  <div className="animate-fadeIn">
                    <label className="text-[10px] font-bold text-blue-400 uppercase">Tambahan Jasa per Tindakan (Senior Bonus)</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      className="w-full p-3 border border-blue-200 rounded-xl mt-1 text-sm font-bold text-blue-700 bg-blue-50/30 outline-none focus:ring-1" 
                      value={staffForm.senior_bonus ? Number(staffForm.senior_bonus).toLocaleString('id-ID') : ''} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setStaffForm({...staffForm, senior_bonus: val});
                      }} 
                      placeholder="Rp 0" 
                    />
                    <p className="text-[9px] text-blue-400 mt-1 italic">* Nominal ini akan otomatis ditambahkan ke jasa terapis setiap kali pengerjaan tindakan.</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Jenis Kelamin</label>
                <select className="w-full p-3 border rounded-xl mt-1 text-sm bg-white" 
                  value={staffForm.gender} onChange={e => setStaffForm({...staffForm, gender: e.target.value})}>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">NIK (KTP)</label>
                <input type="text" className={`w-full p-3 border rounded-xl mt-1 text-sm ${staffForm.nik && staffForm.nik.length !== 16 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} 
                  value={staffForm.nik || ''} onChange={handleNikChange} placeholder="16 digit nomor KTP..." />
                {staffForm.nik && staffForm.nik.length !== 16 && (
                  <p className="text-[9px] text-red-500 mt-1 font-bold">Harus 16 digit (Saat ini: {staffForm.nik.length})</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tempat Lahir</label>
                <input type="text" className="w-full p-3 border rounded-xl mt-1 text-sm" 
                  value={staffForm.birth_place || ''} onChange={e => setStaffForm({...staffForm, birth_place: e.target.value})} placeholder="Kota..." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tanggal Lahir</label>
                <input type="date" className="w-full p-3 border rounded-xl mt-1 text-sm" 
                  value={staffForm.birth_date || ''} onChange={e => setStaffForm({...staffForm, birth_date: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Alamat Domisili</label>
              <textarea className="w-full p-3 border rounded-xl mt-1 text-sm" rows="2"
                value={staffForm.address || ''} 
                onChange={e => setStaffForm({...staffForm, address: e.target.value})} 
                placeholder="Alamat lengkap saat ini..." />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nomor WhatsApp</label>
                <input type="text" className="w-full p-3 border rounded-xl mt-1 text-sm font-bold text-green-700 bg-green-50/30" 
                  value={staffForm.phone_number || ''} onChange={handlePhoneChange} placeholder="+628..." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Tanggal Bergabung</label>
                <input type="date" className="w-full p-3 border rounded-xl mt-1 text-sm" 
                  value={staffForm.join_date} onChange={e => setStaffForm({...staffForm, join_date: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase">Gaji Pokok (Bulanan)</label>
              <input 
                type="text" 
                inputMode="numeric"
                className="w-full p-3 border rounded-xl mt-1 text-sm font-bold text-emerald-700 bg-emerald-50/30" 
                value={staffForm.base_salary ? Number(staffForm.base_salary).toLocaleString('id-ID') : ''} 
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setStaffForm({...staffForm, base_salary: val});
                }} 
                placeholder="Rp 0" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Plot Jadwal / Shift Kerja</label>
              <div className="grid grid-cols-2 gap-2">
                {availableShifts.map(shift => {
                  const isChecked = staffForm.work_shift?.includes(shift.name);
                  return (
                    <label 
                      key={shift.id} 
                      className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all active:scale-95 ${isChecked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-700">{shift.name}</span>
                        <span className="text-[9px] text-gray-400 font-mono">{shift.start_time.substring(0,5)} - {shift.end_time.substring(0,5)}</span>
                      </div>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-blue-600 rounded" 
                        checked={isChecked}
                        onChange={() => {
                          const current = staffForm.work_shift || [];
                          const next = current.includes(shift.name) ? current.filter(n => n !== shift.name) : [...current, shift.name];
                          setStaffForm({ ...staffForm, work_shift: next });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              {availableShifts.length === 0 && <p className="text-[10px] text-gray-400 italic">* Atur data shift di menu Master Data terlebih dahulu.</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-end mb-1">
                <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                  <input type="checkbox" className="w-4 h-4 accent-green-600" checked={staffForm.is_active} onChange={e => setStaffForm({...staffForm, is_active: e.target.checked})} />
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Status Pegawai Aktif</span>
                </label>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full py-4 rounded-xl text-white font-bold shadow-lg uppercase tracking-wider mt-4"
              style={{ backgroundColor: isLoading ? '#ccc' : theme.primaryColor }}>
              {isLoading ? 'MEMPROSES...' : (staffForm.id && staffList.some(s => s.id === staffForm.id) ? 'PERBARUI DATA' : 'TAMBAH PEGAWAI BARU')}
            </button>
            {staffForm.id && <button type="button" onClick={resetForm} className="w-full py-2 text-xs text-red-500 font-bold uppercase">Batal / Reset</button>}
          </form>
        </div>

        {/* Table List Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Daftar Pegawai Klinik</h3>
            <button onClick={() => setShowInactive(!showInactive)} className="text-[9px] font-bold px-3 py-1 border rounded-full text-gray-400 uppercase">
              {showInactive ? 'Sembunyikan Non-Aktif' : 'Lihat Semua'}
            </button>
          </div>
          
          <input type="text" placeholder="Cari Nama atau ID Pegawai..." className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-1" 
            onChange={e => setSearchQuery(e.target.value)} />
          
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase font-black">
                <tr>
                  <th className="p-3">Pegawai</th>
                  <th className="p-3">Jabatan</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStaff.map(s => (
                  <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.is_active ? 'bg-gray-50 opacity-60' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-xs">{s.name}</span>
                        {s.is_senior && (
                          <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-black">
                            SENIOR (+Rp {(s.senior_bonus || 0).toLocaleString()})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">{s.id}</div>
                    </td>
                    <td className="p-3 text-[10px] uppercase font-bold text-gray-500">{s.role}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleEdit(s)} className="text-blue-500 font-bold text-[10px] uppercase hover:underline">Detail/Edit</button>
                    </td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr><td colSpan="3" className="p-10 text-center text-gray-400 italic text-xs">Pegawai tidak ditemukan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Personalia;