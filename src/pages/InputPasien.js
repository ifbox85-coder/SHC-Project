import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { dbInsert, supabase } from '../configs/database';
import { useNavigate, useLocation } from 'react-router-dom';

const InputPasien = () => {
  const theme = useContext(ThemeContext);
  const location = useLocation();
  const editData = location.state?.patientData; // Ambil data jika dalam mode edit

  const [activeId, setActiveId] = useState(editData?.id || null);
  const [patientList, setPatientList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    nik: editData?.nik || '',
    namaLengkap: editData?.full_name || '',
    tglLahir: editData?.birth_date || '',
    jenisKelamin: editData?.gender || '',
    noHp: editData?.phone_number || '',
    alamat: editData?.address || '',
    email: editData?.email || ''
  });
  const [nikValid, setNikValid] = useState(null); // null=empty, true=valid, false=invalid
  const [nomorRM, setNomorRM] = useState(editData?.rm_number || '');
  const [isLoading, setIsLoading] = useState(false);
  const [rmValid, setRmValid] = useState(true);
  const [checkingRM, setCheckingRM] = useState(false);
  const [checkingNIK, setCheckingNIK] = useState(false);
  const [nikUnique, setNikUnique] = useState(true);
  const [dateTime, setDateTime] = useState(new Date());
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const navigate = useNavigate();

  // Jam Real-time
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [searchQuery]);

