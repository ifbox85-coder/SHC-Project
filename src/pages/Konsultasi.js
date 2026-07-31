import React, { useState, useEffect, useRef, useContext } from 'react';
import { useReactToPrint } from 'react-to-print';
import QueuePrint from '../components/QueuePrint';
import { ThemeContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { supabase, dbUploadFile } from '../configs/database';
import AreaMapper from '../components/AreaMapper';

const getStoredUserProfile = () => {
  try {
    return JSON.parse(localStorage.getItem('user_profile') || '{}') || {};
  } catch (error) {
    return {};
  }
};

const Konsultasi = () => {
  const theme = useContext(ThemeContext);
  const [queue, setQueue] = useState([]);
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [foto, setFoto] = useState({ 
    depan: { preview: null, file: null }, 
    kanan: { preview: null, file: null }, 
    kiri: { preview: null, file: null } 
  });
  const [showLayanan, setShowLayanan] = useState(false);
  const [terpilih, setTerpilih] = useState([]);
  const [diagnosa, setDiagnosa] = useState('');
  const [pemeriksaanFisik, setPemeriksaanFisik] = useState('');
  const [skinData, setSkinData] = useState({
    type: '',
    moisture: 50,
    oil: 50,
    elasticity: 50,
    pigmentation: 50
  });
  const [clinicalMapping, setClinicalMapping] = useState([]);
  const [nextControlDate, setNextControlDate] = useState('');
  const [instruksiTerapis, setInstruksiTerapis] = useState('');
  const [services, setServices] = useState([]);
  const [diagnosisList, setDiagnosisList] = useState([]);
  const [searchTermDiagnosis, setSearchTermDiagnosis] = useState('');
  const [searchLayanan, setSearchLayanan] = useState('');
  const [filterType, setFilterType] = useState('Semua');
  const [terapis, setTerapis] = useState('');
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [patientHistory, setPatientHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const [printData, setPrintData] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const printRef = useRef(); 

  const handlePrintQueue = useReactToPrint({
    content: () => printRef.current,
    onAfterPrint: () => setShowPrintModal(false),
    documentTitle: 'Nomor Antrean Tindakan',
    removeAfterPrint: false
  });
  
  // State untuk Annotation Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState(null); 
  const [brushColor, setBrushColor] = useState('#ff0000');
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const [userProfile] = useState(() => getStoredUserProfile());

  useEffect(() => {
    if (!selectedEncounter) {
      setShowHistoryModal(false);
      setPatientHistory([]);
    }
  }, [selectedEncounter]);

  const handleCapture = (posisi, e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto((prev) => {
        if (prev[posisi]?.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(prev[posisi].preview);
        }
        return {
          ...prev,
          [posisi]: { preview: URL.createObjectURL(file), file }
        };
      });
    }
  };

  const handleDeleteFoto = (posisi, e) => {
    e.stopPropagation();
    if (window.confirm(`Hapus foto ${posisi} dan ambil ulang?`)) {
      setFoto((prev) => {
        if (prev[posisi]?.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(prev[posisi].preview);
        }
        return { ...prev, [posisi]: { preview: null, file: null } };
      });
    }
  };

  const openEditor = (posisi) => {
    if (!foto[posisi].preview) return;
    setEditorTarget(posisi);
    setEditorOpen(true);
    setTimeout(() => initCanvas(foto[posisi].preview), 100);
  };

  const initCanvas = (imageSrc) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 10;
    };
  };

  const startDrawing = (e) => { isDrawing.current = true; draw(e); };
  const stopDrawing = () => { isDrawing.current = false; canvasRef.current?.getContext('2d')?.beginPath(); };
  const draw = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.clientX || e.touches[0].clientX) - rect.left) * scaleX;
    const y = ((e.clientY || e.touches[0].clientY) - rect.top) * scaleY;
    ctx.strokeStyle = brushColor;
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
  };

  const saveAnnotation = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/jpeg');
    fetch(dataUrl).then(res => res.blob()).then(blob => {
      const file = new File([blob], `annotated_${editorTarget}.jpg`, { type: 'image/jpeg' });
      setFoto((prev) => ({
        ...prev,
        [editorTarget]: { preview: dataUrl, file }
      }));
      setEditorOpen(false);
    });
  };

  const [listTerapis, setListTerapis] = useState([]);

  useEffect(() => {
    const fetchTerapis = async () => {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('role', 'therapist')
        .eq('is_active', true);
      if (data) setListTerapis(data);
    };
    fetchTerapis();
  }, []);

  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (data) setRooms(data);
    };
    fetchRooms();
  }, []);

  // Fetch data dari tabel diagnosis yang baru
  useEffect(() => {
    const fetchDiagnoses = async () => {
      const { data, error } = await supabase
        .from('diagnosis')
        .select('*')
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('name', { ascending: true });
      
      if (error) { }
      if (data) setDiagnosisList(data);
    };
    fetchDiagnoses();
  }, []);

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from('services')
        .select('*')
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('name', { ascending: true });
      if (data) {
        setServices(data);
      }
    };
    fetchServices();
  }, []);

  // Sinkronisasi data dari registrasi saat pasien dipilih
  useEffect(() => {
    if (selectedEncounter) {
      const baseItems = Array.isArray(selectedEncounter.ttv_data?.items) ? selectedEncounter.ttv_data.items : [];
      const hasConsul = baseItems.some((i) => String(i?.name || '').toLowerCase().includes('konsultasi'));
      
      // Tambahkan Jasa Konsultasi Otomatis jika belum ada di daftar belanja
      if (!hasConsul) {
        // Mencari tarif dari Master Data (services) jika sudah diinput
        const consulMaster = services.find(s => s.name.toLowerCase().includes('konsultasi'));
        const consulItem = { 
          ...(consulMaster || {}), // Memastikan metadata fee (therapist_fee, dll) terbawa dari Master Data
          id: consulMaster?.id || 'jasa-konsul', 
          name: consulMaster?.name || 'Jasa Konsultasi Dokter', 
          selling_price: consulMaster?.selling_price || 50000, // Harga default jika di master belum ada
          type: 'Jasa' 
        };
        setTerpilih([consulItem, ...baseItems]);
      } else {
        setTerpilih(baseItems);
      }

      setDiagnosa(selectedEncounter.ttv_data?.analisa_dokter || '');
      setPemeriksaanFisik(selectedEncounter.ttv_data?.pemeriksaan_fisik || '');
      setSkinData(selectedEncounter.ttv_data?.skin_data || {
        type: '',
        moisture: 50,
        oil: 50,
        elasticity: 50,
        pigmentation: 50
      });
      setClinicalMapping(selectedEncounter.ttv_data?.clinical_mapping || []);
      setNextControlDate(selectedEncounter.ttv_data?.next_control_date || '');
      setInstruksiTerapis(selectedEncounter.ttv_data?.instruksi_khusus || '');
      
      const initialPhotos = selectedEncounter.ttv_data?.foto_before || { depan: null, kanan: null, kiri: null };
      setFoto({
        depan: { preview: initialPhotos.depan, file: null },
        kanan: { preview: initialPhotos.kanan, file: null },
        kiri: { preview: initialPhotos.kiri, file: null }
      });
    }
  }, [selectedEncounter, services]);

  // Fetch riwayat rekam medis pasien
  const fetchPatientHistory = async (patientId, currentEncounterId = null) => {
    if (!patientId) {
      alert("ID Pasien tidak ditemukan.");
      return;
    }
    setIsLoadingHistory(true);
    try {
      let query = supabase
        .from('encounters')
        .select(`
          id, created_at, encounter_number,
          ttv_data,
          status,
          staff (name, role)
        `)
        .eq('patient_id', patientId);

      if (currentEncounterId) {
        query = query.neq('id', currentEncounterId); // Jangan tampilkan encounter yang sedang aktif
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setPatientHistory(data || []);
    } catch (err) {
      alert("Gagal memuat riwayat pasien: " + err.message);
    } finally { setIsLoadingHistory(false); }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setPatientHistory([]);
  };

  const handleShowHistory = () => {
    const patientId = selectedEncounter?.patients?.id;
    if (!patientId) {
      alert("Data pasien tidak lengkap.");
      return;
    }
    setShowHistoryModal(true);
    fetchPatientHistory(patientId, selectedEncounter?.id);
  };

  // 1. Load Antrean Pasien (Status: waiting)
  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    let query = supabase
      .from('encounters')
      .select(`
        id,
        status,
        ttv_data,
        queue_number,
        encounter_number,
        created_at,
        patients (id, full_name, rm_number, birth_date, gender)
      `)
      .eq('status', 'waiting');

    // JIKA BUKAN ADMIN: Filter berdasarkan ID Dokter yang login
    if (userProfile.role !== 'admin') {
      query = query.eq('assigned_staff_id', userProfile.id);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      // Error loading queue
    } else {
      setQueue(data || []);
    }
  };

  const handleResepSaja = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('encounters')
        .update({
          status: 'completed', // Langsung ke Kasir
          ttv_data: {
            ...selectedEncounter.ttv_data,
            analisa_dokter: diagnosa,
            pemeriksaan_fisik: pemeriksaanFisik,
            skin_data: skinData,
            clinical_mapping: clinicalMapping,
            next_control_date: nextControlDate,
            instruksi_khusus: instruksiTerapis,
            items: terpilih, // Disimpan ke 'items' agar muncul harganya di Kasir
            room_name: rooms.find(r => r.id === selectedRoom)?.name || null,
            tipe_alur: 'Resep Saja'
          }
        })
        .eq('id', selectedEncounter.id);

      if (error) throw error;
      alert("Resep disimpan! Pasien langsung diarahkan ke Kasir.");
      setSelectedEncounter(null);
      fetchQueue();
    } catch (err) {
      alert("Gagal: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTanganiSendiri = async () => {
    setIsSaving(true);
    try {
      // Generate Nomor Antrean 'A' (Tindakan)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: lastQueue } = await supabase
        .from('encounters')
        .select('queue_number').ilike('queue_number', 'A-%')
        .gte('created_at', today.toISOString()).order('queue_number', { ascending: false }).limit(1);

      let nextNum = 1;
      if (lastQueue?.[0]) nextNum = parseInt(lastQueue[0].queue_number.split('-')[1]) + 1;
      const newQueue = `A-${nextNum.toString().padStart(3, '0')}`;

      const { error } = await supabase
        .from('encounters')
        .update({
          status: 'treatment',
          assigned_staff_id: userProfile.id, // Tetap di tangan dokter
          queue_number: newQueue,
          ttv_data: {
            ...selectedEncounter.ttv_data,
            analisa_dokter: diagnosa,
            pemeriksaan_fisik: pemeriksaanFisik,
            skin_data: skinData,
            clinical_mapping: clinicalMapping,
            next_control_date: nextControlDate,
            instruksi_khusus: instruksiTerapis,
            items: terpilih, // Disimpan ke 'items' agar muncul harganya di Kasir
            room_name: rooms.find(r => r.id === selectedRoom)?.name || null,
            tipe_alur: 'Ditangani Dokter'
          }
        })
        .eq('id', selectedEncounter.id);

      if (error) throw error;
      alert(`Tindakan diambil alih dokter!\nNo. Antrean Tindakan: ${newQueue}`);
      setSelectedEncounter(null);
      fetchQueue();
    } catch (err) {
      alert("Gagal: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKirimTerapis = async () => {
    if (!diagnosa || !terapis) return alert("Mohon isi analisa dokter dan pilih terapis!");
    
    setIsSaving(true);
    try {
      // 0. Proses Upload Foto ke Supabase Storage
      const uploadedUrls = { ...selectedEncounter.ttv_data?.foto_before };
      for (const pos of ['depan', 'kanan', 'kiri']) {
        if (foto[pos].file) {
          const fileName = `${selectedEncounter.encounter_number}_before_${pos}_${Date.now()}.jpg`;
          const publicUrl = await dbUploadFile(
            'medical-records', 
            `photos/${selectedEncounter.patients?.id}/${fileName}`, 
            foto[pos].file
          );
          uploadedUrls[pos] = publicUrl;
        }
      }

      // 1. Generate Nomor Antrean Terapis Baru (Prefix 'A')
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: lastQueue } = await supabase
        .from('encounters')
        .select('queue_number')
        .ilike('queue_number', 'A-%')
        .gte('created_at', today.toISOString())
        .order('queue_number', { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (lastQueue && lastQueue.length > 0) {
        const lastParts = lastQueue[0].queue_number.split('-');
        nextNum = parseInt(lastParts[1]) + 1;
      }
      const newQueueNumber = `A-${nextNum.toString().padStart(3, '0')}`;

      // 2. Update Encounter
      const { error } = await supabase
        .from('encounters')
        .update({
          status: 'treatment',
          assigned_staff_id: terapis, // Ganti staff menjadi terapis pilihan dokter
          queue_number: newQueueNumber, // Berikan nomor antrean Terapis
          ttv_data: {
            ...selectedEncounter.ttv_data,
            analisa_dokter: diagnosa,
            pemeriksaan_fisik: pemeriksaanFisik,
            skin_data: skinData,
            clinical_mapping: clinicalMapping,
            next_control_date: nextControlDate,
            instruksi_khusus: instruksiTerapis,
            foto_before: uploadedUrls,
            items: terpilih, // Disimpan ke 'items' agar muncul harganya di Kasir
            room_id: selectedRoom,
            room_name: rooms.find(r => r.id === selectedRoom)?.name || null,
            terapis_asal_nama: listTerapis.find(t => t.id === terapis)?.name
          }
        })
        .eq('id', selectedEncounter.id);

      if (error) throw error;

      // Siapkan data untuk cetak antrean tindakan
      const printObj = {
        id: selectedEncounter.id,
        queue_number: newQueueNumber,
        encounter_number: selectedEncounter.encounter_number,
        patient_name: selectedEncounter.patients?.full_name,
        rm_number: selectedEncounter.patients?.rm_number || '',
        tujuan: 'Terapis',
        staff_name: listTerapis.find(t => t.id === terapis)?.name || 'Terapis'
      };
      setPrintData(printObj);
      setShowPrintModal(true);

      setSelectedEncounter(null);
      fetchQueue();
    } catch (err) {
      alert("Gagal mengirim data: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveItem = (index) => {
    setTerpilih((prev) => prev.filter((_, i) => i !== index));
  };

  // Jika belum pilih pasien, tampilkan daftar antrean
  if (!selectedEncounter) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-4 text-white shadow-md flex items-center" style={{ backgroundColor: theme.primaryColor }}>
          <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl">←</button>
          <h2 className="font-bold">{userProfile.role === 'admin' ? 'Semua Antrean Pasien' : `Antrean ${userProfile.name}`}</h2>
        </div>
        
        <div className="p-4 space-y-3">
          <h3 className="font-black text-gray-400 text-xs uppercase tracking-widest">Pasien Menunggu</h3>
          {queue.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-gray-400 text-sm">Tidak ada antrean saat ini</p>
              <button onClick={fetchQueue} className="mt-2 text-xs font-bold text-blue-500 underline">Refresh Antrean</button>
            </div>
          ) : (
            queue.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedEncounter(item)}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center active:scale-95 transition-transform cursor-pointer"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-black">{item.queue_number}</span>
                    <span className="text-[9px] text-gray-400 font-mono">{item.encounter_number}</span>
                  </div>
                  <h4 className="font-bold text-gray-800">{item.patients?.full_name}</h4>
                  <p className="text-[10px] text-gray-500 uppercase font-mono">RM: {item.patients?.rm_number} | Keluhan: {item.ttv_data?.keluhan || '-'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-bold">PERIKSA</span>
                  <p className="text-[8px] text-gray-400 mt-1">{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // UI Pemeriksaan (Jika pasien sudah dipilih)
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="p-4 text-white shadow-md flex justify-between items-center" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex items-center">
          <button onClick={() => setSelectedEncounter(null)} className="mr-3 text-2xl">←</button>
          <div>
            <div className="flex items-center gap-2">
               <h2 className="font-bold leading-tight">{selectedEncounter.patients?.full_name}</h2>
               <span className="bg-white text-black text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">{selectedEncounter.queue_number}</span>
            </div>
            <p className="text-[10px] opacity-80 uppercase">RM: {selectedEncounter.patients?.rm_number} | No. Rawat: {selectedEncounter.encounter_number}</p>
          </div>
        </div>
        <button
          type="button" 
          onClick={handleShowHistory}
          className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold active:scale-95 transition-transform"
        >RIWAYAT</button>
        <div className="flex flex-col items-end">
           <span className="text-[10px] bg-black bg-opacity-20 px-2 py-1 rounded uppercase font-bold">Menu Konsultasi</span>
           <p className="text-[8px] mt-1 opacity-70 italic">Digital Medical Record</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 1. Subjektif & Objektif Summary (Complaint & TTV) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-blue-500">🩺</span>
            <h3 className="font-bold text-xs uppercase text-gray-500">Anamnesis & Vital Sign</h3>
          </div>
          <p className="text-sm text-gray-700"><strong>Keluhan:</strong> {selectedEncounter.ttv_data?.keluhan || '-'}</p>
          <div className="flex gap-4 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
            <span><strong>TD:</strong> {selectedEncounter.ttv_data?.tensi || '-'} <small>mmHg</small></span>
            <span><strong>Suhu:</strong> {selectedEncounter.ttv_data?.suhu || '-'} <small>°C</small></span>
            <span className="text-red-500"><strong>Alergi:</strong> {selectedEncounter.ttv_data?.alergi || 'Tidak Ada'}</span>
          </div>
        </div>

        {/* 2. Pemeriksaan Fisik & Diagnosa (SOAP: Objective & Assessment) */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">📝</span>
              <h3 className="font-bold text-sm text-gray-700">Pemeriksaan Fisik <small className="font-normal text-gray-400">(Objektif)</small></h3>
            </div>
            <textarea 
              className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-opacity-20" 
              placeholder="Detail kondisi fisik pasien..."
              style={{ focusRingColor: theme.primaryColor }}
              rows="3"
              value={pemeriksaanFisik}
              onChange={(e) => setPemeriksaanFisik(e.target.value)}
            ></textarea>
          </div>

          <div className="space-y-2 pt-2 border-t border-dashed">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">🔍</span>
              <h3 className="font-bold text-sm text-gray-700">Diagnosa / Analisa <small className="font-normal text-gray-400">(Asesmen)</small></h3>
            </div>
            
            {/* Standard Diagnosis Picker */}
            <div className="space-y-2">
              <input 
                type="text"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-400 transition-all"
                placeholder="Cari Kode ICD-10 atau Nama (Contoh: L70.0 atau Acne...)"
                value={searchTermDiagnosis}
                onChange={(e) => setSearchTermDiagnosis(e.target.value)}
              />
              
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar py-1">
                {(diagnosisList || [])
                  .filter(d => 
                    (d.name?.toLowerCase() || "").includes(searchTermDiagnosis.toLowerCase()) || 
                    (d.code?.toLowerCase() || "").includes(searchTermDiagnosis.toLowerCase())
                  )
                  .slice(0, searchTermDiagnosis ? 10 : 8) // Batasi tampilan agar tidak terlalu panjang
                  .map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        const diagString = `[${d.code}] ${d.name}`;
                        setDiagnosa(prev => prev ? `${prev}, ${diagString}` : diagString);
                      }}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[10px] font-medium text-gray-600 hover:border-blue-400 hover:text-blue-500 transition-all active:scale-95 shadow-sm"
                    >
                      + [{d.code}] {d.name}
                    </button>
                  ))}
              </div>
            </div>

            <textarea 
              className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none font-medium bg-white" 
              placeholder="Diagnosa terpilih atau ketik analisa manual di sini..."
              style={{ borderColor: `${theme.primaryColor}40`, minHeight: '80px' }}
              value={diagnosa}
              onChange={(e) => setDiagnosa(e.target.value)}
            ></textarea>
          </div>
        </div>

        {/* 2.2 Clinical Area Mapping */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-500">📍</span>
            <h3 className="font-bold text-sm text-gray-700">Clinical Mapping <small className="font-normal text-gray-400">(Tanda Area)</small></h3>
          </div>
          <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden" style={{ height: '300px' }}>
            <AreaMapper 
              value={clinicalMapping} 
              onChange={setClinicalMapping} 
            />
          </div>
          <p className="text-[10px] text-gray-400 italic text-center">Klik pada diagram untuk menandai area bermasalah.</p>
        </div>

        {/* 2.5 Skin Quality Assessment (Supporting Examination Quality) */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-pink-500">✨</span>
            <h3 className="font-bold text-sm text-gray-700">Analisa Kulit & Elastisitas</h3>
          </div>
          
          <div className="space-y-4">
            {/* Skin Type Selection */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Jenis Kulit Pasien</label>
              <div className="flex flex-wrap gap-1.5">
                {['Dry', 'Oily', 'Normal', 'Sensitive', 'Combination'].map(type => (
                  <button 
                    key={type} 
                    onClick={() => setSkinData({ ...skinData, type })}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${skinData.type === type ? 'text-white border-transparent shadow-md' : 'text-gray-400 border-gray-100 bg-gray-50'}`}
                    style={skinData.type === type ? { backgroundColor: theme.primaryColor } : {}}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Metrics Sliders */}
            <div className="grid grid-cols-1 gap-4 pt-2">
              {[
                { id: 'moisture', label: 'Moisture / Hidrasi', icon: '💧' },
                { id: 'oil', label: 'Oil / Sebum', icon: '🛢️' },
                { id: 'elasticity', label: 'Elasticity / Kekenyalan', icon: '🧬' },
                { id: 'pigmentation', label: 'Pigmentation / Flek', icon: '☀️' },
              ].map((m) => (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase">
                    <span>{m.icon} {m.label}</span>
                    <span className="font-mono" style={{ color: theme.primaryColor }}>{skinData[m.id]}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={skinData[m.id]} 
                    onChange={(e) => setSkinData({ ...skinData, [m.id]: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                    style={{ accentColor: theme.primaryColor }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Instruksi Khusus (Planning Internal) */}
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-2">
          <div className="flex items-center gap-2">
            <span>📢</span>
            <h3 className="font-bold text-xs uppercase text-orange-700">Instruksi Khusus ke Terapis</h3>
          </div>
          <textarea 
            className="w-full p-3 border border-orange-200 rounded-xl text-sm outline-none bg-white placeholder-orange-300 text-orange-900" 
            placeholder="Contoh: Laser level 2, jangan terlalu lama di area pipi..."
            rows="2"
            value={instruksiTerapis}
            onChange={(e) => setInstruksiTerapis(e.target.value)}
          ></textarea>
        </div>

        {/* 4. Dokumentasi Foto Before */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-400">📸</span>
            <h3 className="font-bold text-sm text-gray-700">Foto Kondisi Pasien (Before)</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['depan', 'kanan', 'kiri'].map((pos) => (
              <div key={pos} className="relative h-24">
                {foto[pos].preview ? (
                  <div className="relative w-full h-full group">
                    <img src={foto[pos].preview} alt={pos} className="object-cover w-full h-full rounded-lg border-2 border-gold" onClick={() => openEditor(pos)} />
                    <div className="absolute bottom-1 right-1 flex gap-1">
                      <button type="button" onClick={() => openEditor(pos)} className="bg-black bg-opacity-60 text-white px-2 py-1 rounded text-[8px] font-bold">EDIT</button>
                      <button type="button" onClick={(e) => handleDeleteFoto(pos, e)} className="bg-red-600 bg-opacity-80 text-white px-2 py-1 rounded text-[8px] font-bold">HAPUS</button>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed rounded-lg w-full h-full flex flex-col items-center justify-center cursor-pointer bg-gray-50">
                    <span className="text-[10px] text-gray-400 uppercase">{pos}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCapture(pos, e)} />
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Tindak Lanjut & Pilih Terapis */}
        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <h3 className="font-bold border-b pb-2 text-sm">Resep & Rencana Tindakan</h3>
          
          {/* List item yang dipilih (dari registrasi + tambahan dokter) */}
          <div className="space-y-2">
            {terpilih.length === 0 && <p className="text-xs text-gray-400 italic">Belum ada resep/tindakan dipilih.</p>}
            {terpilih.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded border border-gray-100">
                <div>
                  <p className="font-medium text-gray-700">{item.name}</p>
                  <p className="text-[10px] text-gray-400 uppercase">{item.type}</p>
                </div>
                <button 
                  onClick={() => handleRemoveItem(idx)}
                  className="text-red-500 p-1 hover:bg-red-50 rounded"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setShowLayanan(true)}
            className="w-full py-3 rounded-xl font-bold border-2 transition-colors active:bg-gray-50"
            style={{ color: theme.primaryColor, borderColor: theme.primaryColor }}
          >
            + Input Resep / Tindakan
          </button>

          <div className="pt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-400 text-[10px]">👩‍⚕️</span>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Terapis</label>
              </div>
              <select 
                className="w-full p-3 border border-gray-200 rounded-xl mt-1 bg-white text-xs outline-none appearance-none shadow-sm"
                value={terapis}
                onChange={(e) => setTerapis(e.target.value)}
              >
                <option value="">-- Pilih Terapis --</option>
                {listTerapis.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-400 text-[10px]">🏢</span>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Ruangan</label>
              </div>
              <select 
                className="w-full p-3 border border-gray-200 rounded-xl mt-1 bg-white text-xs outline-none appearance-none shadow-sm"
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
              >
                <option value="">-- Pilih Ruangan --</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 6. Planning: Next Visit */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-400">📅</span>
            <h3 className="font-bold text-sm text-gray-700">Rencana Kontrol Selanjutnya</h3>
          </div>
          <input 
            type="date" 
            className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none"
            value={nextControlDate}
            onChange={(e) => setNextControlDate(e.target.value)}
          />
          <p className="text-[10px] text-gray-400">Saran dokter untuk waktu kunjungan kembali pasien.</p>
        </div>

        {/* 5. Persetujuan Tindakan (Digital Signature) */}
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" className="mt-1" />
            <span className="text-xs text-yellow-800">Pasien menyetujui tindakan medis dan penggunaan produk yang telah dijelaskan oleh dokter.</span>
          </label>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t flex flex-col gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="flex gap-2">
          <button 
            onClick={handleResepSaja}
            disabled={isSaving || terpilih.some(i => i.type === 'Treatment')}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${terpilih.some(i => i.type === 'Treatment') ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}
          >
            RESEP SAJA
          </button>
          <button 
            onClick={handleTanganiSendiri}
            disabled={isSaving || !terpilih.some(i => i.type === 'Treatment')}
            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${!terpilih.some(i => i.type === 'Treatment') ? 'bg-gray-100 text-gray-400' : 'bg-orange-100 text-orange-600'}`}
          >
            TANGANI SENDIRI
          </button>
        </div>
        <button 
          onClick={handleKirimTerapis}
          disabled={isSaving || !terpilih.some(i => i.type === 'Treatment')}
          className={`w-full py-4 rounded-xl text-white font-bold shadow-lg ${(!terpilih.some(i => i.type === 'Treatment') || isSaving) ? 'bg-gray-300' : ''}`}
          style={(!terpilih.some(i => i.type === 'Treatment') || isSaving) ? {} : { backgroundColor: theme.primaryColor }}
        >
          {isSaving ? 'MEMPROSES...' : 'KIRIM KE RUANG TINDAKAN'}
        </button>
      </div>

      {/* Modal Layanan (Re-use dari Menu 3 Logic) */}
      {showLayanan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-4 z-50">
           <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">Tambah Produk/Treatment</h3>
                <button onClick={() => setShowLayanan(false)} className="text-gray-400 text-2xl">&times;</button>
              </div>
              
              <div className="mb-4 space-y-2">
                <input 
                  type="text"
                  placeholder="Cari..."
                  className="w-full p-2 border rounded-lg text-sm outline-none"
                  onChange={(e) => setSearchLayanan(e.target.value)}
                />
                <div className="flex gap-1">
                  {['Semua', 'Produk', 'Treatment', 'Jasa'].map(t => (
                    <button key={t} onClick={() => setFilterType(t)} className={`flex-1 text-[9px] py-1 rounded border ${filterType === t ? 'bg-gold text-white' : 'text-gray-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6 overflow-y-auto flex-1 pb-4 pr-1">
                {['Treatment', 'Produk', 'Jasa'].filter(t => filterType === 'Semua' || filterType === t).map(groupType => (
                  <div key={groupType} className="space-y-3">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-1">{groupType}</h4>
                    {services
                      .filter(item => {
                        const itemType = item.type?.trim().toLowerCase() || '';
                        return (itemType === groupType.toLowerCase()) && 
                               (item.name?.toLowerCase().includes(searchLayanan.toLowerCase()));
                      })
                      .map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          setTerpilih((prev) => [...prev, item]);
                          setShowLayanan(false);
                        }}
                        className="p-3 border rounded-xl hover:bg-gray-50 cursor-pointer flex justify-between items-center transition-all"
                      >
                        <div>
                          <p className="font-bold text-sm">{item.name}</p>
                          <div className="flex gap-2">
                            <p className="text-[9px] text-gray-400 uppercase font-bold">{item.type}</p>
                            {item.type === 'Produk' && <p className="text-[9px] text-blue-500 font-bold italic">Stok: {item.stock}</p>}
                          </div>
                        </div>
                        <p className="text-xs font-bold text-green-600">Rp {item.selling_price?.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <button onClick={() => setShowLayanan(false)} className="w-full py-2 bg-gray-100 rounded-lg mt-4 font-bold">Selesai</button>
           </div>
        </div>
      )}

      {/* Modal Riwayat Pasien */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[105] bg-black bg-opacity-70 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">Riwayat Rekam Medis</h3>
                <p className="text-[10px] text-gray-500">
                  {selectedEncounter?.patients?.full_name} • {selectedEncounter?.patients?.rm_number}
                </p>
              </div>
              <button
          onClick={closeHistoryModal}
                className="text-gray-400 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {isLoadingHistory ? (
                <div className="text-center py-10 text-sm text-gray-500">Memuat riwayat...</div>
              ) : patientHistory.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">Belum ada riwayat pasien.</div>
              ) : (
                patientHistory.map((historyItem) => {
                  const clinicalMapping = Array.isArray(historyItem.ttv_data?.clinical_mapping)
                    ? historyItem.ttv_data.clinical_mapping
                    : [];
                  const historyItems = Array.isArray(historyItem.ttv_data?.items)
                    ? historyItem.ttv_data.items
                    : [];
                  const fotoBefore = historyItem.ttv_data?.foto_before || null;
                  const fotoAfter = historyItem.ttv_data?.foto_after || null;

                  return (
                    <div key={historyItem.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{historyItem.encounter_number}</p>
                          <p className="text-[10px] text-gray-500">
                            {new Date(historyItem.created_at).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-600 font-bold uppercase">
                          {historyItem.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-700">
                        <span className="font-bold">Petugas:</span> {historyItem.staff?.name || '-'} ({historyItem.staff?.role || '-'})
                      </p>

                      <p className="text-xs text-gray-700">
                        <span className="font-bold">Diagnosa:</span> {historyItem.ttv_data?.analisa_dokter || '-'}
                      </p>

                      <p className="text-xs text-gray-700">
                        <span className="font-bold">Pemeriksaan:</span> {historyItem.ttv_data?.pemeriksaan_fisik || '-'}
                      </p>

                      {clinicalMapping.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clinical Mapping</p>
                          <div className="flex flex-wrap gap-1.5">
                            {clinicalMapping.map((area, idx) => {
                              const label = typeof area === 'string'
                                ? area
                                : area?.label || area?.name || area?.title || area?.area || area?.id || `Area ${idx + 1}`;
                              return (
                                <span
                                  key={`${historyItem.id}-cm-${idx}`}
                                  className="px-2 py-1 rounded-full bg-white border border-gray-200 text-[10px] font-bold text-gray-600"
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(fotoBefore || fotoAfter) && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dokumentasi Foto</p>
                          <div className={`grid gap-3 ${fotoBefore && fotoAfter ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {[
                              { key: 'before', title: 'Before', data: fotoBefore },
                              { key: 'after', title: 'After', data: fotoAfter }
                            ].map((section) => (
                              section.data ? (
                                <div key={`${historyItem.id}-${section.key}`} className="space-y-2">
                                  <p className="text-[9px] font-bold text-gray-500 uppercase">{section.title}</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    {['depan', 'kanan', 'kiri'].map((pos) => (
                                      <div key={`${historyItem.id}-${section.key}-${pos}`} className="space-y-1">
                                        <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                                          {section.data?.[pos] ? (
                                            <img
                                              src={section.data[pos]}
                                              alt={`${section.title} ${pos}`}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <span className="text-[8px] text-gray-300 font-bold">-</span>
                                          )}
                                        </div>
                                        <p className="text-[8px] text-center uppercase text-gray-400 font-bold">{pos}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null
                            ))}
                          </div>
                        </div>
                      )}

                      {historyItems.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Produk / Treatment Digunakan</p>
                          <div className="space-y-2">
                            {historyItems.map((item, idx) => (
                              <div key={`${historyItem.id}-item-${idx}`} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl p-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-800 truncate">{item.name || '-'}</p>
                                  <p className="text-[9px] text-gray-400 uppercase">{item.type || '-'}</p>
                                </div>
                                <p className="text-xs font-black text-emerald-600 whitespace-nowrap">
                                  Rp {(Number(item.selling_price) || 0).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={closeHistoryModal}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Annotation Editor */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="p-4 flex justify-between items-center bg-gray-900 text-white">
            <button onClick={() => setEditorOpen(false)} className="text-sm">Batal</button>
            <h3 className="font-bold uppercase text-xs">Penandaan Area</h3>
            <button onClick={saveAnnotation} className="bg-gold px-4 py-1 rounded-full text-black font-bold text-sm">Simpan</button>
          </div>
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            <canvas 
              ref={canvasRef}
              onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing}
              onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
              className="max-w-full max-h-full touch-none border border-gray-800"
            />
          </div>
          <div className="p-6 bg-gray-900 flex justify-center gap-6">
            {['#ff0000', '#ffff00', '#0088ff', '#00ff00'].map((color) => (
              <button 
                key={color} onClick={() => setBrushColor(color)}
                className={`w-10 h-10 rounded-full border-4 transition-transform ${brushColor === color ? 'scale-125 border-white' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
            <button onClick={() => initCanvas(foto[editorTarget].preview)} className="bg-gray-700 text-white px-4 rounded-xl text-xs font-bold">Hapus Coretan</button>
          </div>
        </div>
      )}

      {/* Modal Preview Struk Antrean (Seirama dengan Registrasi & Kasir) */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[110] flex flex-col items-center justify-center p-4">
          <div className="bg-gray-200 p-1 rounded-lg shadow-2xl mb-6 overflow-hidden" style={{ width: '58mm' }}>
            <div className="bg-white shadow-inner">
              <QueuePrint ref={printRef} queueData={printData} />
            </div>
          </div>
          
          <div className="flex gap-3 w-full max-w-[58mm]">
            <button 
              onClick={() => setShowPrintModal(false)}
              className="flex-1 py-3 bg-white text-gray-700 rounded-xl font-bold text-sm uppercase active:scale-95 transition-transform"
            >Batal</button>
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

export default Konsultasi;
