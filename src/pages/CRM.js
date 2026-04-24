import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { supabase } from '../configs/database';
import { useNavigate } from 'react-router-dom';
import { BellRing, MessageSquare, Mail } from 'lucide-react';

const CRM = () => {
  const theme = useContext(ThemeContext);
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    const fetchReminders = async () => {
      const today = new Date().toISOString().split('T')[0];
      // Ambil data pasien yang next_control_date-nya hari ini
      const { data } = await supabase
        .from('encounters')
        .select('*, patients(*)')
        .eq('ttv_data->>next_control_date', today);
      if (data) setReminders(data);
    };
    fetchReminders();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="p-4 text-white shadow-md flex items-center" style={{ backgroundColor: theme.primaryColor }}>
        <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl">←</button>
        <h2 className="font-bold uppercase text-sm tracking-wider">Patient Care (CRM)</h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
           <BellRing className="absolute right-[-10px] top-[-10px] opacity-20" size={100} />
           <p className="text-xs font-bold opacity-80 uppercase">Reminder Hari Ini</p>
           <p className="text-3xl font-black">{reminders.length}</p>
           <p className="text-[10px] mt-2 italic">Pasien yang harus diingatkan untuk kontrol kembali hari ini.</p>
        </div>

        <div className="space-y-3">
          {reminders.map(r => (
            <div key={r.id} className="bg-white p-4 rounded-3xl shadow-sm flex justify-between items-center border border-gray-100">
               <div>
                 <p className="font-bold text-gray-800 text-sm">{r.patients?.full_name}</p>
                 <p className="text-[10px] text-gray-400 font-medium italic">Treatment Terakhir: {r.ttv_data?.items?.[0]?.name}</p>
               </div>
               <button 
                onClick={() => {
                  const phone = r.patients?.phone_number?.replace(/\D/g, '');
                  const msg = `Halo Kak ${r.patients?.full_name}, kami dari ${theme.clinicName} mengingatkan hari ini adalah jadwal kontrol/treatment kembali Kakak. Apakah ada waktu di jam berapa? ✨`;
                  window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="p-3 bg-green-500 text-white rounded-2xl shadow-md active:scale-90"
               >
                 <MessageSquare size={20} />
               </button>
               <button 
                onClick={() => {
                  const email = r.patients?.email;
                  if (!email) return alert("Email pasien tidak terdaftar!");
                  const subject = encodeURIComponent(`Reminder Kontrol - ${theme.clinicName}`);
                  const body = encodeURIComponent(`Halo ${r.patients?.full_name},\n\nKami menginfokan bahwa hari ini adalah jadwal kontrol/treatment Anda kembali di ${theme.clinicName}.\n\nSilakan hubungi kami untuk konfirmasi kedatangan.\n\nTerima kasih ✨`);
                  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
                }}
                className="p-3 bg-blue-500 text-white rounded-2xl shadow-md active:scale-90"
               >
                 <Mail size={20} />
               </button>
            </div>
          ))}
          {reminders.length === 0 && (
            <div className="py-20 text-center text-gray-400 text-xs italic">Tidak ada jadwal kontrol untuk hari ini.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CRM;