// Check RM uniqueness
  const checkRMUnique = async (rmToCheck) => {
    setCheckingRM(true);
    try {
      const { count } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('rm_number', rmToCheck);
      
      const isUnique = count === 0;
      setRmValid(isUnique);
      return isUnique;
    } catch (err) {
      return false;
    } finally {
      setCheckingRM(false);
    }
  };

  // Check NIK uniqueness - SIMPLIFIED VERSION
  const checkNIKUnique = async (nikToCheck) => {
    setCheckingNIK(true);
    try {
      const { count } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('nik', nikToCheck)
        .not('nik', 'is', null);
      
      const isUnique = count === 0;
      setNikUnique(isUnique);
      setNikValid(isUnique);
    } catch (err) {
      setNikUnique(false);
      setNikValid(false);
    } finally {
      setCheckingNIK(false);
    }
  };

  const fetchPatients = async () => {
    try {
      let query = supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,nik.ilike.%${searchQuery}%,rm_number.ilike.%${searchQuery}%`);
      }

      const { data } = await query;
      if (data) setPatientList(data);
    } catch (err) {
      // Error patients
    }
  };

  const handleEditLocal = (p) => {
    setFormData({
      nik: p.nik,
      namaLengkap: p.full_name,
      tglLahir: p.birth_date,
      jenisKelamin: p.gender,
      noHp: p.phone_number,
      alamat: p.address,
      email: p.email || ''
    });
    setNomorRM(p.rm_number);
    setActiveId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // RM Number - only digits, 6 chars max
    if (name === 'rm_number') {
      const numericRM = value.replace(/\D/g, '').slice(0,6);
      setNomorRM(numericRM);
      if (numericRM.length > 0) {
        checkRMUnique(numericRM);
      }
      return;
    }

    let finalValue = value;

    // NIK VALIDATION: Exactly 16 numeric digits + uniqueness check
    if (name === 'nik') {
      const numericValue = value.replace(/\D/g, ''); // Only numbers
      setFormData({ ...formData, [name]: numericValue });
      
      // Length validation first
      if (numericValue.length === 0) {
        setNikValid(null);
        return;
      } else if (numericValue.length === 16) {
        // Check uniqueness for 16-digit NIK
        checkNIKUnique(numericValue);
      } else {
        setNikValid(false);
        return;
      }
      return;
    }

    if (name === 'noHp') {
      // Hapus semua karakter yang bukan angka
      let cleaned = value.replace(/\D/g, '');
      
      // Konversi awalan 0 ke 62, atau tambahkan 62 jika belum ada
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
      } else if (cleaned.length > 0 && !cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
      }
      
      // Tambahkan tanda + di depan jika ada angka
      finalValue = cleaned.length > 0 ? '+' + cleaned : '';
    }

    setFormData({ ...formData, [name]: finalValue });
  };

  // Auto check RM when nomorRM changes (debounced)
  useEffect(() => {
    if (nomorRM.length > 0 && !activeId) {
      const timer = setTimeout(() => checkRMUnique(nomorRM), 500);
      return () => clearTimeout(timer);
    }
  }, [nomorRM]);

  const handleSimpan = async (e) => {
    e.preventDefault();

    // NIK Validation (includes uniqueness)
    if (formData.nik.length !== 16 || !nikUnique) {
      alert('⚠️ NIK harus 16 digit dan unik!');
      return;
    }

    const executeSave = async (retryCount = 0) => {
      try {
      setIsLoading(true);
      const payload = {
        nik: formData.nik,
        full_name: formData.namaLengkap,
        birth_date: formData.tglLahir,
        gender: formData.jenisKelamin,
        phone_number: formData.noHp,
        address: formData.alamat,
        email: formData.email
      };

      if (activeId) {
        // Mode Update
        const { error } = await supabase
          .from('patients')
          .update(payload)
          .eq('id', activeId);
        
        if (error) throw error;

        await supabase.from('activity_logs').insert([{
          staff_id: userProfile.id || 'SYSTEM',
          action: 'UPDATE_PASIEN',
          description: `Memperbarui data profil pasien: ${formData.namaLengkap} (RM: ${nomorRM})`
        }]);

        alert("Data Pasien Berhasil Diperbarui!");
      } else {
        // GENERATE RM TEPAT SAAT SIMPAN (Mencegah Race Condition)
        const { data: allPatients } = await supabase
          .from('patients')
          .select('rm_number');
        
        let nextNum = 1;
        if (allPatients && allPatients.length > 0) {
          const numericRMs = allPatients.map(p => parseInt(p.rm_number) || 0);
          nextNum = Math.max(...numericRMs) + 1;
        }
        
        const currentRM = nextNum.toString().padStart(6, '0');

        const { error } = await supabase
          .from('patients')
          .insert([{ ...payload, rm_number: currentRM }]);

        if (error) {
          // Jika error duplikat (23505) karena rebutan nomor, coba lagi otomatis
          if (error.code === '23505' && retryCount < 5) {
            return executeSave(retryCount + 1);
          }
          throw error;
        }

        await supabase.from('activity_logs').insert([{
          staff_id: userProfile.id || 'SYSTEM',
          action: 'PASIEN_BARU',
          description: `Mendaftarkan pasien baru: ${formData.namaLengkap} (RM: ${currentRM})`
        }]);

        alert("Data Pasien Berhasil Disimpan dengan No. RM: " + currentRM);
      }

      // Reset form
      setActiveId(null);
      setFormData({ nik: '', namaLengkap: '', tglLahir: '', jenisKelamin: '', noHp: '', alamat: '' });
      fetchPatients();
      
    } catch (error) {
      if (error.message?.includes('row-level security policy')) {
        alert("Gagal Simpan: Izin akses database ditolak (RLS) untuk tabel 'patients'.\n\nPastikan Anda sudah menjalankan SQL Policy INSERT & UPDATE di Dashboard Supabase.");
      } else {
        alert("Gagal menyimpan data: " + error.message);
      }
      console.error(error);
    } finally {
      setIsLoading(false);
    }
    };

    executeSave();
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      {/* Header Menu */}
      <div className="p-4 shadow-md text-white" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center">
            <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl active:scale-90 transition-transform">←</button>
            <div>
              <h2 className="font-bold text-lg leading-tight">{activeId ? 'Edit Data Pasien' : 'Input Data Pasien'}</h2>
              <p className="text-[10px] opacity-80 uppercase">{userProfile.name || 'Staff'} • {dateTime.toLocaleDateString('id-ID')} {dateTime.toLocaleTimeString('id-ID')}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-[10px] px-3 py-1 rounded-full font-black shadow-sm ${
              activeId 
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
                : 'bg-white text-black'
            }`}>
              {activeId ? `RM: ${nomorRM} ${checkingRM ? '⏳' : rmValid ? '✅' : '❌'}` : `RM: [OTOMATIS]`}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto">
        <form onSubmit={handleSimpan} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          
          {/* NIK - Vital untuk SatuSehat */}
          <div>
            <label className="block text-sm font-semibold text-gray-600">NIK (Sesuai KTP) {activeId && <span className="text-[10px] text-blue-500 italic">(Mode Edit)</span>}</label>
            <input
              type="text"
              name="nik"
              required
              maxLength="16"
              className={`w-full mt-1 p-3 rounded-lg focus:ring-2 outline-none transition-all ${
                nikValid === true 
                  ? 'border-green-300 ring-green-200 bg-green-50' 
                  : nikValid === false 
                  ? 'border-red-300 ring-red-200 bg-red-50' 
                  : 'border-gray-300'
              }`}
              placeholder="Masukkan 16 Digit NIK KTP"
              value={formData.nik}
              onChange={handleChange}
            />
            {formData.nik.length !== 16 && (
              <p className="mt-1 text-xs text-yellow-600 font-semibold flex items-center gap-1">
                ⚠️ Ketik tepat 16 angka untuk validasi
              </p>
            )}
            {formData.nik.length === 16 && checkingNIK && (
              <p className="mt-1 text-xs text-blue-600 font-semibold flex items-center gap-1">
                🔍 Checking NIK uniqueness...
              </p>
            )}
            {formData.nik.length === 16 && !checkingNIK && (
              <p className={`mt-1 text-xs font-semibold flex items-center gap-1 ${
                nikUnique 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {nikUnique ? '✅ NIK unik dan valid' : '❌ NIK sudah terdaftar!'}
              </p>
            )}
          </div>

          {/* Nama Lengkap */}
          <div>
            <label className="block text-sm font-semibold text-gray-600">Nama Lengkap Pasien</label>
            <input
              type="text"
              name="namaLengkap"
              required
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg uppercase"
              placeholder="Contoh: BUDI SANTOSO"
              value={formData.namaLengkap}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tanggal Lahir */}
            <div>
              <label className="block text-sm font-semibold text-gray-600">Tgl Lahir</label>
              <input
                type="date"
                name="tglLahir"
                required
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg text-sm"
                value={formData.tglLahir}
                onChange={handleChange}
              />
            </div>
            {/* Jenis Kelamin */}
            <div>
              <label className="block text-sm font-semibold text-gray-600">Gender</label>
              <select 
                name="jenisKelamin"
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg bg-white"
                value={formData.jenisKelamin}
                onChange={handleChange}
              >
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>

          {/* Email Pasien */}
          <div>
            <label className="block text-sm font-semibold text-gray-600">Email Pasien</label>
            <input
              type="email"
              name="email"
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg"
              placeholder="contoh@email.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          {/* No Handphone / WhatsApp */}
          <div>
            <label className="block text-sm font-semibold text-gray-600">No. WhatsApp</label>
            <input
              type="tel"
              name="noHp"
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg"
              placeholder="+62812xxxx"
              value={formData.noHp}
              onChange={handleChange}
            />
          </div>

          {/* Alamat Lengkap */}
          <div>
            <label className="block text-sm font-semibold text-gray-600">Alamat Lengkap</label>
            <textarea
              name="alamat"
              rows="3"
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg"
              placeholder="Alamat domisili saat ini"
              value={formData.alamat}
              onChange={handleChange}
            ></textarea>
          </div>

          {/* Tombol Simpan */}
          <button
            type="submit"
            disabled={isLoading || checkingNIK}
            className="w-full py-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: isLoading ? '#ccc' : theme.primaryColor }}
          >
            {isLoading ? 'MEMPROSES...' : activeId ? 'PERBARUI DATA PASIEN' : 'SIMPAN DATA PASIEN'}
          </button>

          {activeId && (
            <button
              type="button"
              onClick={() => {
                setActiveId(null);
                setFormData({ nik: '', namaLengkap: '', tglLahir: '', jenisKelamin: '', noHp: '', alamat: '' });
              }}
              className="w-full py-2 text-xs font-bold text-gray-400 uppercase tracking-widest"
            >
              Batal Edit / Input Pasien Baru
            </button>
          )}

        </form>

        {/* Modul Daftar Pasien Menyeluruh */}
        <div className="mt-8 space-y-3 pb-10">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Database Pasien ({patientList.length})</h3>
          </div>

          {/* Kolom Pencarian List */}
          <div className="relative">
            <input 
              type="text"
              placeholder="Cari Nama, NIK, atau No. RM..."
              className="w-full p-3 pl-10 border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:border-gold transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-sm">🔍</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {patientList.map((p) => (
              <div key={p.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center animate-fadeIn">
                <div>
                  <p className="font-bold text-sm text-gray-800 uppercase leading-none">{p.full_name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">RM: {p.rm_number} | NIK: {p.nik}</p>
                </div>
                <button 
                  onClick={() => handleEditLocal(p)}
                  className="text-[10px] font-bold text-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >EDIT</button>
              </div>
            ))}
            {patientList.length === 0 && (
              <p className="text-center text-xs text-gray-400 italic py-10 bg-white rounded-xl border border-dashed">
                {searchQuery ? `Pasien "${searchQuery}" tidak ditemukan.` : 'Belum ada data pasien.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputPasien;