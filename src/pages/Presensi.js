import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { supabase, dbUploadFile } from '../configs/database';
import { useNavigate } from 'react-router-dom';
import { MapPin, LogIn, LogOut, Clock, Camera, CheckCircle2, Navigation } from 'lucide-react';

const Presensi = () => {
  const theme = useContext(ThemeContext);
  const user = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const [distance, setDistance] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState({ in: null, out: null });
  const [selfie, setSelfie] = useState({ preview: null, file: null });
  const [gpsStatus, setGpsStatus] = useState('checking'); // 'checking', 'active', 'denied'
  const navigate = useNavigate();

  const calculateDistance = (lat1, lon1, lat2, lng2) => {
    const R = 6371e3; // Radius bumi dalam meter
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    fetchTodayStatus();
    requestGpsAccess();
  }, []);

  const requestGpsAccess = () => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }

    setGpsStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsStatus('active');
        // Sekalian update jarak jika sudah ada koordinat
        checkCurrentDistance(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setGpsStatus('denied');
        console.error("GPS Error:", err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const checkCurrentDistance = async (lat, lng) => {
    const { data: stg } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (stg) {
      const dist = calculateDistance(lat, lng, stg.clinic_lat, stg.clinic_lng);
      setDistance(dist);
    }
  };

  const fetchTodayStatus = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('staff_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`);
    
    if (data) {
      const checkIn = data.find(d => d.type === 'IN');
      const checkOut = data.find(d => d.type === 'OUT');
      setTodayRecord({ in: checkIn, out: checkOut });
    }
  };

  const handleCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelfie({ preview: URL.createObjectURL(file), file: file });
    }
  };

  const handleAbsen = async (type) => {
    if (!selfie.file) return alert("Wajib ambil foto selfie untuk verifikasi!");
    if (type === 'IN' && todayRecord.in) return alert("Anda sudah absen masuk hari ini!");
    if (type === 'OUT' && todayRecord.out) return alert("Anda sudah absen pulang hari ini!");

    setIsLoading(true);
    
    const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      
      // Proteksi Mock GPS / Akurasi Rendah
      if (accuracy > 150) {
        setIsLoading(false);
        return alert("Sinyal GPS lemah atau tidak akurat. Harap matikan Fake GPS atau pindah ke area terbuka.");
      }

      // Ambil settings lokasi klinik
      const { data: stg } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      const dist = calculateDistance(latitude, longitude, stg.clinic_lat, stg.clinic_lng);
      setDistance(dist);

      if (dist > stg.attendance_radius) {
        alert(`Gagal! Anda berada ${Math.round(dist)}m dari klinik. Maksimal radius: ${stg.attendance_radius}m`);
        setIsLoading(false);
        return;
      }

      try {
        // Upload Selfie ke Storage
        const fileName = `attendance/${user.id}_${type}_${Date.now()}.jpg`;
        const photoUrl = await dbUploadFile('medical-records', fileName, selfie.file);

        const { error } = await supabase.from('attendance').insert([{
          staff_id: user.id,
          type: type,
          lat: latitude,
          lng: longitude,
          distance_from_center: dist,
          accuracy: accuracy,
          photo_url: photoUrl
        }]);

        if (error) throw error;

        // Audit Trail
        await supabase.from('activity_logs').insert([{
          staff_id: user.id,
          action: `ABSEN_${type}`,
          description: `${user.name} melakukan absen ${type} pada jarak ${Math.round(dist)}m (Akurasi: ${Math.round(accuracy)}m)`
        }]);

        alert(`Absen ${type} Berhasil!`);
        setSelfie({ preview: null, file: null });
        fetchTodayStatus();
      } catch (err) {
        alert("Gagal memproses data: " + err.message);
      }

      setIsLoading(false);
    }, (err) => {
      alert("Harap aktifkan GPS Anda!");
      setIsLoading(false);
    }, options);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="p-6 text-white rounded-b-[3rem] shadow-xl" style={{ backgroundColor: theme.primaryColor }}>
        <h2 className="text-center font-black uppercase tracking-widest text-lg">Absensi Digital</h2>
        <div className="mt-8 flex flex-col items-center">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 mb-4">
            <Clock size={40} className="animate-pulse" />
          </div>
          <p className="font-bold text-xl">{user.name}</p>
          <p className="text-xs opacity-70 uppercase tracking-widest">{user.role}</p>
        </div>
      </div>

      <div className="p-6 -mt-10 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-xl space-y-6 text-center border border-gray-100">
          
          {/* GPS Status Indicator */}
          <div className="flex justify-center">
            <div 
              onClick={requestGpsAccess}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all active:scale-95 ${
                gpsStatus === 'active' ? 'bg-green-100 text-green-600' : 
                gpsStatus === 'denied' ? 'bg-red-50 text-red-600 border border-red-100' : 
                'bg-gray-100 text-gray-400'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${gpsStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-current'}`} />
              {gpsStatus === 'active' ? 'GPS Aktif & Terdeteksi' : gpsStatus === 'denied' ? 'GPS Mati / Izin Ditolak (Klik Cek Ulang)' : 'Mencari Sinyal GPS...'}
            </div>
          </div>
          
          {/* Area Verifikasi Foto */}
          <div className="flex flex-col items-center gap-3">
            <label className="relative cursor-pointer group">
              <div className="w-32 h-32 bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center transition-all group-active:scale-95">
                {selfie.preview ? (
                  <img src={selfie.preview} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-400 flex flex-col items-center">
                    <Camera size={32} />
                    <span className="text-[10px] font-bold mt-1 uppercase">Ambil Selfie</span>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleCapture} />
              {selfie.preview && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white p-1 rounded-full shadow-lg">
                  <CheckCircle2 size={16} />
                </div>
              )}
            </label>
            <p className="text-[10px] text-gray-400 font-bold uppercase italic tracking-tighter">Wajib Foto Wajah Terbaru Sebelum Absen</p>
          </div>

          <div className="flex justify-around gap-4">
            <button 
              disabled={isLoading || !!todayRecord.in}
              onClick={() => handleAbsen('IN')}
              className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all active:scale-95 ${todayRecord.in ? 'bg-gray-50 border-gray-100' : 'bg-green-50 border-green-100'}`}
            >
              <div className={`p-3 rounded-2xl shadow-lg ${todayRecord.in ? 'bg-gray-300 text-white' : 'bg-green-500 text-white shadow-green-200'}`}>
                <LogIn size={24} />
              </div>
              <div className="flex flex-col">
                <span className={`font-black text-xs uppercase ${todayRecord.in ? 'text-gray-400' : 'text-green-700'}`}>Masuk</span>
                {todayRecord.in && <span className="text-[8px] font-mono font-bold text-green-600">{new Date(todayRecord.in.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
              </div>
            </button>

            <button 
              disabled={isLoading || !todayRecord.in || !!todayRecord.out}
              onClick={() => handleAbsen('OUT')}
              className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all active:scale-95 ${(!todayRecord.in || todayRecord.out) ? 'bg-gray-50 border-gray-100' : 'bg-red-50 border-red-100'}`}
            >
              <div className={`p-3 rounded-2xl shadow-lg ${(!todayRecord.in || todayRecord.out) ? 'bg-gray-300 text-white' : 'bg-red-500 text-white shadow-red-200'}`}>
                <LogOut size={24} />
              </div>
              <div className="flex flex-col">
                <span className={`font-black text-xs uppercase ${(!todayRecord.in || todayRecord.out) ? 'text-gray-400' : 'text-red-700'}`}>Pulang</span>
                {todayRecord.out && <span className="text-[8px] font-mono font-bold text-red-600">{new Date(todayRecord.out.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
              </div>
            </button>
          </div>

          <div className="pt-4 flex items-center justify-center gap-2 text-gray-400">
            <MapPin size={14} />
            <p className="text-[10px] font-bold uppercase italic">
              {distance ? `Jarak Anda: ${Math.round(distance)} meter dari klinik` : 'Pastikan GPS Aktif'}
            </p>
          </div>
        </div>

        <div className="bg-blue-600 p-4 rounded-2xl text-white text-center shadow-lg">
           <p className="text-[10px] font-bold uppercase opacity-80 mb-1">Status Kehadiran</p>
           <p className="text-sm font-black">
             {user.work_shift && Array.isArray(user.work_shift) && user.work_shift.length > 0 
                ? `Jadwal: ${user.work_shift.join(' & ')}`
                : 'Jadwal: Belum Diatur'}
           </p>
        </div>
      </div>
      
      <button onClick={() => window.history.back()} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-8 py-3 rounded-full font-bold text-xs uppercase shadow-2xl">Kembali</button>
    </div>
  );
};

export default Presensi;