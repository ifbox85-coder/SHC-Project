import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../App';
import { supabase } from '../configs/database';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, Users, DollarSign, Package, Calendar, Activity, ShoppingBag, Stethoscope, Sparkles, UserCheck, Clock, History, FileDown, CheckCircle2, PlusCircle, Trash2, User } from 'lucide-react';

const Manajemen = () => {
  const theme = useContext(ThemeContext);
  const [activeSub, setActiveSub] = useState('dashboard');
  const [activityLogs, setActivityLogs] = useState([]);
  const [debts, setDebts] = useState([]);
  const [showPayDebtModal, setShowPayDebtModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payroll, setPayroll] = useState([]);
  const [servicesStats, setServicesStats] = useState({ 
    topProducts: [], 
    topTreatments: [], 
    dailyRevenueTrend: [], 
    dailyStatsTable: [],
    todayRevenue: 0, 
    totalRevenue: 0,
    prevTotalRevenue: 0,
    revenueGrowth: 0,
    monthlyExpense: 0, 
    attendanceCount: 0,
    totalDirectTreatments: 0, 
    totalPurchases: 0,
    todayVisits: 0, 
    monthlyVisits: 0, 
    staffPerformance: [],
    totalConsultations: 0
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);

  // State untuk Checklist Dinamis
  const [checklistItems, setChecklistItems] = useState([
    { task: 'Kebersihan Ruang Tindakan', completed: false, assignedTo: 'Umum' },
    { task: 'Sterilisasi Alat Medis', completed: false, assignedTo: 'Perawat' },
    { task: 'Cek Stok Logistik Harian', completed: false, assignedTo: 'Admin' }
  ]);
  const [newTask, setNewTask] = useState('');
  const [assignee, setAssignee] = useState('');

  const userProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');

  useEffect(() => {
    if (activeSub === 'dashboard') {
      fetchServicesStats();
    } else if (activeSub === 'logaktivitas') {
      fetchActivityLogs();
    } else if (activeSub === 'laporanpiutang') {
      fetchDebts();
    } else if (activeSub === 'laporanjasa') {
      fetchPayrollData();
    } else if (activeSub === 'kpi&checklist') {
      fetchStaff();
    }
  }, [activeSub, selectedMonth, selectedYear, startDate, endDate]);

  const fetchStaff = async () => {
    const { data } = await supabase.from('staff').select('id, name').eq('is_active', true).order('name');
    if (data) setStaffList(data);
  };

  const fetchServicesStats = async () => {
    setIsLoading(true);
    try {
      // Periode Bulan Terpilih (Gunakan waktu lokal mulai 00:00)
      const startOfMonth = new Date(selectedYear, selectedMonth, 1, 0, 0, 0).toISOString();
      const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();
      
      // Periode Bulan Sebelumnya (Fix logic untuk perpindahan tahun di Januari)
      const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const startOfPrevMonth = new Date(prevYear, prevMonth, 1, 0, 0, 0).toISOString();
      const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59).toISOString();
      
      const todayStr = new Date().toLocaleDateString('en-CA'); // en-CA menghasilkan format YYYY-MM-DD lokal

      // 1. Fetch Revenue & Encounters
      const { data: billings } = await supabase
        .from('billings')
        .select(`
          grand_total, created_at, 
          encounters(
            ttv_data, 
            status, 
            assigned_staff_id,
            staff(name, role, photo_url)
          )
        `)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      const { data: prevBillings } = await supabase
        .from('billings')
        .select('grand_total')
        .gte('created_at', startOfPrevMonth)
        .lte('created_at', endOfPrevMonth);

      const totalRevenue = (billings || []).reduce((sum, b) => sum + (Number(b.grand_total) || 0), 0);
      const prevTotalRevenue = (prevBillings || []).reduce((sum, b) => sum + (Number(b.grand_total) || 0), 0);
      
      // Hitung Growth %
      const growth = prevTotalRevenue === 0 ? 100 : ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100;

      const todayRevenue = (billings || [])
        .filter(b => new Date(b.created_at).toLocaleDateString('en-CA') === todayStr)
        .reduce((sum, b) => sum + (Number(b.grand_total) || 0), 0);

      // 2. Fetch Expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);
      const totalExpense = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);

      // 3. Fetch Attendance
      const { count: attendanceToday } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'IN')
        .gte('created_at', `${todayStr}T00:00:00Z`);

      // 4. Agregasi Top Items & Service Counts
      const typeMap = { 'Treatment': 0, 'Produk': 0, 'Jasa': 0 };
      const productRanking = {};
      const treatmentRanking = {};
      let consultations = 0;
      const staffMap = {}; // Untuk Performa Staf
      const todayBillingsCount = (billings || []).filter(b => new Date(b.created_at).toLocaleDateString('en-CA') === todayStr).length;

      (billings || []).forEach(b => {
        const items = b.encounters?.ttv_data?.items || [];
        if (b.encounters?.ttv_data?.tujuan_layanan === 'Konsultasi') consultations++;

        items.forEach(item => {
          if (typeMap[item.type] !== undefined) {
            typeMap[item.type] += Number(item.selling_price) || 0;
          }
          
          // Ranking
          const rankMap = item.type === 'Produk' ? productRanking : (item.type === 'Treatment' ? treatmentRanking : null);
          if (rankMap) {
            if (!rankMap[item.name]) rankMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
            rankMap[item.name].qty += 1;
            rankMap[item.name].revenue += Number(item.selling_price) || 0;
          }
        });

        // Integrasi Performa Staf
        const staffId = b.encounters?.assigned_staff_id;
        const staffData = b.encounters?.staff;
        if (staffId && staffData) {
          if (!staffMap[staffId]) {
            staffMap[staffId] = { 
              id: staffId, 
              name: staffData.name, 
              role: staffData.role,
              photo_url: staffData.photo_url,
              todayCount: 0, 
              monthCount: 0 
            };
          }
          staffMap[staffId].monthCount++;
          if (new Date(b.created_at).toLocaleDateString('en-CA') === todayStr) staffMap[staffId].todayCount++;
        }
      });

      const typesData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));
      const top10Products = Object.values(productRanking).sort((a, b) => b.qty - a.qty).slice(0, 10);
      const top10Treatments = Object.values(treatmentRanking).sort((a, b) => b.qty - a.qty).slice(0, 10);
      const staffPerformance = Object.values(staffMap).sort((a, b) => b.monthCount - a.monthCount);

      // 5. Agregasi Data Tabel Harian & Trend Chart
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      
      const dailyStatsTable = [];
      const dailyRevenueTrend = [];

      for (let i = 1; i <= daysInMonth; i++) {
        const datePrefix = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        const prevDatePrefix = `${prevYear}-${(prevMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        
        // Filter menggunakan konversi tanggal lokal agar akurat
        const dayBillings = (billings || []).filter(b => new Date(b.created_at).toLocaleDateString('en-CA') === datePrefix);
        const dayRevenue = dayBillings.reduce((sum, b) => sum + (Number(b.grand_total) || 0), 0);
        
        const prevDayRevenue = (prevBillings || [])
          .filter(b => new Date(b.created_at).toLocaleDateString('en-CA') === prevDatePrefix)
          .reduce((sum, b) => sum + (Number(b.grand_total) || 0), 0);

        // Integrasi Absensi: Menghitung staf yang masuk pada tanggal tersebut
        const dayAttendance = 0; // Placeholder jika data absensi bulanan belum di-fetch secara bulk
        const dayConsultations = dayBillings.filter(b => b.encounters?.ttv_data?.tujuan_layanan === 'Konsultasi').length;

        // Untuk Tabel
        const dateObj = new Date(selectedYear, selectedMonth, i);
        dailyStatsTable.push({
          tgl: i,
          hari: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][dateObj.getDay()],
          pasien: dayBillings.length,
          konsul: dayConsultations,
          kasir: dayBillings.length,
          pendapatan: dayRevenue,
          absen: dayAttendance
        });

        // Untuk Grafik Trend
        dailyRevenueTrend.push({
          day: i,
          BulanIni: dayRevenue,
          BulanLalu: prevDayRevenue
        });
      }

      setServicesStats({ 
        types: typesData, 
        topProducts: top10Products,
        topTreatments: top10Treatments,
        dailyRevenueTrend,
        dailyStatsTable: dailyStatsTable.reverse(), // Terbaru di atas
        todayRevenue,
        totalRevenue,
        prevTotalRevenue,
        revenueGrowth: growth,
        monthlyExpense: totalExpense,
        attendanceCount: attendanceToday,
        todayVisits: todayBillingsCount,
        monthlyVisits: (billings || []).length,
        totalConsultations: consultations,
        totalDirectTreatments: (billings || []).filter(b => b.encounters?.ttv_data?.tujuan_layanan === 'Terapis').length,
        totalPurchases: (billings || []).filter(b => b.encounters?.ttv_data?.tujuan_layanan === 'Pembelian').length,
        staffPerformance: staffPerformance
      });
    } catch (error) {
      // Error handling dashboard stats
    }
    setIsLoading(false);
  };

  const fetchDebts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('billings')
      .select(`
        id, grand_total, amount_paid, debt_amount, created_at,
        encounters (
          encounter_number,
          patients (full_name, rm_number, phone_number)
        )
      `)
      .gt('debt_amount', 0)
      .order('created_at', { ascending: false });

    if (error) {
      // Error loading debts
    } else {
      setDebts(data);
    }
    setIsLoading(false);
  };

  const fetchPayrollData = async () => {
    setIsLoading(true);
    try {
      // 1. Ambil semua staff
      const { data: staff } = await supabase.from('staff').select('*').eq('is_deleted', false);
      
      // Menggunakan periode custom yang ditentukan
      const start = `${startDate}T00:00:00Z`;
      const end = `${endDate}T23:59:59Z`;

      const { data: billings } = await supabase
        .from('billings')
        .select('*, encounters(assigned_staff_id, ttv_data)')
        .gte('created_at', start)
        .lte('created_at', end);

      // 3. Kalkulasi Jasa per Staff
      const rekap = staff.map(s => {
        let totalJasa = 0;
        let rincian = [];

        billings.forEach(b => {
          if (b.encounters?.assigned_staff_id === s.id) {
            const items = b.encounters.ttv_data?.items || [];
            items.forEach(item => {
              let fee = 0;
              if (s.role === 'doctor') fee = Number(item.doctor_fee) || 0;
              else if (s.role === 'therapist') {
                const baseFee = Number(item.therapist_fee) || 0;
                // Terapis biasa & senior sama-sama mendapatkan base therapist_fee dari Master Data
                // Terapis senior mendapatkan tambahan senior_bonus (insentif flat per tindakan) 
                // Bonus hanya diberikan jika tindakan tersebut memiliki proporsi jasa terapis (baseFee > 0)
                const bonus = (s.is_senior && baseFee > 0) ? (Number(s.senior_bonus) || 0) : 0;
                
                // Total fee yang diterima terapis
                fee = baseFee > 0 ? (baseFee + bonus) : 0;
              }
              
              if (fee > 0) {
                totalJasa += fee;
                rincian.push({ item: item.name, fee: fee, date: new Date(b.created_at).toLocaleDateString() });
              }
            });
          }
        });

        return { ...s, totalJasa, rincian, takeHomePay: (Number(s.base_salary) || 0) + totalJasa };
      });

      setPayroll(rekap);
    } catch (err) { }
    setIsLoading(false);
  };

  const fetchActivityLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id, action, description, created_at,
          staff (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Error loading logs
      } else {
        setActivityLogs(data || []);
      }
    } catch (err) {
      // Error loading logs
    }
    setIsLoading(false);
  };

  const handlePayDebt = async () => {
    if (!selectedDebt) return;
    const amountToPay = Number(prompt(`Masukkan jumlah pelunasan untuk piutang No. Rawat ${selectedDebt.encounters?.encounter_number} (Sisa: Rp ${Number(selectedDebt.debt_amount).toLocaleString()}):`));
    
    if (isNaN(amountToPay) || amountToPay <= 0) {
      return alert("Jumlah pelunasan tidak valid.");
    }

    if (amountToPay > selectedDebt.debt_amount) {
      return alert("Jumlah pelunasan melebihi sisa piutang.");
    }

    setIsLoading(true);
    try {
      const newDebtAmount = selectedDebt.debt_amount - amountToPay;
      const newAmountPaid = selectedDebt.amount_paid + amountToPay;

      const { error } = await supabase
        .from('billings')
        .update({ debt_amount: newDebtAmount, amount_paid: newAmountPaid })
        .eq('id', selectedDebt.id);

      if (error) throw error;

      alert(`Piutang berhasil dilunasi sebagian/penuh sebesar Rp ${amountToPay.toLocaleString()}. Sisa piutang: Rp ${newDebtAmount.toLocaleString()}.`);
      setShowPayDebtModal(false);
      setSelectedDebt(null);
      fetchDebts(); // Refresh daftar piutang
    } catch (err) {
      // Error paying debt
      alert("Gagal melunasi piutang: " + err.message);
    } finally { setIsLoading(false); }
  };

  const generateDashboardPDF = async () => {
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    // Ambil IP Address untuk Audit Trail
    let ipAddress = "Unknown";
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      ipAddress = ipData.ip;
    } catch (e) { }

    // Header Klinik
    try {
      if (theme.logo) {
        const img = new Image();
        img.src = theme.logo;
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        doc.addImage(img, 'PNG', margin, 12, 20, 20);
      }
    } catch (e) {}

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(theme.clinicName.toUpperCase(), 40, 22);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(theme.address, 40, 28);
    doc.line(margin, 35, pageWidth - margin, 35);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("LAPORAN OPERASIONAL & PENDAPATAN", pageWidth / 2, 45, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Periode: ${monthNames[selectedMonth]} ${selectedYear}`, pageWidth / 2, 52, { align: 'center' });

    // Ringkasan Statistik
    autoTable(doc, {
      startY: 60,
      head: [['Metrik Utama', 'Nilai']],
      body: [
        ['Total Pendapatan Bulan Ini', `Rp ${servicesStats.totalRevenue.toLocaleString()}`],
        ['Pertumbuhan vs Bulan Lalu', `${servicesStats.revenueGrowth.toFixed(1)}%`],
        ['Total Kunjungan Pasien', `${servicesStats.monthlyVisits} Pasien`],
        ['Total Konsultasi', `${servicesStats.totalConsultations}`],
        ['Total Tindakan Langsung', `${servicesStats.totalDirectTreatments}`],
        ['Total Pembelian Produk', `${servicesStats.totalPurchases}`],
        ['Total Pengeluaran Operasional', `Rp ${servicesStats.monthlyExpense.toLocaleString()}`],
        ['Estimasi Profit (Bruto)', `Rp ${(servicesStats.totalRevenue - servicesStats.monthlyExpense).toLocaleString()}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: theme.primaryColor }
    });

    // Tabel Item Terlaris
    doc.text("TOP 10 TREATMENT TERLARIS", margin, doc.lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['No', 'Nama Treatment', 'Qty', 'Revenue']],
      body: servicesStats.topTreatments.map((t, i) => [i + 1, t.name, `${t.qty}x`, `Rp ${t.revenue.toLocaleString()}`]),
      theme: 'striped'
    });

    doc.addPage();
    doc.text("TOP 10 PRODUK TERLARIS", margin, 20);
    autoTable(doc, {
      startY: 25,
      head: [['No', 'Nama Produk', 'Qty', 'Revenue']],
      body: servicesStats.topProducts.map((p, i) => [i + 1, p.name, `${p.qty}x`, `Rp ${p.revenue.toLocaleString()}`]),
      theme: 'striped'
    });

    // Rekapitulasi Harian
    doc.text("REKAPITULASI OPERASIONAL HARIAN", margin, doc.lastAutoTable.finalY + 15);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Tgl', 'Hari', 'Pasien', 'Konsul', 'Kasir', 'Pendapatan']],
      body: [...servicesStats.dailyStatsTable].reverse().map(s => [s.tgl, s.hari, s.pasien, s.konsul, s.kasir, `Rp ${s.pendapatan.toLocaleString()}`]),
      styles: { fontSize: 8 }
    });

    // Tambahkan Footer Audit Trail di setiap halaman
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const footerY = pageHeight - 15;
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      doc.setFont(undefined, 'normal');
      doc.text(`Dokumen ini dihasilkan secara otomatis oleh sistem atas permintaan: ${userProfile.name || 'User'} (ID: ${userProfile.id}) | Waktu Cetak: ${new Date().toLocaleString('id-ID')} | IP: ${ipAddress}`, margin, footerY);
      doc.setFont(undefined, 'bold');
      doc.text("DOKUMEN RAHASIA: Laporan ini bersifat konfidensial dan hanya diperuntukkan bagi kepentingan internal manajemen klinik.", margin, footerY + 4);
    }

    doc.save(`Laporan_Dashboard_${monthNames[selectedMonth]}_${selectedYear}.pdf`);
  };

  const generatePDFSlip = async (data) => {
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Ambil IP Address (Opsional: Menggunakan API publik)
    let ipAddress = "Unknown";
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      ipAddress = ipData.ip;
    } catch (e) { }

    // --- HEADER (KOP) ---
    try {
      // Jika ada logo, tambahkan ke PDF
      if (theme.logo) {
        const img = new Image();
        img.src = theme.logo;
        // Menunggu gambar load agar bisa dirender ke PDF
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        doc.addImage(img, 'PNG', margin, 12, 25, 25);
      }
    } catch (err) { }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(theme.clinicName.toUpperCase(), 45, 22);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(theme.address, 45, 28);
    doc.line(margin, 40, pageWidth - margin, 40); // Garis Pembatas Kop

    doc.setTextColor(0); // Reset warna teks ke hitam

    // Info Pegawai
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("SLIP GAJI PEGAWAI", 105, 45, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`ID Pegawai : ${data.id}`, margin, 55);
    doc.text(`Nama       : ${data.name}`, margin, 60);
    doc.text(`Jabatan    : ${data.jabatan || data.role}`, margin, 65);
    doc.text(`Periode    : ${new Date(startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} s/d ${new Date(endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, 70);

    // Ringkasan Pendapatan
    autoTable(doc, {
      startY: 75,
      head: [['Keterangan', 'Nominal']],
      body: [
        ['Gaji Pokok', `Rp ${Number(data.base_salary || 0).toLocaleString()}`],
        ['Total Jasa Medis/Tindakan', `Rp ${data.totalJasa.toLocaleString()}`],
        [{content: 'TOTAL PENERIMAAN', styles: {fontStyle: 'bold'}}, {content: `Rp ${data.takeHomePay.toLocaleString()}`, styles: {fontStyle: 'bold'}}],
      ],
      theme: 'striped'
    });

    // Rincian Jasa
    const lastY = doc.lastAutoTable?.finalY || 110;
    doc.text("RINCIAN JASA TINDAKAN:", margin, lastY + 15);
    autoTable(doc, {
      startY: lastY + 20,
      head: [['Tanggal', 'Tindakan / Item', 'Fee']],
      body: data.rincian.map(r => [r.date, r.item, `Rp ${r.fee.toLocaleString()}`]),
      styles: { fontSize: 8 }
    });

    const finalY = doc.lastAutoTable.finalY;
    
    doc.setFontSize(8);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, margin, finalY + 10);
    doc.text("Tanda Tangan Manajemen,", 150, finalY + 20);
    doc.text("( ____________________ )", 150, finalY + 40);

    // --- FOOTER (AUDIT TRAIL & DISCLAIMER) ---
    const footerY = pageHeight - 15;
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.text(`Dokumen ini dicetak otomatis oleh sistem atas permintaan: ${userProfile.name || 'Unknown'} (ID: ${userProfile.id}) | IP: ${ipAddress}`, margin, footerY);
    doc.setFont(undefined, 'bold');
    doc.text("DOKUMEN RAHASIA: Informasi ini hanya untuk kepentingan internal manajemen dan dilarang untuk disebarluaskan.", margin, footerY + 4);

    doc.save(`Slip_Gaji_${data.name}_${data.id}.pdf`);
  };

  const sendSlipWA = (data) => {
    let phone = data.phone_number || '';
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    if (!phone) return alert("Nomor WA tidak tersedia");

    const msg = `*SLIP GAJI DIGITAL - ${theme.clinicName}*\\n\\nHalo *${data.name}*,\\nBerikut ringkasan pendapatan Anda periode ${new Date(startDate).toLocaleDateString('id-ID')} s/d ${new Date(endDate).toLocaleDateString('id-ID')}:\\n\\n- Gaji Pokok: Rp ${Number(data.base_salary || 0).toLocaleString()}\\n- Jasa Medis: Rp ${data.totalJasa.toLocaleString()}\\n- *Total Terima: Rp ${data.takeHomePay.toLocaleString()}*\\n\\nSilakan unduh file PDF yang dikirimkan Admin untuk rincian detail tindakan. Terima kasih ✨`;
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  const generateChecklistPDF = async () => {
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    let ipAddress = "Unknown";
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      ipAddress = ipData.ip;
    } catch (e) {}

    try {
      if (theme.logo) {
        const img = new Image();
        img.src = theme.logo;
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
        doc.addImage(img, 'PNG', margin, 12, 20, 20);
      }
    } catch (e) {}

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(theme.clinicName.toUpperCase(), 40, 22);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(theme.address, 40, 28);
    doc.line(margin, 35, pageWidth - margin, 35);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("DAFTAR INSTRUKSI KERJA / CHECKLIST OPERASIONAL", pageWidth / 2, 45, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, pageWidth / 2, 52, { align: 'center' });

    autoTable(doc, {
      startY: 60,
      head: [['No', 'Tugas / Instruksi Kerja', 'Penanggung Jawab', 'Status']],
      body: checklistItems.map((item, i) => [i + 1, item.task, item.assignedTo, item.completed ? 'SELESAI' : 'BELUM SELESAI']),
      theme: 'grid',
      headStyles: { fillColor: theme.primaryColor },
      styles: { fontSize: 9 }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Pemberi Intruksi", pageWidth - margin - 60, finalY);
    doc.setFont(undefined, 'bold');
    doc.text(userProfile.name || 'Petugas Klinik', pageWidth - margin - 60, finalY + 20);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Diverifikasi oleh sistem pada: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin - 60, finalY + 25);

    const footerY = pageHeight - 15;
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.text(`Dihasilkan oleh: ${userProfile.name} | IP: ${ipAddress} | Waktu: ${new Date().toLocaleString('id-ID')}`, margin, footerY);
    doc.save(`Checklist_Klinik_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header Navigation & Back Button */}
      <div className="p-4 text-white shadow-md" style={{ backgroundColor: theme.primaryColor }}>
        <div className="flex items-center mb-3">
          <button onClick={() => navigate('/dashboard')} className="mr-3 text-2xl">←</button>
          <h2 className="font-bold text-lg">Manajemen & Laporan</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar text-xs uppercase font-bold">
          {['Dashboard', 'Log Aktivitas', 'Laporan Piutang', 'Laporan Jasa', 'KPI & Checklist'].map((sub) => (
            <button 
              key={sub}
              onClick={() => setActiveSub(sub.toLowerCase().replace(/ /g, ''))}
              className={`pb-1 whitespace-nowrap ${activeSub === sub.toLowerCase().replace(/ /g, '') ? 'border-b-2 border-white font-black' : 'opacity-50'}`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-5">
        
        {/* SUBMENU 1: DASHBOARD ANALITIK */}
        {activeSub === 'dashboard' && (
          <div className="space-y-6">
            {/* Global Period Filter */}
            <div className="bg-white p-3 rounded-2xl shadow-sm flex gap-2 items-center overflow-x-auto no-scrollbar border border-gray-100">
              <Calendar size={16} className="text-gray-400 mr-1" />
              <select 
                className="bg-gray-50 border-none rounded-lg text-[11px] font-bold p-2 outline-none flex-1"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select 
                className="bg-gray-50 border-none rounded-lg text-[11px] font-bold p-2 outline-none w-20"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="h-4 w-px bg-gray-200 mx-2"></div>
              <button onClick={fetchServicesStats} className="text-[10px] font-black text-blue-600 uppercase">Apply</button>
              <div className="h-4 w-px bg-gray-200 mx-2"></div>
              <button onClick={generateDashboardPDF} className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1">
                <FileDown size={14} /> Export PDF
              </button>
            </div>

            {isLoading ? <p className="text-center py-20 text-gray-400 animate-pulse">Menganalisa data...</p> : (
              <>
                {/* SECTION 1: Kunjungan & Hadir */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-black text-gray-400 uppercase">Pasien Hari Ini</p>
                      <Sparkles size={16} className="text-gold" />
                    </div>
                    <p className="text-2xl font-black text-gray-800 mt-2">{servicesStats.todayVisits}</p>
                    <p className="text-[9px] text-gray-400 mt-1 uppercase">Total Bulan: <span className="font-bold text-gray-600">{servicesStats.monthlyVisits}</span></p>
                  </div>
                  <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-black text-gray-400 uppercase">Staf Hadir</p>
                      <UserCheck size={16} className="text-blue-500" />
                    </div>
                    <p className="text-2xl font-black text-gray-800 mt-2">{servicesStats.attendanceCount}</p>
                    <p className="text-[9px] text-gray-400 mt-1 uppercase italic">Real-time GPS Absen</p>
                  </div>
                </div>

                {/* SECTION 2: Pendapatan */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-emerald-600 p-4 rounded-3xl shadow-lg text-white">
                    <p className="text-[10px] font-black uppercase opacity-80">Today Revenue</p>
                    <p className="text-base font-black mt-1">Rp {servicesStats.todayRevenue.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800 p-4 rounded-3xl shadow-lg text-white">
                    <p className="text-[10px] font-black uppercase opacity-80">Month Income</p>
                    <p className="text-base font-black mt-1">Rp {servicesStats.totalRevenue.toLocaleString()}</p>
                  </div>
                </div>

                {/* SECTION 3: Kategori Layanan Bulanan */}
                <div className="bg-white p-3 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-3 divide-x text-center">
                  <div>
                    <Stethoscope size={16} className="mx-auto mb-1 text-blue-500" />
                    <p className="text-[7px] font-black text-gray-400 uppercase leading-none">Konsul</p>
                    <p className="text-xs font-black">{servicesStats.totalConsultations}</p>
                  </div>
                  <div>
                    <Sparkles size={16} className="mx-auto mb-1 text-gold" />
                    <p className="text-[7px] font-black text-gray-400 uppercase leading-none">Tindakan</p>
                    <p className="text-xs font-black">{servicesStats.totalDirectTreatments}</p>
                  </div>
                  <div>
                    <ShoppingBag size={16} className="mx-auto mb-1 text-emerald-500" />
                    <p className="text-[7px] font-black text-gray-400 uppercase leading-none">Beli</p>
                    <p className="text-xs font-black">{servicesStats.totalPurchases}</p>
                  </div>
                </div>

                {/* SECTION 4: Trend Harian (MoM) */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400 mb-6">Revenue Trend (Bulan Ini vs Lalu)</h3>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={servicesStats.dailyRevenueTrend}>
                      <defs>
                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" fontSize={8} tickMargin={5} />
                      <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '12px' }} formatter={(v) => `Rp ${v.toLocaleString()}`} />
                      <Area type="monotone" dataKey="BulanIni" stroke="#3B82F6" strokeWidth={3} fill="url(#colorIn)" />
                      <Area type="monotone" dataKey="BulanLalu" stroke="#E5E7EB" strokeWidth={1} fill="transparent" strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* SECTION 5: Tabel Rekapitulasi Operasional Harian */}
                <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
                  <div className="bg-gray-800 p-3 text-white flex items-center justify-between"><h4 className="text-[10px] font-black uppercase tracking-widest">Data Operasional Harian</h4> <p className="text-[8px] opacity-60">Geser Horizontal →</p></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-gray-50 text-gray-400 font-bold uppercase border-b">
                        <tr>
                          <th className="p-3">Tgl</th><th className="p-3">Hari</th><th className="p-3 text-center">Pasien</th><th className="p-3 text-center">Konsul</th><th className="p-3 text-center">Kasir</th><th className="p-3 text-center">Staf</th><th className="p-3 text-right">Pendapatan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {servicesStats.dailyStatsTable.map((s, idx) => (
                          <tr key={idx} className={s.hari === 'Minggu' ? 'bg-red-50/30' : 'hover:bg-gray-50'}>
                            <td className="p-3 font-bold text-gray-500">{s.tgl}</td>
                            <td className={`p-3 font-bold ${s.hari === 'Minggu' ? 'text-red-500' : 'text-gray-700'}`}>{s.hari}</td>
                            <td className="p-3 text-center">{s.pasien}</td><td className="p-3 text-center font-bold text-blue-600">{s.konsul}</td><td className="p-3 text-center">{s.kasir}</td><td className="p-3 text-center bg-gray-50/50">{s.absen}</td>
                            <td className="p-3 text-right font-black text-gray-800">Rp {s.pendapatan.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 6: Top 10 Tables */}
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl shadow-sm overflow-hidden border">
                    <div className="bg-gray-50 p-3 border-b"><h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Top Treatment</h4></div>
                    <table className="w-full text-left text-[10px]">
                      <tbody className="divide-y">
                        {servicesStats.topTreatments.map((t, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-700 truncate max-w-[140px]">{i+1}. {t.name}</td>
                            <td className="p-3 text-right font-black">{t.qty}x</td>
                            <td className="p-3 text-right text-emerald-600">Rp {t.revenue.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-white rounded-3xl shadow-sm overflow-hidden border">
                    <div className="bg-gray-50 p-3 border-b"><h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Top Produk</h4></div>
                    <table className="w-full text-left text-[10px]">
                      <tbody className="divide-y">
                        {servicesStats.topProducts.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-3 font-bold text-gray-700 truncate max-w-[140px]">{i+1}. {p.name}</td>
                            <td className="p-3 text-right font-black">{p.qty}x</td>
                            <td className="p-3 text-right text-blue-600">Rp {p.revenue.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 7: Performa Terapis & Staf */}
                <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
                   <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
                      <h4 className="text-[10px] font-black uppercase tracking-widest">Produktivitas Terapis / Dokter</h4>
                      <Clock size={14} className="opacity-50" />
                   </div>
                   <div className="divide-y">
                      {servicesStats.staffPerformance.map(s => (
                        <div key={s.id} className="p-4 flex justify-between items-center">
                           <div className="flex items-center gap-3">
                              {s.photo_url ? <img src={s.photo_url} className="w-8 h-8 rounded-full object-cover border" /> : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs">👤</div>}
                              <div>
                                <p className="text-xs font-black text-gray-800 uppercase leading-none mb-1">{s.name}</p>
                                <p className="text-[9px] text-gray-400 font-bold uppercase">{s.role}</p>
                              </div>
                           </div>
                           <div className="flex gap-4 text-center">
                              <div><p className="text-[8px] font-bold text-gray-400 uppercase">Today</p><p className="text-xs font-black text-blue-600">{s.todayCount}</p></div>
                              <div><p className="text-[8px] font-bold text-gray-400 uppercase">Month</p><p className="text-xs font-black text-gray-800">{s.monthCount}</p></div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* SUBMENU: LOG AKTIVITAS (Audit Trail) */}
        {activeSub === 'logaktivitas' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white p-4 rounded-3xl shadow-sm flex justify-between items-center border">
              <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">Audit Trail / Log Aktivitas</h3>
              <button onClick={fetchActivityLogs} className="p-2 bg-gray-100 rounded-full active:rotate-180 transition-transform"><Activity size={14} /></button>
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
               <div className="divide-y divide-gray-50">
                  {activityLogs.map(log => (
                    <div key={log.id} className="p-4 flex gap-3 hover:bg-gray-50 transition-colors">
                       <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 shrink-0"><Clock size={20}/></div>
                       <div>
                          <p className="text-[10px] font-black text-gray-800 uppercase">{log.staff?.name || 'Sistem'} - {log.action}</p>
                          <p className="text-xs text-gray-500 leading-snug">{log.description}</p>
                          <p className="text-[9px] text-gray-400 mt-1 font-mono uppercase">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                       </div>
                    </div>
                  ))}
                  {activityLogs.length === 0 && <p className="p-10 text-center text-gray-400 italic text-xs">Belum ada riwayat aktivitas.</p>}
               </div>
            </div>
          </div>
        )}

        {/* SUBMENU: LAPORAN PIUTANG (Debt Report) */}
        {activeSub === 'laporanpiutang' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-red-50">
              <div>
                <h3 className="font-bold text-sm text-red-800">Daftar Piutang Pasien</h3>
                <p className="text-[10px] text-red-600 italic">Daftar kekurangan bayar yang harus ditagih.</p>
              </div>
              <button onClick={fetchDebts} className="text-[10px] bg-white px-3 py-1 rounded-lg shadow-sm font-bold text-red-600 border border-red-100">REFRESH</button>
            </div>
            
            {isLoading ? (
              <div className="p-10 text-center text-gray-400 text-xs">Memuat data piutang...</div>
            ) : debts.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-xs italic">Tidak ada piutang aktif. Alhamdulillah!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-black border-b">
                    <tr>
                      <th className="p-3">Pasien / WA</th>
                      <th className="p-3 text-right">Total Tagihan</th>
                      <th className="p-3 text-right text-red-600">Sisa Piutang</th>
                      <th className="p-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {debts.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-black text-gray-800 uppercase">{d.encounters?.patients?.full_name}</div>
                          <div className="text-[9px] text-gray-400 font-mono">RM: {d.encounters?.patients?.rm_number}</div>
                          <div className="text-[10px] text-blue-600 font-bold">{d.encounters?.patients?.phone_number || '-'}</div>
                        </td>
                        <td className="p-3 text-right font-medium">Rp {Number(d.grand_total).toLocaleString()}</td>
                        <td className="p-3 text-right text-red-600 font-black bg-red-50/30">
                          Rp {Number(d.debt_amount).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <button 
                            onClick={() => {
                              let phone = d.encounters?.patients?.phone_number || '';
                              phone = phone.replace(/\D/g, '');
                              if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                              const msg = `Halo ${d.encounters?.patients?.full_name}, kami dari ${theme.clinicName} menginfokan terdapat sisa piutang sebesar Rp ${Number(d.debt_amount).toLocaleString()} untuk kunjungan Anda (${d.encounters?.encounter_number}). Mohon segera melakukan pelunasan. Terima kasih ✨`;
                              window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
                            }}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold text-[9px] shadow-sm active:scale-95 transition-transform"
                          >
                            TAGIH WA
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedDebt(d);
                              setShowPayDebtModal(true);
                            }}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-[9px] shadow-sm active:scale-95 transition-transform ml-2"
                          >LUNASI</button>

                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBMENU 2: LAPORAN JASA (Payroll) */}
        {activeSub === 'laporanjasa' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
               <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-700 uppercase text-[10px] tracking-widest">Rekap Gaji & Jasa Medis</h3>
                  <button onClick={fetchPayrollData} className="text-[10px] font-bold text-blue-600 border border-blue-200 px-3 py-1 rounded-full uppercase">Refresh</button>
               </div>
               
               <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-2xl">
                  <div>
                    <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Mulai Tanggal</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white p-2 rounded-xl text-[10px] font-bold outline-none border border-gray-100 shadow-sm" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-gray-400 uppercase ml-1">Sampai Tanggal</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-white p-2 rounded-xl text-[10px] font-bold outline-none border border-gray-100 shadow-sm" />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {payroll.map(staf => (
                <div key={staf.id} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border">
                        {staf.photo_url ? <img src={staf.photo_url} className="w-full h-full object-cover" /> : '👤'}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm leading-none mb-1">{staf.name}</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{staf.jabatan || staf.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] text-gray-400 font-bold uppercase">Total Terima</p>
                       <p className="font-black text-green-600">Rp {staf.takeHomePay.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                     <div className="bg-gray-50 p-2 rounded-xl">
                        <span className="text-gray-400 uppercase block">Gaji Pokok</span>
                        <span className="font-bold text-gray-700">Rp {(Number(staf.base_salary) || 0).toLocaleString()}</span>
                     </div>
                     <div className="bg-blue-50 p-2 rounded-xl">
                        <span className="text-blue-400 uppercase block">Jasa Medis</span>
                        <span className="font-bold text-blue-700">Rp {staf.totalJasa.toLocaleString()}</span>
                     </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button 
                      onClick={() => generatePDFSlip(staf)}
                      className="flex-1 py-2.5 bg-gray-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                      📄 Download PDF
                    </button>
                    <button 
                      onClick={() => sendSlipWA(staf)}
                      className="px-4 py-2.5 bg-green-500 text-white rounded-xl text-[10px] font-bold uppercase active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                      📱 WA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBMENU 3: KPI & KEBERSIHAN */}
        {activeSub === 'kpi&checklist' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-green-600" size={20} />
                  <h3 className="font-black text-xs uppercase tracking-widest text-gray-700">Checklist Kesiapan Operasional</h3>
                </div>
                <button 
                  onClick={generateChecklistPDF}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all shadow-sm"
                >
                  <FileDown size={14} /> Export PDF
                </button>
              </div>
              
              {/* Input Item Baru */}
              <div className="space-y-2 mb-6">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Tulis tugas operasional baru..." 
                    className="flex-1 p-3 bg-gray-50 rounded-2xl text-xs outline-none border border-transparent focus:border-blue-400 transition-all"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                  />
                  <button 
                    onClick={() => {
                      if(!newTask.trim()) return;
                      setChecklistItems([...checklistItems, { task: newTask, completed: false, assignedTo: assignee || 'Umum' }]);
                      setNewTask('');
                      setAssignee('');
                    }}
                    className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 transition-transform flex items-center gap-2"
                  >
                    <PlusCircle size={18} />
                    <span className="text-[10px] font-black uppercase">Tambah</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 px-1">
                  <User size={12} className="text-gray-400" />
                  <select 
                    className="bg-transparent text-[10px] font-bold text-gray-500 outline-none cursor-pointer"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  >
                    <option value="">Pilih Penanggung Jawab (Opsional)</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {checklistItems.map((item, idx) => (
                  <div key={idx} className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${item.completed ? 'bg-green-50 border-green-100 opacity-60' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-green-600 cursor-pointer" 
                        checked={item.completed}
                        onChange={() => {
                          const updated = [...checklistItems];
                          updated[idx].completed = !updated[idx].completed;
                          setChecklistItems(updated);
                        }}
                      />
                      <div className="flex flex-col">
                        <span className={`text-xs font-bold ${item.completed ? 'line-through text-green-700' : 'text-gray-700'}`}>{item.task}</span>
                        <span className="text-[9px] text-gray-400 font-medium uppercase tracking-tighter">PJ: {item.assignedTo}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setChecklistItems(checklistItems.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              
              <p className="mt-6 text-[10px] text-gray-400 italic text-center uppercase tracking-tighter">Status diperbarui otomatis ke database audit log saat dicentang.</p>
            </div>
          </div>
        )}

        {/* Modal Pelunasan Piutang */}
        {showPayDebtModal && selectedDebt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up space-y-4">
              <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm mb-1">Pelunasan Piutang</h3>
              <p className="text-xs text-gray-500 mb-4 italic">Pasien: {selectedDebt.encounters?.patients?.full_name} (No. Rawat: {selectedDebt.encounters?.encounter_number})</p>
              
              <div className="bg-gray-50 p-3 rounded-xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Sisa Piutang</p>
                <p className="text-xl font-black text-red-600">Rp {Number(selectedDebt.debt_amount).toLocaleString()}</p>
              </div>

              <button 
                onClick={handlePayDebt}
                disabled={isLoading}
                className="w-full py-4 rounded-xl text-white font-bold shadow-md uppercase tracking-wider disabled:bg-gray-300" 
                style={{ backgroundColor: theme.primaryColor }}
              >
                {isLoading ? 'MEMPROSES...' : 'KONFIRMASI PELUNASAN'}
              </button>
              
              <button 
                onClick={() => {
                  setShowPayDebtModal(false);
                  setSelectedDebt(null);
                }}
                className="w-full py-3 text-gray-400 text-xs font-bold uppercase tracking-widest"
              >Batal</button>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default Manajemen;