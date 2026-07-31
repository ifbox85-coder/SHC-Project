import React, { useState, useEffect, useContext, useRef } from 'react';
import { useReactToPrint } from 'react-to-print'; // useReactToPrint sudah benar
import QueuePrint from '../components/QueuePrint';
import { ThemeContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { supabase, dbInsert } from '../configs/database';

const Registrasi = () => {
  const theme = useContext(ThemeContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [patient, setPatient] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [todayRegistrations, setTodayRegistrations] = useState([]);
  const [editingEncounterId, setEditingEncounterId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [services, setServices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [tujuan, setTujuan] = useState('Konsultasi');
  const [ttv, setTtv] = useState({
    tensi: '',
    suhu: '',
    alergi: '',
    keluhan: ''
  });

  const [guestName, setGuestName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [searchTermLayanan, setSearchTermLayanan] = useState('');
  const [filterType, setFilterType] = useState('Semua');
  const [selectedItems, setSelectedItems] = useState([]);
  const [dateTime, setDateTime] = useState(new Date());
  const [printData, setPrintData] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const printRef = useRef(); 

  const handlePrintQueue = useReactToPrint({
    content: () => printRef.current,
    onAfterPrint: () => setShowPrintModal(false),
    documentTitle: 'Nomor Antrean',
    removeAfterPrint: false
  });

  const handlePrint = (reg) => {
    const queueData = {
      id: reg.id,
      queue_number: reg.queue_number,
      encounter_number: reg.encounter_number,
      patient_name: reg.patients?.full_name || reg.ttv_data?.guest_name || 'Pelanggan Umum',
      rm_number: reg.patients?.rm_number || '',
      tujuan: reg.ttv_data?.tujuan_layanan || 'Layanan',
      staff_name: reg.staff?.name || 'Belum ditugaskan'
    };
    setPrintData(queueData);
    setShowPrintModal(true);
  };

  const handleWhatsApp = (reg) => {
    const target = reg || todayRegistrations.find(r => r.id === printData?.id);
    if (!target) return;

    let phone = target.patients?.phone_number || '';
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    if (!phone) return alert("Nomor WhatsApp pasien tidak tersedia!");

    const message = 
      `*TIKET ANTREAN DIGITAL - ${theme.clinicName}*\n\n` +
      `Halo, *${target.patients?.full_name || target.ttv_data?.guest_name}*\n` +
      `Pendaftaran Anda berhasil. Berikut nomor antrean Anda:\n\n` +
      `*No. Antrean:* ${target.queue_number}\n` +
      `*Tujuan:* ${target.ttv_data?.tujuan_layanan || 'Layanan'}\n\n` +
      `Silakan menunggu panggilan petugas. Terima kasih ✨`;

    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const navigate = useNavigate();

  // Jam Real-time
  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load daftar registrasi hari ini saat halaman dibuat
  useEffect(() => {
    fetchTodayRegistrations();
    fetchStaff();
    fetchServices();
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    
    if (data) {
      setRooms(data);
    }
  };

  // Load staff berdasarkan role yang dipilih
  useEffect(() => {
    fetchStaff();
    setSelectedStaffId(''); // Reset pilihan saat tujuan ganti
    if (tujuan === 'Pembelian') {
      setFilterType('Produk');
    } else {
      setFilterType('Semua');
    }
  }, [tujuan]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .or('is_deleted.eq.false,is_deleted.is.null') // Mengambil yang false ATAU null
      .order('name', { ascending: true });

    if (error) {
      console.error("Error fetching services:", error.message);
      alert("Gagal memuat daftar layanan. Silakan refresh halaman.");
      return;
    }

    if (data) {
      // Filter: Hanya ambil yang bukan tipe Diagnosis untuk ditampilkan di modal belanja
      const filtered = data.filter(s => s.type?.toLowerCase() !== 'diagnosis');
      setServices(filtered);
    }
  };

  const fetchStaff = async () => {
    const roleFilter = tujuan === 'Konsultasi' ? 'doctor' : 'therapist';
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('role', roleFilter)
      .eq('is_active', true);
    if (data) {
      // Pastikan superadmin tidak muncul di pilihan antrean
      setStaffList(data.filter(s => s.id !== 'superadmin'));
    }
  };

  const fetchTodayRegistrations = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('encounters')
      .select(`
        id,
        status,
        ttv_data,
        queue_number,
        encounter_number,
        created_at,
        patients (full_name, rm_number, phone_number),
        staff (name)
      `)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (data) setTodayRegistrations(data);
  };

  const handleSearch = async () => {
    if (!searchTerm) return alert("Masukkan Nama/NIK/RM");
    setIsLoading(true);
    setPatient(null);
    setSearchResults([]);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .or(`rm_number.eq.${searchTerm},nik.eq.${searchTerm},full_name.ilike.%${searchTerm}%`);

      if (error) throw error;
      if (!data || data.length === 0) {
        alert("Pasien tidak ditemukan.");
      } else if (data.length === 1) {
        setPatient(data[0]);
      } else {
        setSearchResults(data);
      }
    } catch (err) {
      alert("Terjadi kesalahan kueri: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateQueueAndEncounter = async (tujuanLayanan) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.getFullYear().toString() + 
                  (today.getMonth() + 1).toString().padStart(2, '0') + 
                  today.getDate().toString().padStart(2, '0');
    
    let prefix = 'K';
    if (tujuanLayanan === 'Terapis') prefix = 'T';
    else if (tujuanLayanan === 'Pembelian') prefix = 'P';

    const pattern = `REG-${dateStr}-${prefix}`;

    const { data } = await supabase
      .from('encounters')
      .select('encounter_number')
      .ilike('encounter_number', `${pattern}%`)
      .order('encounter_number', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0 && data[0].encounter_number) {
      // Mengambil 3 digit terakhir dari string REG-YYYYMMDD-X001
      const lastPart = data[0].encounter_number.slice(-3);
      const lastNum = parseInt(lastPart);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }

    return {
      queue: `${prefix}-${nextNum.toString().padStart(3, '0')}`,
      encounter: `${pattern}${nextNum.toString().padStart(3, '0')}`
    };
  };

  const handleEditRegistration = (reg) => {
    setEditingEncounterId(reg.id);
    setPatient(reg.patients);
    setTujuan(reg.ttv_data?.tujuan_layanan || 'Konsultasi');
    setSelectedStaffId(reg.assigned_staff_id || '');
    setSelectedRoomId(reg.ttv_data?.room_id || '');
    setTtv({
      tensi: reg.ttv_data?.tensi || '',
      suhu: reg.ttv_data?.suhu || '',
      alergi: reg.ttv_data?.alergi || '',
      keluhan: reg.ttv_data?.keluhan || ''
    });
    setSelectedItems(reg.ttv_data?.items || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProses = async () => {
    if (!patient && tujuan !== 'Pembelian') return alert("Cari dan pilih pasien terlebih dahulu!");
    if (tujuan !== 'Pembelian' && !selectedStaffId) return alert(`Pilih ${tujuan === 'Konsultasi' ? 'Dokter' : 'Terapis'} terlebih dahulu!`);
    if (tujuan === 'Pembelian' && !patient && !guestName) return alert("Masukkan nama pembeli untuk pembelian tanpa RM!");
    if (selectedItems.length === 0) return alert("Pilih produk yang akan dibeli terlebih dahulu!");

    const executeProses = async (retryCount = 0) => {
      try {
      let status = 'waiting';
      if (tujuan === 'Terapis') status = 'treatment';
      else if (tujuan === 'Pembelian') status = 'completed';

      const payload = {
        patient_id: patient?.id || null,
        assigned_staff_id: selectedStaffId || null,
        status: status,
        ttv_data: {
          ...ttv,
          items: selectedItems,
          tujuan_layanan: tujuan,
          guest_name: patient ? null : guestName,
          room_id: selectedRoomId || null,
          room_name: rooms.find(r => r.id === selectedRoomId)?.name || null
        }
      };

      if (editingEncounterId) {
        const originalReg = todayRegistrations.find(r => r.id === editingEncounterId);
        const oldTujuan = originalReg?.ttv_data?.tujuan_layanan || 'Konsultasi';
        
        let finalUpdatePayload = { ...payload };
        
        let isMoved = oldTujuan !== tujuan || !originalReg?.queue_number;

        if (isMoved) {
          try {
            const { queue, encounter } = await generateQueueAndEncounter(tujuan);
            finalUpdatePayload.queue_number = queue;
            finalUpdatePayload.encounter_number = encounter;
          } catch (genError) {
            alert("Gagal generate nomor antrean baru: " + genError.message);
            return;
          }
        }

        const { error, data } = await supabase
          .from('encounters')
          .update(finalUpdatePayload)
          .eq('id', editingEncounterId)
          .select();

        await supabase.from('activity_logs').insert([{
          staff_id: userProfile.id || 'SYSTEM',
          action: 'UPDATE_REGISTRASI',
          description: `Mengubah data registrasi ${originalReg.queue_number} pasien ${patient?.full_name}`
        }]);
        
        if (error) {
          if (error.code === '23505' && retryCount < 5) {
            return executeProses(retryCount + 1);
          }
          throw error;
        }
        alert(isMoved 
          ? `Antrean dipindahkan ke ${tujuan}!\nNo. Antrean Baru: ${finalUpdatePayload.queue_number}` 
          : "Perubahan Antrean Berhasil Disimpan!");
      } else {
        const { queue, encounter } = await generateQueueAndEncounter(tujuan);
        
        const finalPayload = { 
          ...payload, 
          queue_number: queue, 
          encounter_number: encounter 
        };
        
        const { error, data } = await supabase
          .from('encounters')
          .insert([finalPayload])
          .select();

        await supabase.from('activity_logs').insert([{
          staff_id: userProfile.id || 'SYSTEM',
          action: 'REGISTRASI_BARU',
          description: `Mendaftarkan antrean ${queue} untuk pasien ${patient?.full_name || guestName}`
        }]);

        if (error) {
          if (error.code === '23505' && retryCount < 5) {
            return executeProses(retryCount + 1);
          }
          throw error;
        }
        
        alert(`Registrasi Berhasil!\nNo. Antrean: ${queue}\nNo. Rawat: ${encounter}`);
      }

      setPatient(null);
      setGuestName('');
      setTtv({ tensi: '', suhu: '', alergi: '', keluhan: '' });
      setSelectedItems([]);
      setEditingEncounterId(null);
      setSelectedRoomId('');
      fetchTodayRegistrations();
    } catch (err) {
      if (err.message?.includes('row-level security policy')) {
        alert("Gagal Memproses: Izin akses database ditolak (RLS) untuk tabel 'encounters'.\n\nPastikan Anda sudah menjalankan SQL Policy di Dashboard Supabase agar tabel ini bisa diisi.");
      } else {
        alert("Gagal memproses registrasi: " + err.message);
      }
    }
    };

    executeProses();
  };

  const handleCancelRegistration = async (reg) => {
    const reason = window.prompt(`Batalkan antrean untuk ${reg.patients?.full_name}?\nKetik alasan pembatalan:`);
    
    if (reason === null) return;
    if (!reason.trim()) return alert("Alasan pembatalan wajib diisi!");

    try {
      const { error } = await supabase
        .from('encounters')
        .update({
          status: 'cancelled',
          ttv_data: {
            ...reg.ttv_data,
            cancel_reason: reason
          }
        })
        .eq('id', reg.id);

      if (error) throw error;
      fetchTodayRegistrations();
    } catch (err) {
      alert("Gagal membatalkan antrean: " + err.message);
    }
  };

  const handleRemoveItem = (index) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="p-4 text-white shadow-md" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl active:scale-90 transition-transform">←</button>
            <div>
              <h2 className="font-bold leading-tight">Registrasi & TTV</h2>
              <p className="text-[9px] opacity-80 uppercase tracking-tighter">{userProfile.name || 'Staff'} • {dateTime.toLocaleTimeString('id-ID')}</p>
            </div>
          </div>
          <div className="text-right text-[10px] font-bold opacity-90">
            {dateTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 1. Pencarian Pasien */}
        <div className={`bg-white p-4 rounded-lg shadow-sm border-2 transition-all ${editingEncounterId ? 'border-orange-400' : 'border-transparent'}`}>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-bold">
              {editingEncounterId ? '📋 Mode Edit Antrean' : 'Cari Pasien (Nama/NIK/RM)'}
            </label>
            {editingEncounterId && <button onClick={() => {setEditingEncounterId(null); setPatient(null);}} className="text-[10px] text-red-500 font-bold">BATAL EDIT</button>}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              disabled={!!editingEncounterId}
              className="flex-1 p-3 border rounded-lg outline-none focus:ring-1"
              style={{ borderColor: theme.primaryColor }}
              placeholder="Masukkan keyword..."
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
              onClick={handleSearch}
              disabled={isLoading}
              className="px-6 py-2 text-white rounded-lg font-bold" 
              style={{ backgroundColor: theme.primaryColor }}
            >
              {isLoading ? '...' : 'Cari'}
            </button>
          </div>
        </div>

        {/* Hasil Pencarian */}
        {searchResults.length > 0 && !patient && (
          <div className="bg-white p-4 rounded-lg shadow-sm space-y-2 border-2 border-yellow-400 animate-fadeIn">
            <p className="text-xs font-bold text-yellow-600 uppercase italic">Pilih pasien:</p>
            <div className="divide-y max-h-40 overflow-y-auto">
              {searchResults.map((p) => (
                <div 
                  key={p.id} 
                  onClick={() => {
                    setPatient(p);
                    setSearchResults([]);
                  }}
                  className="py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center px-1"
                >
                  <div>
                    <p className="font-bold text-sm text-gray-800">{p.full_name}</p>
                    <p className="text-[10px] text-gray-500 uppercase">RM: {p.rm_number} | NIK: {p.nik}</p>
                  </div>
                  <span className="text-blue-500 font-bold text-[10px] uppercase border border-blue-200 px-2 py-1 rounded">Pilih</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Pasien Terpilih */}
        {patient && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-green-600 uppercase">Pasien Ditemukan</p>
                <h4 className="font-black text-gray-800">{patient.full_name}</h4>
                <p className="text-xs text-gray-500">NIK: {patient.nik} | RM: {patient.rm_number} | WA: {patient.phone_number || 'Tidak ada'}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => setPatient(null)} className="text-[10px] font-bold text-red-500 underline uppercase">Ganti</button>
                <button 
                  onClick={() => navigate('/input-pasien', { state: { patientData: patient } })}
                  className="text-[10px] font-bold text-blue-600 border border-blue-200 px-2 py-1 rounded bg-white"
                >EDIT DATA</button>
              </div>
            </div>
          </div>
        )}

        {/* Info Guest (Pembelian) */}
        {!patient && tujuan === 'Pembelian' && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 animate-fadeIn">
            <p className="text-[10px] font-bold text-blue-600 uppercase">Pembelian Tanpa RM</p>
            <input 
              type="text"
              placeholder="Ketik Nama Pembeli..."
              className="w-full mt-2 p-3 border rounded-xl text-sm outline-none focus:ring-1"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          </div>
        )}

        {/* 2. Input TTV Dasar */}
        {tujuan !== 'Pembelian' && (
        <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
          <h3 className="font-bold border-b pb-2">Tanda-Tanda Vital (TTV)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs">Tensi (mmHg)</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded" 
                placeholder="120/80"
                value={ttv.tensi}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9/]/g, '');
                  if (val.length === 3 && ttv.tensi.length === 2) {
                    val += '/';
                  }
                  setTtv({ ...ttv, tensi: val });
                }}
              />
            </div>
            <div>
              <label className="text-xs">Suhu (°C)</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded" 
                placeholder="36.5"
                value={ttv.suhu}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9.]/g, '');
                  if (val.length === 2 && ttv.suhu.length === 1) {
                    val += '.';
                  }
                  setTtv({ ...ttv, suhu: val });
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs">Alergi</label>
            <input 
              type="text" 
              className="w-full p-2 border rounded" 
              placeholder="Alergi obat/makanan"
              value={ttv.alergi}
              onChange={(e) => setTtv({...ttv, alergi: e.target.value})}
            />
          </div>
          <div>
            <label className="text-xs">Keluhan Utama</label>
            <textarea 
              className="w-full p-2 border rounded" 
              rows="2"
              value={ttv.keluhan}
              onChange={(e) => setTtv({...ttv, keluhan: e.target.value})}
            ></textarea>
          </div>
        </div>
        )}

        {/* 3. Pilihan Tujuan & Pop-up Layanan */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <label className="block text-sm font-bold mb-3">Tujuan Kedatangan</label>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['Konsultasi', 'Terapis', 'Pembelian'].map((opt) => (
              <button
                key={opt}
                onClick={() => setTujuan(opt)}
                className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${
                  tujuan === opt 
                  ? 'text-white border-transparent' 
                  : 'text-gray-400 border-gray-100 bg-gray-50'
                }`}
                style={tujuan === opt ? { backgroundColor: theme.primaryColor } : {}}
              >
                {opt === 'Konsultasi' ? '🩺 Dokter' : (opt === 'Terapis' ? '✨ Terapis' : '🛍️ Produk')}
              </button>
            ))}
          </div>

          {tujuan !== 'Pembelian' && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">
                Pilih {tujuan === 'Konsultasi' ? 'Dokter' : 'Terapis'}
              </label>
              <select 
                className="w-full p-3 border rounded-xl mt-1 bg-white outline-none text-sm shadow-sm"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="">-- Pilih Nama --</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">
                Plot Ruangan
              </label>
              <select 
                className="w-full p-3 border rounded-xl mt-1 bg-white outline-none text-sm shadow-sm"
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
              >
                <option value="">-- Pilih Ruangan --</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          )}

          <button 
            onClick={() => setShowModal(true)}
            className="w-full py-3 border-2 border-dashed rounded-lg font-bold"
            style={{ color: theme.primaryColor, borderColor: theme.primaryColor }}
          >
            + Pilih Produk / Treatment
          </button>
          
          {/* List item dipilih */}
          <div className="mt-3 space-y-2">
            {selectedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded border border-gray-100 animate-fadeIn">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-700">{item.name}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-gray-800">Rp {item.selling_price?.toLocaleString()}</span>
                  <button 
                    onClick={() => handleRemoveItem(idx)}
                    className="text-red-500 bg-red-50 p-1.5 rounded-lg active:scale-90 transition-all"
                    title="Hapus Item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. List Registrasi Hari Ini */}
        <div className="mt-8 space-y-3">
          <h3 className="font-black text-gray-400 text-xs uppercase tracking-widest">Antrean Terdaftar Hari Ini</h3>
          {todayRegistrations.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-xs italic bg-white rounded-xl border border-dashed">Belum ada pasien terdaftar hari ini</p>
          ) : (
            <div className="space-y-2">
              {todayRegistrations.map((reg) => (
                <div key={reg.id} className={`bg-white p-3 rounded-xl shadow-sm border-l-4 flex justify-between items-start transition-opacity ${reg.status === 'cancelled' ? 'opacity-60 bg-gray-50' : ''}`} 
                     style={{ borderLeftColor: reg.status === 'cancelled' ? '#9CA3AF' : (reg.ttv_data?.tujuan_layanan === 'Konsultasi' ? '#3B82F6' : theme.primaryColor) }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded font-black">{reg.queue_number}</span>
                      <span className="text-[9px] font-mono">{reg.encounter_number}</span>
                    </div>
                    <h4 className="font-bold text-sm text-gray-800">{reg.patients?.full_name || reg.ttv_data?.guest_name || 'Pelanggan Umum'}</h4>
                    <p className="text-[10px] text-gray-500 font-mono italic">{reg.ttv_data?.tujuan_layanan || 'Layanan'}: {reg.staff?.name || 'Belum ditugaskan'}</p>
                    <p className="text-[10px] text-gray-500 font-mono">RM: {reg.patients?.rm_number} | Pukul: {new Date(reg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    {reg.status === 'cancelled' && (
                      <p className="text-[10px] text-red-500 mt-1 italic font-medium">Batal: {reg.ttv_data?.cancel_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${reg.status === 'cancelled' ? 'bg-gray-200 text-gray-500' : 
                      reg.ttv_data?.tujuan_layanan === 'Konsultasi' ? 'bg-blue-100 text-blue-600' : 'bg-opacity-20 text-current'}`} style={reg.status !== 'cancelled' && reg.ttv_data?.tujuan_layanan !== 'Konsultasi' ? { backgroundColor: theme.primaryColor + '33', color: theme.primaryColor } : {}}>
                      {reg.ttv_data?.tujuan_layanan}
                    </span>
                    {reg.status !== 'cancelled' && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleEditRegistration(reg)}
                          className="text-[10px] font-bold text-orange-500 border border-orange-200 px-2 py-0.5 rounded-md hover:bg-orange-50"
                        >EDIT</button>
                        <button 
                          onClick={() => handlePrint(reg)}
                          className="text-[10px] font-bold text-blue-500 border border-blue-200 px-2 py-0.5 rounded-md hover:bg-blue-50" title="Print 58mm"
                        >🖨️</button>
                        <button 
                          onClick={() => handleWhatsApp(reg)}
                          className="text-[10px] font-bold text-green-600 border border-green-200 px-2 py-0.5 rounded-md hover:bg-green-50" title="Kirim WA"
                        >📱</button>
                        <button 
                          onClick={() => handleCancelRegistration(reg)}
                          className="text-[10px] font-bold text-red-500 border border-red-200 px-2 py-0.5 rounded-md hover:bg-red-50"
                        >BATAL</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL POP-UP (List Produk/Treatment) */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Daftar Produk & Treatment</h3>
              <button onClick={() => setShowModal(false)} className="text-red-500 font-bold">Tutup</button>
            </div>

            <div className="space-y-3 mb-4">
              <input 
                type="text"
                placeholder="Cari nama produk/tindakan..."
                className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-1"
                style={{ borderColor: theme.primaryColor }}
                onChange={(e) => setSearchTermLayanan(e.target.value)}
              />
              {tujuan !== 'Pembelian' && (
              <div className="flex gap-2">
                {['Semua', 'Produk', 'Treatment', 'Jasa'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`flex-1 py-1.5 rounded-full text-[10px] font-bold border transition-all ${filterType === t ? 'text-white border-transparent' : 'text-gray-400 border-gray-200'}`}
                    style={filterType === t ? { backgroundColor: theme.primaryColor } : {}}
                  >
                    {t}
                  </button>
                ))}
              </div>
              )}
            </div>

            <div className="space-y-6 overflow-y-auto flex-1 pb-4 pr-1">
              {['Treatment', 'Produk', 'Jasa'].filter(t => filterType === 'Semua' || filterType === t).map(groupType => (
                <div key={groupType} className="space-y-3">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-1">{groupType}</h4>
                  {services
                    .filter(item => {
                      const itemType = item.type?.trim().toLowerCase() || 'jasa'; // Fallback ke jasa jika null
                      return (itemType === groupType.toLowerCase()) && 
                      (item.name?.toLowerCase().includes(searchTermLayanan.toLowerCase()))
                    })
                    .map((item) => {
                      const isSelected = selectedItems.some(s => s.id === item.id);
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => {
                            if (isSelected) {
                              setSelectedItems(selectedItems.filter(s => s.id !== item.id));
                            } else {
                              setSelectedItems([...selectedItems, item]);
                            }
                          }}
                          className={`p-3 border rounded-xl cursor-pointer flex justify-between items-center transition-all ${isSelected ? 'shadow-sm' : 'hover:bg-gray-50'}`}
                          style={isSelected ? { borderColor: theme.primaryColor, backgroundColor: theme.primaryColor + '0D' } : {}}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'text-white' : 'border-gray-300'}`} style={isSelected ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor } : {}}>
                              {isSelected && <span className="text-[10px]">✓</span>}
                            </div>
                            <div>
                              <p className="text-[9px] font-mono text-gray-400 leading-none mb-1">{item.code}</p>
                              <p className="font-bold text-sm text-gray-800 leading-tight">{item.name}</p>
                              {item.type === 'Produk' && (
                                <p className={`text-[9px] font-bold mt-0.5 ${item.stock <= 5 ? 'text-red-500' : 'text-green-600'}`}>Stok: {item.stock}</p>
                              )}
                            </div>
                          </div>
                          <p className="font-black text-green-600 text-xs">Rp {item.selling_price?.toLocaleString()}</p>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>

            <button 
              onClick={() => setShowModal(false)}
              className="w-full py-3 text-white rounded-xl font-bold mt-4 shadow-lg active:scale-95 transition-transform"
              style={{ backgroundColor: theme.primaryColor }}
            >
              SELESAI PILIH
            </button>
          </div>
        </div>
      )}

      {/* Button Simpan Registrasi */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <button 
          onClick={handleProses}
          className="w-full py-4 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-transform" 
          style={{ backgroundColor: theme.primaryColor }}
        >
          {editingEncounterId ? 'SIMPAN PERUBAHAN' : (tujuan === 'Pembelian' ? 'PROSES KE KASIR' : 'PROSES KE KONSULTASI / TERAPIS')}
        </button>
      </div>

      {/* Modal Preview Struk Antrean (Seirama dengan Kasir) */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[110] flex flex-col items-center justify-center p-4 no-print">
          <div className="bg-gray-200 p-1 rounded-lg shadow-2xl mb-6 overflow-hidden printable-area" style={{ width: '58mm' }}>
            <div className="bg-white shadow-inner">
              {/* Komponen cetak dirender di sini untuk preview */}
              <QueuePrint ref={printRef} queueData={printData} /> 
            </div>
          </div>
          
          <div className="flex gap-3 w-full max-w-[58mm]">
            <button 
              onClick={() => setShowPrintModal(false)}
              className="flex-1 py-3 bg-white text-gray-700 rounded-xl font-bold text-sm uppercase active:scale-95 transition-transform"
            >Batal</button>
            <button 
              onClick={() => handleWhatsApp()}
              className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm uppercase shadow-lg active:scale-95 transition-transform"
            >📱 WA</button>
            <button 
              onClick={handlePrintQueue}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm uppercase shadow-lg active:scale-95 transition-transform"
            >Cetak</button>
          </div>
          <p className="text-white text-[10px] mt-4 opacity-50 uppercase tracking-widest font-bold">Pratinjau Antrean 58mm</p>
        </div>
      )}
    </div>
  );
};

export default Registrasi;
