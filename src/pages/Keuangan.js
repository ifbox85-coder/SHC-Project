import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { supabase } from '../configs/database';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ArrowUpCircle, ArrowDownCircle, Plus, Receipt, History } from 'lucide-react';

const Keuangan = () => {
  const theme = useContext(ThemeContext);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, tax: 0, rounding: 0 });
  const [showModal, setShowModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'Operasional', description: '', amount: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { fetchFinanceData(); }, [startDate, endDate]);

  const fetchFinanceData = async () => {
    const start = `${startDate}T00:00:00Z`;
    const end = `${endDate}T23:59:59Z`;
    
    // 1. Ambil Pemasukan dari Kasir
    const { data: billings } = await supabase.from('billings').select('amount_paid, grand_total, tax, subtotal, discount').gte('created_at', start).lte('created_at', end);
    
    let totalTax = 0;
    let totalRounding = 0;
    const totalIncome = billings?.reduce((sum, b) => {
      const actualReceived = Math.min(Number(b.amount_paid) || 0, Number(b.grand_total) || 0);
      totalTax += (Number(b.tax) || 0);
      const expectedTotal = (Number(b.subtotal) || 0) - (Number(b.discount) || 0) + (Number(b.tax) || 0);
      totalRounding += (Number(b.grand_total) || 0) - expectedTotal;
      return sum + actualReceived;
    }, 0) || 0;

    // 2. Ambil Pengeluaran
    const { data: expData } = await supabase.from('expenses').select('*').gte('created_at', start).lte('created_at', end);
    const totalExp = expData?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    setSummary({ income: totalIncome, expense: totalExp, tax: totalTax, rounding: totalRounding });
    if (expData) setExpenses(expData);
  };

  const handleSimpanExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) return alert("Lengkapi data!");
    setIsLoading(true);
    try {
      const { error } = await supabase.from('expenses').insert([{
        category: expenseForm.category,
        description: expenseForm.description,
        amount: Number(expenseForm.amount),
        staff_id: user.id || 'SYSTEM'
      }]);
      if (error) throw error;

      await supabase.from('activity_logs').insert([{
        staff_id: user.id || 'SYSTEM',
        action: 'PENGELUARAN',
        description: `Mencatat biaya ${expenseForm.category}: ${expenseForm.description} senilai Rp ${Number(expenseForm.amount).toLocaleString()}`
      }]);

      alert("Pengeluaran berhasil dicatat!");
      setShowModal(false);
      setExpenseForm({ category: 'Operasional', description: '', amount: '' });
      fetchFinanceData();
    } catch (err) {
      if (err.message?.includes('row-level security policy')) {
        alert("Gagal Simpan: Izin akses database ditolak (RLS) untuk tabel 'expenses'.\n\nPastikan Anda sudah menjalankan SQL Policy di Dashboard Supabase.");
      } else {
        alert(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="p-4 text-white shadow-md flex items-center" style={{ backgroundColor: theme.primaryColor }}>
        <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl">←</button>
        <h2 className="font-bold uppercase text-sm tracking-wider">Arus Kas & Pengeluaran</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Date Filter */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Periode Laporan</label>
          <div className="flex gap-2 items-center">
            <input 
              type="date" 
              className="flex-1 p-2 bg-gray-50 rounded-xl text-xs font-bold outline-none" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
            <span className="text-gray-400 text-xs">s/d</span>
            <input 
              type="date" 
              className="flex-1 p-2 bg-gray-50 rounded-xl text-xs font-bold outline-none" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-2 gap-y-6">
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">Pemasukan Bersih</p>
            <p className="text-base font-black text-green-600">Rp {summary.income.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase">Total Pengeluaran</p>
            <p className="text-base font-black text-red-500">Rp {summary.expense.toLocaleString()}</p>
          </div>
          <div className="text-center border-t border-gray-50 pt-4">
            <p className="text-[10px] font-black text-gray-400 uppercase">Rekap PPN</p>
            <p className="text-sm font-black text-blue-600">Rp {summary.tax.toLocaleString()}</p>
          </div>
          <div className="text-center border-t border-gray-50 pt-4">
            <p className="text-[10px] font-black text-gray-400 uppercase">Pembulatan</p>
            <p className="text-sm font-black text-orange-500">Rp {summary.rounding.toLocaleString()}</p>
          </div>
        </div>

        <button 
          onClick={() => setShowModal(true)}
          className="w-full py-4 bg-gray-800 text-white rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={16} /> Catat Pengeluaran Baru
        </button>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <History size={14} className="text-gray-400" />
            <h3 className="font-black text-[10px] text-gray-400 uppercase tracking-widest">Log Pengeluaran Hari Ini</h3>
          </div>
          {expenses.length === 0 ? (
            <div className="bg-white p-10 rounded-3xl shadow-sm italic text-center text-gray-400 text-xs border border-dashed">
               Belum ada pengeluaran tercatat hari ini.
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => (
                <div key={exp.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-gray-100 animate-fadeIn">
                  <div>
                    <p className="text-xs font-bold text-gray-800">{exp.description}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">{exp.category}</p>
                  </div>
                  <p className="text-sm font-black text-red-500">-Rp {exp.amount?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Catat Pengeluaran */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-5 animate-slide-up">
            <div className="text-center space-y-1">
               <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-2"><Receipt size={24}/></div>
               <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Input Biaya</h3>
            </div>
            <div className="space-y-4">
               <select className="w-full p-3 bg-gray-50 rounded-2xl text-sm outline-none font-bold" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                 <option>Operasional</option><option>Gaji/Fee</option><option>Sewa Alat</option><option>Logistik/Obat</option><option>Lainnya</option>
               </select>
               <input type="text" placeholder="Keterangan Biaya..." className="w-full p-3 bg-gray-50 rounded-2xl text-sm outline-none" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} />
               <input 
                type="text" 
                placeholder="Nominal Rp..." 
                inputMode="numeric" 
                className="w-full p-4 bg-gray-50 rounded-2xl text-xl font-black outline-none text-red-600" 
                value={expenseForm.amount ? Number(expenseForm.amount).toLocaleString('id-ID') : ''} 
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setExpenseForm({...expenseForm, amount: val});
                }} 
               />
               <button onClick={handleSimpanExpense} disabled={isLoading} className="w-full py-4 bg-gray-800 text-white rounded-2xl font-bold uppercase text-xs shadow-xl">{isLoading ? 'Proses...' : 'KONFIRMASI PENGELUARAN'}</button>
               <button onClick={() => setShowModal(false)} className="w-full text-gray-400 text-[10px] font-bold uppercase tracking-widest">Batalkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Keuangan;