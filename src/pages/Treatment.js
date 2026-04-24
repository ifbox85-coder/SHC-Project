import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { supabase, dbUploadFile } from '../configs/database';
import AreaMapper from '../components/AreaMapper';

const Treatment = () => {
  const theme = useContext(ThemeContext);
  const [queue, setQueue] = useState([]);
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [isProcess, setIsProcess] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [fotoBefore, setFotoBefore] = useState({ 
    depan: { preview: null, file: null }, 
    kanan: { preview: null, file: null }, 
    kiri: { preview: null, file: null } 
  });
  const [fotoAfter, setFotoAfter] = useState({ 
    depan: { preview: null, file: null }, 
    kanan: { preview: null, file: null }, 
    kiri: { preview: null, file: null } 
  });
  const [catatanTerapis, setCatatanTerapis] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const [previewCompare, setPreviewCompare] = useState(null); // 'depan', 'kanan', 'kiri'

  // State untuk Annotation Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSource, setEditorSource] = useState(null); // 'before' atau 'after'
  const [editorTarget, setEditorTarget] = useState(null); // 'depan', 'kanan', 'kiri'
  const [brushColor, setBrushColor] = useState('#ff0000');
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  // Simulasi ID Terapis Login (Nanti didapat dari Auth)
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  useEffect(() => {
    fetchQueue();

    // Auto-refresh daftar antrean setiap 30 detik
    const interval = setInterval(() => {
      if (!selectedEncounter) fetchQueue();
    }, 30000);

    return () => clearInterval(interval);
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
        patients (id, full_name, rm_number),
        staff (name)
      `)
      .eq('status', 'treatment');

    // Jika role-nya adalah therapist, filter berdasarkan ID-nya. 
    // Jika doctor atau admin, tampilkan semua antrean tindakan.
    if (userProfile.role === 'therapist') {
      query = query.eq('assigned_staff_id', userProfile.id);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching treatment queue:", error);
    } else {
      setQueue(data);
    }
  };

  // Sinkronisasi data saat pasien dipilih
  useEffect(() => {
    if (selectedEncounter) {
      const initialBefore = selectedEncounter.ttv_data?.foto_before || { depan: null, kanan: null, kiri: null };
      setFotoBefore({
        depan: { preview: initialBefore.depan, file: null },
        kanan: { preview: initialBefore.kanan, file: null },
        kiri: { preview: initialBefore.kiri, file: null }
      });
    }
  }, [selectedEncounter]);

  const handleCaptureBefore = (posisi, e) => {
    const file = e.target.files[0];
    if (file) {
      setFotoBefore({ 
        ...fotoBefore, 
        [posisi]: { preview: URL.createObjectURL(file), file: file } 
      });
    }
  };

  // Fungsi Hapus Foto Before (jika diambil oleh terapis)
  const handleDeleteBefore = (posisi, e) => {
    e.stopPropagation();
    if (window.confirm(`Hapus foto before ${posisi} dan ambil ulang?`)) {
      setFotoBefore({ ...fotoBefore, [posisi]: { preview: null, file: null } });
    }
  };

  // Fungsi Hapus Foto After
  const handleDeleteAfter = (posisi, e) => {
    e.stopPropagation();
    if (window.confirm(`Hapus foto after ${posisi} dan ambil ulang?`)) {
      setFotoAfter({ ...fotoAfter, [posisi]: { preview: null, file: null } });
    }
  };

  const handleStart = async () => {
    // Jika dokter atau admin yang mengerjakan antrean, otomatis ambil alih (update assigned_staff_id)
    if (userProfile.role === 'doctor' || userProfile.role === 'admin') {
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('encounters')
          .update({ assigned_staff_id: userProfile.id })
          .eq('id', selectedEncounter.id);
        
        if (error) throw error;
      } catch (err) {
        alert("Gagal mengambil alih tindakan: " + err.message);
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    setIsProcess(true);
    setStartTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleCaptureAfter = (posisi, e) => {
    const file = e.target.files[0];
    if (file) {
      setFotoAfter({ 
        ...fotoAfter, 
        [posisi]: { preview: URL.createObjectURL(file), file: file } 
      });
    }
  };

  // Logic Drawing
  const openEditor = (source, posisi) => {
    const targetData = source === 'before' ? fotoBefore[posisi] : fotoAfter[posisi];
    if (!targetData.preview) return;
    setEditorSource(source);
    setEditorTarget(posisi);
    setEditorOpen(true);
    setTimeout(() => initCanvas(targetData.preview), 100);
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
  const stopDrawing = () => { isDrawing.current = false; canvasRef.current?.getContext('2d').beginPath(); };
  const draw = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
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
      const file = new File([blob], `annotated_${editorSource}_${editorTarget}.jpg`, { type: 'image/jpeg' });
      if (editorSource === 'before') {
        setFotoBefore({ ...fotoBefore, [editorTarget]: { preview: dataUrl, file: file } });
      } else {
        setFotoAfter({ ...fotoAfter, [editorTarget]: { preview: dataUrl, file: file } });
      }
      setEditorOpen(false);
    });
  };

  const handleSelesai = async () => {
    if (!catatanTerapis) return alert("Mohon isi tanggapan pasien/catatan tindakan!");
    
    setIsSaving(true);
    try {
      // 0. Proses Upload Foto (Before yang baru & After)
      const finalBeforeUrls = { ...selectedEncounter.ttv_data?.foto_before };
      const finalAfterUrls = { depan: null, kanan: null, kiri: null };

      for (const pos of ['depan', 'kanan', 'kiri']) {
        if (fotoBefore[pos].file) {
          const fileName = `${selectedEncounter.encounter_number}_before_${pos}_terapis_${Date.now()}.jpg`;
          finalBeforeUrls[pos] = await dbUploadFile(
            'medical-records', 
            `photos/${selectedEncounter.patients?.id}/${fileName}`, 
            fotoBefore[pos].file
          );
        }
        if (fotoAfter[pos].file) {
          const fileName = `${selectedEncounter.encounter_number}_after_${pos}_${Date.now()}.jpg`;
          finalAfterUrls[pos] = await dbUploadFile(
            'medical-records', 
            `photos/${selectedEncounter.patients?.id}/${fileName}`, 
            fotoAfter[pos].file
          );
        }
      }

      // Update: credit to performing therapist (logged user)
      const { error } = await supabase
        .from('encounters')
        .update({
          status: 'completed',
          assigned_staff_id: userProfile.id,  // Ensure performer gets jasa credit
          ttv_data: {
            ...selectedEncounter.ttv_data,
            foto_before: finalBeforeUrls,
            foto_after: finalAfterUrls,
            catatan_terapis: catatanTerapis,
            waktu_mulai_tindakan: startTime,
            waktu_selesai_tindakan: new Date().toLocaleTimeString()
          }
        })
        .eq('id', selectedEncounter.id);

      if (error) throw error;
      
      alert("Tindakan Selesai! Pasien diarahkan ke Kasir.");
      setSelectedEncounter(null);
      setIsProcess(false);
      setIsConfirmed(false);
      fetchQueue();
    } catch (err) {
      alert("Gagal menyimpan data: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Tampilan Daftar Antrean Terapis
  if (!selectedEncounter) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-4 text-white shadow-md flex items-center" style={{ backgroundColor: theme.primaryColor }}>
          <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl">←</button>
        <h2 className="font-bold uppercase text-sm">Ruang Tindakan</h2>
        </div>

        <div className="p-4 space-y-3">
        <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest text-center py-2">
          {userProfile.role === 'therapist' ? `Antrean Tugas: ${userProfile.name}` : 'Semua Antrean Ruang Tindakan'}
        </h3>
          {queue.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-gray-400 text-sm italic text-center">Belum ada pasien di ruang tindakan</p>
              <button onClick={fetchQueue} className="mt-2 text-xs font-bold text-blue-500 underline uppercase tracking-tighter">Refresh Antrean</button>
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
                    <span className="bg-gold text-white text-[10px] px-2 py-0.5 rounded font-black">{item.queue_number}</span>
                    <span className="text-[9px] text-gray-400 font-mono">{item.encounter_number}</span>
                  </div>
                  <h4 className="font-bold text-gray-800">{item.patients?.full_name}</h4>
                  <p className="text-[10px] text-gray-500 uppercase font-mono">RM: {item.patients?.rm_number} | Lokasi: <span className="text-blue-600 font-bold">{item.ttv_data?.room_name || 'Bebas'}</span></p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-gold-light text-gold-dark px-2 py-1 rounded-full font-bold">KERJAKAN</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Tampilan Form Tindakan
  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="p-4 text-white shadow-md flex justify-between items-center" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex items-center">
          <button onClick={() => setSelectedEncounter(null)} className="mr-3 text-2xl active:scale-90 transition-transform">←</button>
          <div>
            <h2 className="font-bold uppercase leading-tight">{selectedEncounter.patients?.full_name}</h2>
            <p className="text-[10px]">Terapis: {userProfile.name} | Ruangan: {selectedEncounter.ttv_data?.room_name || '-'}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-xs font-mono bg-black bg-opacity-20 px-2 py-1 rounded">{selectedEncounter.queue_number}</span>
          <p className="text-[8px] opacity-70 mt-1">{selectedEncounter.encounter_number}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 1. Summary Temuan Dokter (S/O from Doctor) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-blue-500">🩺</span>
            <h3 className="font-bold text-xs uppercase text-gray-500">Hasil Pemeriksaan Dokter</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <p className="text-gray-700"><strong>Keluhan:</strong> {selectedEncounter.ttv_data?.keluhan || '-'}</p>
            <p className="text-gray-700"><strong>Diagnosa:</strong> {selectedEncounter.ttv_data?.analisa_dokter || '-'}</p>
          </div>
          {selectedEncounter.ttv_data?.skin_data && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
              {['moisture', 'oil', 'elasticity'].map(key => (
                <div key={key} className="bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 flex flex-col items-center min-w-[60px]">
                  <span className="text-[8px] uppercase text-blue-400 font-bold">{key}</span>
                  <span className="text-[10px] font-black text-blue-700">{selectedEncounter.ttv_data.skin_data[key]}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Clinical Mapping View (Terapis tahu area mana yang harus dikerjakan) */}
        {selectedEncounter.ttv_data?.clinical_mapping?.length > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-500">📍</span>
              <h3 className="font-bold text-sm text-gray-700">Clinical Mapping View</h3>
            </div>
            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden pointer-events-none" style={{ height: '240px' }}>
              <AreaMapper 
                value={selectedEncounter.ttv_data.clinical_mapping} 
                onChange={() => {}} // View only mode
              />
            </div>
          </div>
        )}

        {/* 3. Instruksi Kerja (Planning Internal) */}
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-orange-500">📢</span>
            <h3 className="font-bold text-xs uppercase text-orange-700">Instruksi & Rencana Tindakan</h3>
          </div>
          <div className="space-y-2">
            <div className="bg-white p-3 rounded-xl border border-orange-200">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Tindakan:</p>
              <p className="text-sm font-black text-gray-800">
                {selectedEncounter.ttv_data?.items?.filter(i => i.type === 'Treatment').map(i => i.name).join(', ') || 'Tindakan Umum'}
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-orange-200">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Catatan Khusus Dokter:</p>
              <p className="text-sm font-medium text-orange-900 leading-relaxed">
                {selectedEncounter.ttv_data?.instruksi_khusus || 'Ikuti prosedur standar.'}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Konfirmasi & Tombol Mulai / Timer */}
        {!isProcess ? (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="mt-1 w-5 h-5 accent-blue-600 rounded" 
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                />
                <span className="text-sm text-blue-800 font-medium leading-tight">
                  Saya sudah membaca, memahami, dan siap melaksanakan instruksi dokter sesuai prosedur klinis yang berlaku.
                </span>
              </label>
            </div>
            <button 
              onClick={handleStart}
              disabled={!isConfirmed}
              className={`w-full py-6 rounded-2xl text-white font-bold text-xl shadow-lg transition-all ${!isConfirmed ? 'bg-gray-300 cursor-not-allowed opacity-50' : 'animate-pulse'}`}
              style={isConfirmed ? { backgroundColor: theme.primaryColor } : {}}
            >
              MULAI TINDAKAN
            </button>
          </div>
        ) : (
          <div className="bg-green-100 p-3 rounded-lg text-center border border-green-200">
            <p className="text-green-700 text-xs font-bold uppercase">Tindakan Sedang Berlangsung</p>
            <p className="text-2xl font-mono font-bold text-green-800">Mulai: {startTime}</p>
          </div>
        )}

        {/* 3. Foto After (Disandingkan dengan Before) */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">📸</span>
              <h3 className="font-bold text-sm text-gray-700">Dokumentasi After Treatment</h3>
            </div>
            <p className="text-[10px] text-gray-400 italic">Klik foto untuk memperbesar</p>
          </div>
          <div className="space-y-4">
            {['depan', 'kanan', 'kiri'].map((pos) => (
              <div key={pos} className="grid grid-cols-2 gap-2">
                {/* Bagian Before: Tampilkan dari Dokter atau Kamera jika kosong */}
                <label className="border border-gray-100 rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative bg-gray-50 shadow-inner">
                  <p className="text-[9px] absolute top-1 left-1 bg-black bg-opacity-50 text-white px-1">BEFORE</p>
                  {fotoBefore[pos].preview ? (
                    <div className="relative w-full h-full">
                      <img src={fotoBefore[pos].preview} alt={`before-${pos}`} className="object-cover w-full h-full" onClick={() => openEditor('before', pos)} />
                      <button 
                        type="button"
                        onClick={(e) => handleDeleteBefore(pos, e)}
                        className="absolute bottom-1 right-1 bg-red-600 bg-opacity-70 text-white px-2 py-1 rounded text-[8px] font-bold"
                      >HAPUS</button>
                      <button 
                        type="button"
                        onClick={() => setPreviewCompare(pos)}
                        className="absolute top-1 right-1 bg-blue-600 bg-opacity-70 text-white p-1 rounded-lg text-[10px] shadow-lg"
                      >🔍</button>
                    </div>
                  ) : (
                    <div className="text-center p-2">
                      <span className="text-xs">📸</span>
                      <p className="text-[8px] text-gray-400 uppercase font-bold">Foto Before {pos} Missing</p>
                    </div>
                  )}
                  {!selectedEncounter.ttv_data?.foto_before?.[pos] && (
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCaptureBefore(pos, e)} />
                  )}
                </label>

                {/* Bagian After */}
                <label className="border-2 border-dashed border-gray-200 rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative bg-white transition-all active:bg-gray-50">
                  {fotoAfter[pos].preview ? (
                    <div className="relative w-full h-full">
                      <img src={fotoAfter[pos].preview} alt={pos} className="object-cover w-full h-full" onClick={() => openEditor('after', pos)} />
                      <button 
                        type="button"
                        onClick={(e) => handleDeleteAfter(pos, e)}
                        className="absolute bottom-1 right-1 bg-red-600 bg-opacity-70 text-white px-2 py-1 rounded text-[8px] font-bold"
                      >HAPUS</button>
                      <button 
                        type="button"
                        onClick={() => setPreviewCompare(pos)}
                        className="absolute top-1 right-1 bg-blue-600 bg-opacity-70 text-white p-1 rounded-lg text-[10px] shadow-lg"
                      >🔍</button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <span className="text-[20px]">📸</span>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Ambil Foto {pos}</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCaptureAfter(pos, e)} />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Respon Pasien */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-400">📝</span>
            <h3 className="font-bold text-sm text-gray-700">Catatan Pelaksanaan & Respon Pasien</h3>
          </div>
          <textarea 
            className="w-full p-4 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-opacity-20" 
            placeholder="Contoh: Pasien nyaman, laser dilakukan 2 pass, area dahi sedikit eritema..."
            rows="3"
            onChange={(e) => setCatatanTerapis(e.target.value)}
          ></textarea>
        </div>
      </div>

      {/* Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
        <button 
          onClick={handleSelesai}
          disabled={!isProcess || isSaving}
          className={`w-full py-4 rounded-xl font-bold shadow-lg text-white ${(!isProcess || isSaving) ? 'bg-gray-300' : ''}`}
          style={(isProcess && !isSaving) ? { backgroundColor: theme.primaryColor } : {}}
        >
          {isSaving ? 'MEMPROSES...' : 'SELESAI & KIRIM KE KASIR'}
        </button>
      </div>
    </div>
  );
};

export default Treatment;