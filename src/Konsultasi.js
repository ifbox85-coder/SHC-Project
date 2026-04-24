import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { supabase } from '../configs/database';
import { useNavigate, useLocation } from 'react-router-dom';
import AreaMapper from '../components/AreaMapper';
import SkinAssessment from '../components/SkinAssessment';
import diagnosisPresets from '../data/diagnosis-suggestions';

const Konsultasi = () => {
  const theme = useContext(ThemeContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('anamnesa');
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // State Form Konsultasi
  const [consultData, setConsultData] = useState({
    subjective: {
      complaint: '',
      history_skincare: '',
      history_treatment: '',
      allergies: ''
    },
    objective: {
      mapping_data: [],
      skin_assessment: {},
      photos: []
    },
    assessment: {
      diagnosis: [],
      notes: ''
    },
    plan: {
      treatments: [],
      prescriptions: [],
      advice: ''
    }
  });

  // Contoh List Pasien Antrean (Bisa difetch dari encounters)
  const [queue, setQueue] = useState([]);

  const tabs = [
    { id: 'anamnesa', label: '1. Anamnesa', icon: '📝' },
    { id: 'fisik', label: '2. Pemeriksaan Fisik', icon: '🔍' },
    { id: 'diagnosis', label: '3. Diagnosis', icon: '🩺' },
    { id: 'rencana', label: '4. Rencana & Resep', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Statis */}
      <header className="p-4 text-white shadow-lg flex justify-between items-center" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-2xl hover:scale-110 transition-transform">←</button>
          <div>
            <h1 className="font-bold text-xl tracking-tight">Ruang Konsultasi Dokter</h1>
            <p className="text-[10px] opacity-80 uppercase font-medium">Aesthetic Medical Record v2.0</p>
          </div>
        </div>
        
        {/* Info Pasien Aktif (Mini Profile) */}
        {selectedEncounter ? (
          <div className="bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm flex items-center gap-4 border border-white/30">
            <div className="text-right">
              <p className="font-bold text-sm leading-none">{selectedEncounter.patients?.full_name}</p>
              <p className="text-[10px] opacity-90">{selectedEncounter.patients?.rm_number} • {selectedEncounter.patients?.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
            </div>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-primary font-black text-lg">
              {selectedEncounter.patients?.full_name?.charAt(0)}
            </div>
          </div>
        ) : (
          <p className="text-sm italic animate-pulse text-white/70">Pilih pasien dari antrean...</p>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Antrean - Estetik & Slim */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col shadow-inner">
          <div className="p-4 border-b bg-gray-50/50">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Antrean Pasien Hari Ini</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {/* Map antrean di sini */}
            {[1, 2, 3].map((i) => (
              <div 
                key={i}
                onClick={() => setSelectedEncounter({ patients: { full_name: 'Pasien Contoh ' + i, rm_number: '0000'+i }})}
                className={`p-3 rounded-2xl cursor-pointer transition-all border-2 ${selectedEncounter?.patients?.rm_number === '0000'+i ? 'bg-blue-50 border-blue-400 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">K-00{i}</span>
                  <span className="text-[9px] text-gray-400">10:2{i} AM</span>
                </div>
                <p className="font-bold text-gray-700 text-sm mt-1">Nyonya Indah Permata</p>
                <p className="text-[10px] text-gray-400 truncate">Keluhan: Jerawat meradang di pipi...</p>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Console Area */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
          {/* Tab Navigation */}
          <nav className="flex border-b px-6 bg-white sticky top-0 z-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-6 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                  activeTab === tab.id 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content Container */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {!selectedEncounter ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50">
                <div className="text-6xl mb-4">🩺</div>
                <p className="font-bold italic">Silahkan pilih pasien untuk memulai konsultasi</p>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto animate-fadeIn">
                
                {activeTab === 'anamnesa' && (
                  <section className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-2 tracking-widest">Keluhan Utama (Subjective)</label>
                        <textarea 
                          className="w-full p-4 border-2 border-gray-100 rounded-2xl focus:border-blue-400 outline-none transition-all min-h-[150px] text-gray-700 leading-relaxed shadow-sm"
                          placeholder="Ketik detail keluhan pasien di sini..."
                          value={consultData.subjective.complaint}
                          onChange={(e) => setConsultData({...consultData, subjective: {...consultData.subjective, complaint: e.target.value}})}
                        />
                      </div>
                    </div>
                    <div className="space-y-6">
                       <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 shadow-sm">
                          <h4 className="text-xs font-black text-orange-400 uppercase mb-4 tracking-widest">Riwayat & Alergi</h4>
                          <div className="space-y-4">
                            <input className="w-full p-3 rounded-xl border-none shadow-inner text-sm" placeholder="Riwayat Skincare..." />
                            <input className="w-full p-3 rounded-xl border-none shadow-inner text-sm" placeholder="Riwayat Laser/Filler..." />
                            <input className="w-full p-3 rounded-xl border-none shadow-inner text-sm bg-red-100 text-red-700 placeholder-red-400 font-bold" placeholder="⚠ ALERGI OBAT/MAKANAN" />
                          </div>
                       </div>
                    </div>
                  </section>
                )}

                {activeTab === 'fisik' && (
                  <section className="space-y-10">
                    <div className="grid grid-cols-12 gap-8">
                      {/* AreaMapper.js Integration */}
                      <div className="col-span-7 bg-white rounded-3xl border shadow-sm p-6 overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <span className="p-1.5 bg-blue-100 rounded-lg">📍</span> Face Mapping
                          </h3>
                          <div className="flex gap-2">
                            <button className="text-[10px] font-bold px-3 py-1.5 rounded-full border hover:bg-gray-50 transition-colors">CLEAN</button>
                            <button className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-blue-600 text-white shadow-md">SAVE MAP</button>
                          </div>
                        </div>
                        <div className="aspect-square bg-gray-50 rounded-2xl border-2 border-dashed flex items-center justify-center relative overflow-hidden group">
                           {/* Komponen AreaMapper Anda di sini */}
                           <AreaMapper /> 
                        </div>
                      </div>

                      {/* SkinAssessment.js Integration */}
                      <div className="col-span-5 space-y-6">
                        <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-xl">
                           <h3 className="font-bold mb-4 flex items-center gap-2">
                            <span className="p-1.5 bg-white/20 rounded-lg">🧪</span> Skin Analysis
                          </h3>
                          <SkinAssessment />
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === 'diagnosis' && (
                  <section className="max-w-3xl mx-auto space-y-6">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">Diagnosis Standard (Assesment)</label>
                      <div className="relative group">
                        <input 
                          className="w-full p-5 pl-14 border-2 border-gray-100 rounded-3xl focus:border-blue-400 outline-none shadow-sm transition-all text-lg font-medium"
                          placeholder="Cari diagnosis (contoh: Acne, Melasma...)"
                        />
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl opacity-30">🔍</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {/* Sugesti Diagnosis dari diagnosis-suggestions.js */}
                        {['Acne Vulgaris', 'HPI', 'Melasma', 'Aging Skin'].map(d => (
                          <button key={d} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                            + {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      className="w-full p-5 border-2 border-gray-100 rounded-3xl min-h-[100px] text-sm italic text-gray-500" 
                      placeholder="Catatan tambahan diagnosis..."
                    />
                  </section>
                )}

                {activeTab === 'rencana' && (
                  <section className="grid grid-cols-2 gap-8">
                    {/* Treatment Selection */}
                    <div className="bg-white rounded-3xl border p-6 shadow-sm">
                       <h3 className="font-bold text-gray-700 mb-4 border-b pb-3">Recommended Treatment</h3>
                       <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                            <div>
                              <p className="text-sm font-bold text-blue-800">IPL Photofacial</p>
                              <p className="text-[10px] text-blue-500 italic">2 Pass - Medium Intensity</p>
                            </div>
                            <button className="text-red-400 text-xs font-bold">REMOVE</button>
                          </div>
                          <button className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-xs font-bold hover:bg-gray-50">+ TAMBAH TINDAKAN</button>
                       </div>
                    </div>

                    {/* Prescription */}
                    <div className="bg-white rounded-3xl border p-6 shadow-sm">
                       <h3 className="font-bold text-gray-700 mb-4 border-b pb-3">E-Prescription (Skincare)</h3>
                       <div className="space-y-3">
                          <input className="w-full p-3 rounded-xl bg-gray-50 border-none text-sm font-bold" placeholder="Ketik Nama Produk..." />
                          <div className="flex gap-2">
                            <input className="flex-1 p-3 rounded-xl bg-gray-50 border-none text-sm" placeholder="Aturan Pakai (misal: 1x malam)" />
                            <button className="px-6 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase shadow-lg">ADD</button>
                          </div>
                       </div>
                    </div>
                  </section>
                )}

              </div>
            )}
          </div>

          {/* Footer Action Bar */}
          {selectedEncounter && (
            <footer className="p-4 bg-white border-t flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
              <div className="flex gap-2">
                <button className="px-6 py-3 rounded-xl font-bold text-xs uppercase bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">Simpan Draft</button>
                <button className="px-6 py-3 rounded-xl font-bold text-xs uppercase bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">Salin RM Terakhir</button>
              </div>
              <button 
                className="px-10 py-3 rounded-2xl font-black text-sm uppercase text-white shadow-xl active:scale-95 transition-transform"
                style={{ backgroundColor: theme.primaryColor }}
              >
                Selesaikan Konsultasi & Kirim Resep →
              </button>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
};

export default Konsultasi;