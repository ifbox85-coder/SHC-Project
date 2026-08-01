import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../configs/database';

const Kasir = () => {
  const theme = useContext(ThemeContext);
  const [queue, setQueue] = useState([]);
  const [selectedEncounter, setSelectedEncounter] = useState(null);
  const [dailyBillings, setDailyBillings] = useState([]);
  const [ppnRate, setPpnRate] = useState(0.11); 
  const [diskon, setDiskon] = useState(0);
  const [diskonMode, setDiskonMode] = useState('Rp'); // 'Rp' atau '%'
  const [diskonScope, setDiskonScope] = useState('Global'); // 'Global', 'Treatment', 'Produk', 'Jasa'
  const [isRoundingActive, setIsRoundingActive] = useState(false);
  const [jumlahBayar, setJumlahBayar] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState('Tunai');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchQueue();
    fetchDailyBillings();
    fetchSettings();
  }, [startDate, endDate]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('ppn_rate, is_rounding_active').limit(1).maybeSingle();
    if (data) {
      if (data.ppn_rate != null) setPpnRate(data.ppn_rate / 100);
      setIsRoundingActive(data.is_rounding_active || false);
    }
  };

  const fetchDailyBillings = async () => {
    const { data, error } = await supabase
      .from('billings')
      .select(`
        *,
        encounters (
          id,
          encounter_number,
          queue_number,
          ttv_data,
          patients (id, full_name, rm_number, phone_number),
          staff (name)
        )
      `)
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`)
      .order('created_at', { ascending: false });

    if (error) {
      // Error loading billings
    } else {
      setDailyBillings(data || []);
    }
  };

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('encounters')
      .select(`
        id,
        status,
        ttv_data,
        queue_number,
        encounter_number,
        created_at,
        patients (id, full_name, rm_number, phone_number),
        staff (name)
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: true });

    if (error) {
      // Error loading queue
    } else {
      setQueue(data);
    }
  };

  const handleConfirmPayment = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Hitung nilai Piutang (jika ada)
      const currentDebt = selisihBayar < 0 ? Math.abs(selisihBayar) : 0;

      // 1. Simpan data ke tabel billings
      const { error: billError } = await supabase
        .from('billings')
        .insert([{
          encounter_id: selectedEncounter.id,
          subtotal: subTotal,
          discount: calculatedDiskon,
          discount_detail: { mode: diskonMode, scope: diskonScope, value: diskon },
          tax: totalPPN,
          grand_total: finalGrandTotal,
          amount_paid: Number(jumlahBayar) || 0,
          debt_amount: currentDebt,
          billing_detail: { 
            is_rounded: isRoundingActive, 
            amount_paid: Number(jumlahBayar) || 0, 
            change: selisihBayar 
          },
          payment_method: metodeBayar
        }]);

      if (billError) throw billError;

      // Catat Log Pembayaran
      const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
      await supabase.from('activity_logs').insert([{
        staff_id: userProfile.id || 'SYSTEM',
        action: 'PEMBAYARAN',
        description: `Menyelesaikan pembayaran nota ${selectedEncounter.encounter_number} senilai Rp ${finalGrandTotal.toLocaleString()}`
      }]);

      // 1.5 Logika Pengurangan Stok Produk Otomatis
      const productsInBill = billingItems.filter(item => item.type === 'Produk');
      if (productsInBill.length > 0) {
        // Kelompokkan Qty per ID Produk (karena 1 entry di array dianggap 1 Qty)
        const stockUpdates = productsInBill.reduce((acc, item) => {
          acc[item.id] = (acc[item.id] || 0) + 1;
          return acc;
        }, {});

        // Update stok masing-masing produk ke tabel 'services'
        for (const [prodId, qtyToReduce] of Object.entries(stockUpdates)) {
          const { data: currentItem } = await supabase
            .from('services')
            .select('stock')
            .eq('id', prodId)
            .single();
          
          if (currentItem) {
            const updatedStock = (currentItem.stock || 0) - qtyToReduce;
            await supabase.from('services').update({ stock: updatedStock }).eq('id', prodId);
          }
        }
      }

      // 2. Tentukan status selanjutnya
      // Jika masih ada piutang, status bisa tetap 'completed' atau 'debt' jika Anda ingin membedakan
      // Namun secara standar alur, kita anggap 'finished' dari sisi pelayanan medis.
      const nextStatus = 'finished';

      const { error: encError } = await supabase
        .from('encounters')
        .update({ status: nextStatus })
        .eq('id', selectedEncounter.id);

      if (encError) throw encError;

      setPaymentSuccess(true);
      fetchQueue();
      fetchDailyBillings();
    } catch (err) {
      if (err.message?.includes('row-level security policy')) {
        alert("Gagal Memproses: Izin akses database ditolak (RLS) untuk tabel 'billings'.\n\nPastikan Anda sudah menjalankan SQL Policy di Dashboard Supabase agar tabel ini bisa diisi.");
      } else {
        alert("Gagal memproses pembayaran: " + err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  const handleWhatsApp = () => {
    let phone = selectedEncounter.patients?.phone_number || '';
    
    // Sanitasi nomor telepon: hapus karakter non-digit dan ubah 08 menjadi 62
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    if (!phone) return alert("Nomor WhatsApp pasien tidak tersedia!");

    const message = 
      `*NOTA DIGITAL - ${theme.clinicName}*\n\n` +
      `Halo, *${selectedEncounter.patients?.full_name}*\n` +
      `Terima kasih telah melakukan perawatan di klinik kami.\n\n` +
      `*No. Rawat:* ${selectedEncounter.encounter_number}\n` +
      `*Total Bayar:* Rp ${finalGrandTotal.toLocaleString()}\n` +
      `*Status:* ${selisihBayar < 0 ? 'DIBAYAR SEBAGIAN' : 'LUNAS'}\n\n` +
      `Simpan pesan ini sebagai bukti transaksi sah Anda.\n` +
      `Semoga sehat selalu ✨`;

    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const resetKasir = () => {
    setSelectedEncounter(null);
    setPaymentSuccess(false);
    setJumlahBayar('');
    setShowPrintModal(false);
    setDiskon(0);
    setDiskonScope('Global');
  };

  const handleReprint = (bill) => {
    // Muat kembali data bill ke dalam state kasir
    setSelectedEncounter(bill.encounters);
    setDiskon(bill.discount_detail?.value || 0);
    setDiskonMode(bill.discount_detail?.mode || 'Rp');
    setDiskonScope(bill.discount_detail?.scope || 'Global');
    setIsRoundingActive(bill.billing_detail?.is_rounded || false);
    setJumlahBayar(bill.amount_paid?.toString() || '');
    setMetodeBayar(bill.payment_method);
    setPaymentSuccess(true); // Penting agar nota muncul sebagai nota resmi (bukan draft)
    setShowPrintModal(true);
  };

  // Rekapitulasi Pembayaran Hari Ini
  const rekap = dailyBillings.reduce((acc, curr) => {
    const amount = Number(curr.amount_paid) || 0;
    const total = Number(curr.grand_total) || 0;
    // Nilai yang masuk ke pendapatan adalah nilai bayar yang tidak termasuk kembalian
    const actualReceived = Math.min(amount, total);

    if (curr.payment_method === 'Tunai') acc.tunai += actualReceived;
    else acc.nonTunai += actualReceived;
    acc.piutang += (Number(curr.debt_amount) || 0);
    return acc;
  }, { tunai: 0, nonTunai: 0, piutang: 0 });

  // Tampilan Daftar Antrean Kasir
  if (!selectedEncounter) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-4 text-white shadow-md flex items-center" style={{ backgroundColor: theme.primaryColor }}>
          <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl">←</button>
          <h2 className="font-bold uppercase">Antrean Kasir & Pembayaran</h2>
        </div>

        <div className="p-4 space-y-3">
          <h3 className="font-black text-gray-400 text-xs uppercase tracking-widest text-center py-2">Menunggu Pembayaran</h3>
          {queue.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-gray-400 text-sm italic">Tidak ada tagihan tertunda</p>
              <button onClick={fetchQueue} className="mt-2 text-xs font-bold text-blue-500 underline uppercase">Refresh</button>
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
                    <span className="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-black">{item.queue_number}</span>
                    <span className="text-[9px] text-gray-400 font-mono">{item.encounter_number}</span>
                  </div>
                  <h4 className="font-bold text-gray-800">{item.patients?.full_name}</h4>
                  <p className="text-[10px] text-gray-500 uppercase font-mono">RM: {item.patients?.rm_number} | Layanan Selesai</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full font-bold">BAYAR</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rekapitulasi & Riwayat Hari Ini */}
        <div className="p-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Periode Rekap</label>
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

          <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">Rekap Pendapatan Periode Ini</h3>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2 rounded-xl shadow-sm border-b-4 border-green-500">
              <p className="text-[8px] font-bold text-gray-400 uppercase">Tunai</p>
              <p className="text-[10px] font-black text-green-600 truncate">Rp {rekap.tunai.toLocaleString()}</p>
            </div>
            <div className="bg-white p-2 rounded-xl shadow-sm border-b-4 border-blue-500">
              <p className="text-[8px] font-bold text-gray-400 uppercase">Non-Tunai</p>
              <p className="text-[10px] font-black text-blue-600 truncate">Rp {rekap.nonTunai.toLocaleString()}</p>
            </div>
            <div className="bg-white p-2 rounded-xl shadow-sm border-b-4 border-red-500">
              <p className="text-[8px] font-bold text-gray-400 uppercase">Piutang</p>
              <p className="text-[10px] font-black text-red-600 truncate">Rp {rekap.piutang.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="bg-gray-50 p-2 border-b">
              <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Transaksi Selesai Hari Ini ({dailyBillings.length})</h4>
            </div>
            <div className="divide-y max-h-64 overflow-y-auto no-scrollbar">
              {dailyBillings.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic text-center py-6 uppercase tracking-tighter">Belum ada transaksi selesai</p>
              ) : (
                dailyBillings.map((bill) => (
                  <div key={bill.id} className="p-3 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-gray-700 uppercase leading-none mb-1">{bill.encounters?.patients?.full_name || 'Pelanggan Umum'}</p>
                      <p className="text-[8px] text-gray-400 uppercase font-mono">{bill.payment_method} • {new Date(bill.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-800">Rp {bill.grand_total.toLocaleString()}</p>
                        {bill.debt_amount > 0 && <p className="text-[8px] font-bold text-red-500 leading-none">Piutang: {bill.debt_amount.toLocaleString()}</p>}
                      </div>
                      <button 
                        onClick={() => handleReprint(bill)}
                        className="p-2 bg-gray-100 rounded-lg text-gray-500 active:scale-90 transition-transform"
                        title="Cetak Ulang Nota"
                      >
                        🖨️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Kalkulasi tagihan berdasarkan data asli dari database
  const billingItems = selectedEncounter.ttv_data?.items || [];
  const subTotal = billingItems.reduce((acc, item) => acc + (Number(item.selling_price) || 0), 0);

  // Hitung dasar nilai yang akan didiskon berdasarkan Scope
  const amountToDiscount = diskonScope === 'Global' 
    ? subTotal 
    : billingItems
        .filter(item => item.type === diskonScope)
        .reduce((acc, item) => acc + (Number(item.selling_price) || 0), 0);

  // Hitung nilai nominal diskon
  const calculatedDiskon = diskonMode === '%' 
    ? (amountToDiscount * (diskon / 100)) 
    : diskon;

  const totalSetelahDiskon = subTotal - calculatedDiskon;
  const totalPPN = totalSetelahDiskon * ppnRate;
  const rawGrandTotal = totalSetelahDiskon + totalPPN;

  // Logika Pembulatan Ribuan
  const finalGrandTotal = isRoundingActive 
    ? Math.round(rawGrandTotal / 1000) * 1000 
    : Math.round(rawGrandTotal);

  // Kalkulasi Kembalian / Kurang Bayar
  const selisihBayar = (Number(jumlahBayar) || 0) - finalGrandTotal;

  // Komponen Konten Struk (Disesuaikan untuk Blueprint 58D)
  const ThermalReceipt = () => {
    const receiptStyle = {
      width: '52mm', // Beri sedikit margin untuk kertas 58mm
      padding: '10px 4px',
      fontFamily: 'monospace, "Courier New", Courier',
      fontSize: '8pt', // Ukuran point lebih baik untuk cetak, 8pt biasanya ideal
      lineHeight: '1.3', // Spasi baris lebih renggang agar tidak gepeng
      color: '#000',
    };
    return (
    <div className="bg-white text-black relative overflow-hidden printable-content" style={receiptStyle}>
      {/* Watermark Background untuk Preview (Draft) - tidak ikut tercetak */}
      {!paymentSuccess && !showPrintModal && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.08] flex flex-wrap justify-center content-center gap-2 rotate-[-25deg] select-none text-[10px] font-black uppercase leading-none">
          {Array(60).fill("DRAFT NOTA PREVIEW ").map((txt, i) => (
            <span key={i} className="whitespace-nowrap">{txt}</span>
          ))}
        </div>
      )}
      <div className="text-center mb-2">
        <p className={`text-[9pt] font-bold border-b border-t border-black py-0.5 mb-1 uppercase ${paymentSuccess ? '' : 'italic'}`}>
          {paymentSuccess ? "NOTA PEMBAYARAN" : "DRAFT TAGIHAN"}
        </p>
        {/* Logo Klinik */}
        <img 
          src={theme.logo} 
          alt="Logo" 
          className="mx-auto h-12 w-auto mb-1 object-contain"
          onError={(e) => e.target.style.display = 'none'}
        />
        <p className="font-bold text-[10pt] uppercase mt-1">{theme.clinicName}</p>
        <p className="text-[7pt]">{theme.address}</p>
        <p className="text-[7pt]">Telp: 0812-XXXX-XXXX</p>
      </div>

      <div className="border-b border-dashed border-gray-400 my-1"></div>
      
      <div className="flex justify-between">
        <span>Tgl : {new Date().toLocaleDateString('id-ID')}</span>
        <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <p>No  : {selectedEncounter.encounter_number}</p>
      <p>Pas : {selectedEncounter.patients?.full_name?.substring(0, 15)}</p>
      <p>Staff: {selectedEncounter.staff?.name?.substring(0, 15)}</p>

      <div className="border-b border-dashed border-gray-400 my-1"></div>

      <div className="space-y-1">
        {billingItems.map((item, idx) => (
          <div key={idx}>
            <p>{item.name}</p>
            <div className="flex justify-between">
              <span>1 x {Number(item.selling_price).toLocaleString()}</span>
              <span>{Number(item.selling_price).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-b border-dashed border-gray-400 my-1"></div>

      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{subTotal.toLocaleString()}</span>
        </div>
        {calculatedDiskon > 0 && (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span>-{calculatedDiskon.toLocaleString()}</span>
          </div>
        )}
        {totalPPN > 0 && (
          <div className="flex justify-between">
            <span>PPN</span>
            <span>{Math.round(totalPPN).toLocaleString()}</span>
          </div>
        )}
        {isRoundingActive && (
          <div className="flex justify-between italic">
            <span>Pembulatan</span>
            <span>{Math.round(finalGrandTotal - rawGrandTotal).toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-[10pt] pt-1">
          <span>TOTAL</span>
          <span>{finalGrandTotal.toLocaleString()}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-gray-400 my-1"></div>

      <div>
        <div className="flex justify-between uppercase">
          <span>{paymentSuccess ? metodeBayar : 'Rencana Bayar'}</span>
          <span>{(Number(jumlahBayar) || 0).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>{paymentSuccess ? (selisihBayar >= 0 ? 'Kembali' : 'Piutang') : 'Sisa Bayar'}</span>
          <span>{paymentSuccess ? Math.abs(selisihBayar).toLocaleString() : (finalGrandTotal > (Number(jumlahBayar) || 0) ? (finalGrandTotal - (Number(jumlahBayar) || 0)).toLocaleString() : 0)}</span>
        </div>
      </div>

      <div className="text-center mt-4 uppercase text-[7pt]">
        <p>{theme.footerNota || "*** TERIMA KASIH ***"}</p>
        <p className="italic opacity-70">Layanan: SHC-System</p>
      </div>
    </div>
  )};

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-32 no-print">
        {/* Header */}
      <div className="p-4 text-white shadow-md flex justify-between items-center" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex items-center">
          <button onClick={() => setSelectedEncounter(null)} className="mr-3 text-2xl active:scale-90 transition-transform">←</button>
          <h2 className="font-bold leading-tight">Kasir / Pembayaran</h2>
          <p className="text-[10px] opacity-70 ml-2">| {selectedEncounter.encounter_number}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase">{selectedEncounter.patients?.full_name}</p>
          <p className="text-[10px] font-mono">RM: {selectedEncounter.patients?.rm_number}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 1. Rincian Item */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-100 p-2 text-[10px] font-bold text-gray-500 uppercase flex justify-between">
            <span>Item / Deskripsi</span>
            <span>Total</span>
          </div>
          <div className="p-2 divide-y">
            {billingItems.length === 0 && <p className="text-xs text-center py-4 text-gray-400">Tidak ada item tagihan</p>}
            {billingItems.map((item, idx) => (
              <div key={idx} className="py-2 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-[10px] text-gray-400 uppercase">{item.type}</p>
                </div>
                <p className="text-sm font-bold">Rp {item.selling_price?.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Ringkasan Biaya & Diskon */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Sub-Total</span>
            <span>Rp {subTotal.toLocaleString()}</span>
          </div>
          
          {/* Konfigurasi Diskon Baru */}
          <div className="bg-red-50 p-3 rounded-lg border border-red-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-red-700 uppercase">Pengaturan Diskon</span>
              <div className="flex bg-white rounded-md border border-red-200 overflow-hidden">
                {['Rp', '%'].map(m => (
                  <button 
                    key={m} 
                    onClick={() => setDiskonMode(m)}
                    className={`px-3 py-1 text-xs font-bold ${diskonMode === m ? 'bg-red-600 text-white' : 'text-red-600'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {['Global', 'Treatment', 'Produk', 'Jasa'].map(s => (
                <button 
                  key={s} 
                  onClick={() => setDiskonScope(s)}
                  className={`flex-1 py-1 rounded text-[9px] font-bold border ${diskonScope === s ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-400'}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center text-sm text-red-600">
              <span className="text-xs italic">Nilai Potongan ({diskonScope})</span>
              <div className="flex items-center gap-1 border-b border-red-300">
                <span className="text-xs">{diskonMode}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-24 text-right bg-transparent outline-none font-bold"
                  value={diskonMode === 'Rp' ? (diskon ? Number(diskon).toLocaleString('id-ID') : '') : (diskon || '')}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setDiskon(Number(val));
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between text-sm text-gray-600">
            <span>PPN ({ppnRate * 100}%)</span>
            <span>Rp {Math.round(totalPPN).toLocaleString()}</span>
          </div>
          <hr />
          <div className="flex justify-between items-center py-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isRoundingActive} 
                onChange={(e) => setIsRoundingActive(e.target.checked)}
                className="w-4 h-4 accent-gold"
              />
              Aktifkan Pembulatan Ribuan
            </label>
            {isRoundingActive && <span className="text-[10px] italic text-gold-dark font-bold">Dibulatkan</span>}
          </div>
          <div className="flex justify-between text-xl font-bold" style={{ color: theme.primaryColor }}>
            <span>TOTAL AKHIR</span>
            <span style={{ color: theme.primaryColor }}>Rp {finalGrandTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* 2.5 Input Pembayaran & Kembalian */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4 border-2 border-gold-light">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Jumlah Bayar (Cash/Transfer)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setJumlahBayar(finalGrandTotal)} className="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold text-gray-600 uppercase">Uang Pas</button>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">Rp</span>
            <input 
              type="text"
              inputMode="numeric"
              className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-2xl font-black outline-none focus:border-gold transition-colors"
              placeholder="0"
              value={jumlahBayar !== '' ? Number(jumlahBayar).toLocaleString('id-ID') : ''}
              onChange={(e) => {
                // Hanya ambil angka saja, hapus titik atau karakter lain
                const val = e.target.value.replace(/\D/g, '');
                setJumlahBayar(val);
              }}
            />
          </div>

          <div className={`p-3 rounded-xl flex justify-between items-center ${selisihBayar >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <span className={`text-xs font-bold ${selisihBayar >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {selisihBayar >= 0 ? 'KEMBALIAN' : 'PIUTANG (KEKURANGAN)'}
            </span>
            <span className={`text-lg font-black ${selisihBayar >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Rp {Math.abs(selisihBayar).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 3. Metode Pembayaran */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <label className="text-xs font-bold text-gray-500 uppercase">Metode Pembayaran</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {['Tunai', 'Transfer/QRIS'].map((m) => (
              <button 
                key={m}
                onClick={() => setMetodeBayar(m)}
                className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${metodeBayar === m ? 'border-transparent text-white shadow-md' : 'border-gray-200 text-gray-500'}`}
                style={metodeBayar === m ? { backgroundColor: theme.primaryColor } : {}}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t space-y-2">
        {!paymentSuccess ? (
          <>
            <div className="flex gap-2">
              <button 
                onClick={handleWhatsApp}
                className="flex-1 py-3 border rounded-xl text-gray-600 text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>📧</span> Preview WA
              </button>
              <button 
                onClick={handlePrint}
                className="flex-1 py-3 border rounded-xl text-gray-600 text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>🖨️</span> Preview Nota
              </button>
            </div>
            <button 
              onClick={handleConfirmPayment}
              disabled={isSaving || !jumlahBayar || Number(jumlahBayar) <= 0}
              className="w-full py-4 rounded-xl text-white font-bold shadow-lg text-lg uppercase" 
              style={{ backgroundColor: isSaving ? '#ccc' : theme.primaryColor }}
            >
              {isSaving ? 'MEMPROSES...' : 'Konfirmasi & Selesai'}
            </button>
          </>
        ) : (
          <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 space-y-4 animate-fadeIn">
            <div className="text-center">
              <p className="text-green-600 font-black text-lg">PEMBAYARAN BERHASIL!</p>
              <p className="text-[10px] text-green-700">Data telah masuk ke laporan keuangan harian.</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleWhatsApp}
                className="flex-1 py-4 bg-white border-2 border-green-600 text-green-600 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm"
              >
                <span>📱</span> KIRIM WA
              </button>
              <button 
                onClick={handlePrint}
                className="flex-1 py-4 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <span>🖨️</span> CETAK NOTA
              </button>
            </div>
            <button 
              onClick={resetKasir}
              className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm uppercase"
            >
              Kembali ke Antrean
            </button>
          </div>
        )}
      </div>
      </div>

        {/* Modal Preview Struk (Blueprint 58D Size) */}
        {showPrintModal && (
          <div className="print-container">
            <div className="fixed inset-0 bg-black bg-opacity-80 z-[100] flex flex-col items-center justify-start pt-10 p-4 no-print overflow-y-auto">
              <div className="bg-white shadow-2xl rounded-lg overflow-hidden mb-4">
                <ThermalReceipt />
              </div>
              
              <div className="flex gap-3 w-full max-w-[58mm] no-print">
                <button 
                  onClick={() => {
                    if (paymentSuccess) {
                      resetKasir();
                    } else {
                      setShowPrintModal(false);
                    }
                  }}
                  className="flex-1 py-3 bg-white text-gray-700 rounded-xl font-bold text-sm uppercase"
                >Batal</button>
                <button 
                  onClick={() => window.print()}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm uppercase shadow-lg"
                >Cetak</button>
              </div>
            </div>
          </div>
        )}
    </>
  );
};

export default Kasir;