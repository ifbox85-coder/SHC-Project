import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { supabase } from '../configs/database';
import { useNavigate, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShoppingCart, PackageCheck, ClipboardList, Plus, ArrowDown, PackagePlus, AlertCircle, Mail } from 'lucide-react';

const Logistik = () => {
  const theme = useContext(ThemeContext);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'stok'); 
  const [inventory, setInventory] = useState([]);
  const [penerimaanForm, setPenerimaanForm] = useState({ productId: '', qty: '', supplier: '' });
  const [isLoading, setIsLoading] = useState(false);
  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const navigate = useNavigate();

  // Data produk yang kritis untuk PO
  const reorderList = inventory.filter(i => i.stock <= 5 && i.type === 'Produk');
  
  // Data produk yang akan kedaluwarsa dalam 3 bulan
  const expiringProducts = inventory.filter(i => i.expired_at && new Date(i.expired_at) < new Date(new Date().setMonth(new Date().getMonth() + 3)));

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    const { data } = await supabase.from('services').select('*').eq('type', 'Produk').eq('is_deleted', false);
    if (data) setInventory(data);
  };

  const handleUpdateStok = async (id, newQty) => {
    if (isNaN(newQty)) return;
    const { error } = await supabase.from('services').update({ stock: newQty }).eq('id', id);
    if (!error) fetchInventory();
  };

  const handleEmailPO = () => {
    if (reorderList.length === 0) return alert("Tidak ada produk dengan stok kritis yang perlu dipesan.");
    const subject = encodeURIComponent(`Permintaan Pengadaan Barang (PO) - ${theme.clinicName}`);
    let bodyText = `Daftar Barang Harus Dipesan (Stok <= 5):\n\n`;
    reorderList.forEach((item, idx) => {
      bodyText += `${idx + 1}. ${item.name} (Sisa: ${item.stock}, Kode: ${item.code})\n`;
    });
    window.location.href = `mailto:admin@clinic.com?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  };

  const generatePOPDF = async () => {
    if (reorderList.length === 0) return alert("Tidak ada produk dengan stok kritis untuk dipesan.");
    
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    
    // Header Klinik
    if (theme.logo) {
      try {
        const img = new Image();
        img.src = theme.logo;
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        doc.addImage(img, 'PNG', margin, 12, 20, 20);
      } catch (e) {}
    }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text((theme.clinicName || 'Klinik').toUpperCase(), 40, 22);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(theme.address || '', 40, 28);
    doc.line(margin, 35, pageWidth - margin, 35);

    // Judul PO
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("PURCHASE ORDER (DRAF PESANAN)", pageWidth / 2, 45, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Nomor Dokumen: PO/${new Date().getTime()}`, pageWidth / 2, 52, { align: 'center' });
    doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth / 2, 58, { align: 'center' });

    // Tabel Barang
    autoTable(doc, {
      startY: 65,
      head: [['No', 'Kode SKU', 'Nama Produk', 'Stok Sisa', 'Rencana Pesan']],
      body: reorderList.map((item, i) => [i + 1, item.code, item.name, item.stock, '__________']),
      theme: 'grid',
      headStyles: { fillColor: theme.primaryColor }
    });

    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.text("Dibuat Oleh,", margin, finalY);
    doc.text("Disetujui Oleh (Owner),", pageWidth - margin - 50, finalY);
    
    doc.setFont(undefined, 'bold');
    doc.text(userProfile.name || 'Petugas Logistik', margin, finalY + 20);
    doc.text("( ____________________ )", pageWidth - margin - 50, finalY + 20);
    
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.text("* Draf ini dibuat otomatis berdasarkan sistem monitoring stok kritis.", margin, finalY + 30);

    doc.save(`PO_Logistik_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleTerimaBarang = async () => {
    if (!penerimaanForm.qty || !penerimaanForm.productId) return alert("Isi data dengan lengkap!");
    setIsLoading(true);
    
    const target = inventory.find(i => i.id === penerimaanForm.productId);
    const newStock = (target.stock || 0) + parseInt(penerimaanForm.qty);
    
    const { error } = await supabase.from('services').update({ stock: newStock }).eq('id', penerimaanForm.productId);
    if (!error) {
      alert("Stok berhasil ditambahkan!");
      fetchInventory();
      setPenerimaanForm({ productId: '', qty: '', supplier: '' });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="p-4 text-white shadow-md" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex items-center mb-3">
          <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl">←</button>
          <h2 className="font-bold text-sm uppercase tracking-wider">Logistik & Inventory</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar text-[10px] font-black uppercase">
           {[
             { id: 'stok', label: 'Stok Opname', icon: ClipboardList },
             { id: 'penerimaan', label: 'Penerimaan Barang', icon: PackageCheck },
             { id: 'pengadaan', label: 'Pengadaan (PO)', icon: ShoppingCart }
           ].map(t => (
             <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${activeTab === t.id ? 'border-white opacity-100' : 'border-transparent opacity-50'}`}>
               <t.icon size={14} /> {t.label}
             </button>
           ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {activeTab === 'stok' && (
          <>
          <div className="space-y-4">
             {expiringProducts.length > 0 && (
               <div className="bg-orange-50 p-4 rounded-3xl shadow-sm border-l-4 border-orange-500 flex justify-between items-center">
                 <div>
                   <h3 className="font-bold text-orange-700 text-xs uppercase">Peringatan Kedaluwarsa</h3>
                   <p className="text-[10px] text-orange-600 italic">{expiringProducts.length} produk akan kedaluwarsa dalam 3 bulan!</p>
                 </div>
                 <button onClick={() => alert("Fitur detail kedaluwarsa belum tersedia.")} className="p-3 bg-orange-600 text-white rounded-2xl shadow-lg active:scale-90">
                   <AlertCircle size={18} />
                 </button>
               </div>
             )}



             <div className="bg-white p-6 rounded-3xl shadow-sm border-l-4 border-orange-500 flex justify-between items-center">
               <div>
                 <h3 className="font-bold text-gray-700 text-xs uppercase">Rekomendasi Pengadaan (PO)</h3>
                 <p className="text-[10px] text-gray-400 italic">Daftar item dengan stok kritis.</p>
               </div>
               <button onClick={handleEmailPO} className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90">
                 <Mail size={18} />
               </button>
             </div>
              <h3 className="font-bold text-gray-700 text-xs uppercase">Monitoring Persediaan</h3>
              <p className="text-[10px] text-gray-400 italic">Sesuaikan stok fisik dengan sistem (Stok Opname).</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {inventory.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-3xl shadow-sm flex justify-between items-center border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-800 text-sm leading-tight">{item.name}</p>
                    <p className="text-[10px] font-mono text-gray-400 uppercase mt-1">{item.code} | HPP: Rp {item.purchase_price?.toLocaleString()}</p>
                    {item.expired_at && (
                      <p className="text-[9px] text-red-500 font-bold mt-1">ED: {new Date(item.expired_at).toLocaleDateString('id-ID')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase">Sistem</p>
                      <p className={`font-black ${item.stock < 10 ? 'text-red-500' : 'text-green-600'}`}>{item.stock}</p>
                    </div>
                    <button 
                      onClick={() => {
                        const n = window.prompt(`Update stok fisik untuk ${item.name}:`, item.stock);
                        if (n !== null) {
                          const cleanVal = n.replace(/\D/g, '');
                          handleUpdateStok(item.id, parseInt(cleanVal || 0));
                        }
                      }}
                      className="p-2 bg-gray-100 rounded-2xl text-gray-500 active:scale-90"
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'penerimaan' && (
           <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
             <div className="flex items-center gap-2 text-blue-600 mb-2">
               <PackagePlus size={20} />
               <h3 className="font-black text-xs uppercase tracking-widest">Input Barang Masuk</h3>
             </div>
             <div className="space-y-3">
               <select 
                className="w-full p-3 bg-gray-50 rounded-2xl text-sm outline-none"
                value={penerimaanForm.productId}
                onChange={(e) => setPenerimaanForm({...penerimaanForm, productId: e.target.value})}
               >
                 <option value="">-- Pilih Produk --</option>
                 {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (Stok: {i.stock})</option>)}
               </select>
               <div className="grid grid-cols-2 gap-3">
                 <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="Jumlah (Qty)" 
                  className="p-3 bg-gray-50 rounded-2xl text-sm outline-none font-bold" 
                  value={penerimaanForm.qty ? Number(penerimaanForm.qty).toLocaleString('id-ID') : ''} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPenerimaanForm({...penerimaanForm, qty: val});
                  }} 
                 />
                 <input type="text" placeholder="Supplier" className="p-3 bg-gray-50 rounded-2xl text-sm outline-none" 
                   value={penerimaanForm.supplier} onChange={(e) => setPenerimaanForm({...penerimaanForm, supplier: e.target.value})} />
               </div>
               <button 
                onClick={handleTerimaBarang}
                disabled={isLoading}
                className="w-full py-4 bg-gray-800 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg"
               >
                 {isLoading ? 'Memproses...' : 'KONFIRMASI BARANG MASUK'}
               </button>
             </div>
           </div>
        )}

        {activeTab === 'pengadaan' && (
           <div className="bg-white p-10 rounded-3xl text-center shadow-sm">
             <ShoppingCart size={48} className="mx-auto text-gray-200 mb-4" />
             <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Modul Pengadaan (PO)</p>
             <p className="text-[10px] text-gray-300 italic mt-1">Rencanakan pembelian barang ke supplier.</p>
             <button onClick={generatePOPDF} className="mt-6 px-6 py-3 bg-orange-600 text-white rounded-2xl text-[10px] font-bold uppercase shadow-lg active:scale-95 transition-all">+ BUAT PESANAN (PO)</button>
           </div>
        )}
      </div>
    </div>
  );
};

export default Logistik;