import React from 'react';
import QRCode from 'qrcode.react';
import { useContext, forwardRef } from 'react'; // Import forwardRef
import { ThemeContext } from '../App'; // Pastikan path ini benar

const QueuePrint = forwardRef(({ queueData }, ref) => { // Gunakan forwardRef
  const theme = useContext(ThemeContext);

  return (
    <div ref={ref} className="printable-content" style={{ // Tambahkan ref di sini
      width: '52mm', // Mengurangi lebar agar ada margin
      padding: '8px 6px 4px 6px', // Mengurangi padding
      fontFamily: 'monospace, "Courier New", Courier', // Font yang lebih konsisten untuk thermal
      fontSize: '11px',
      lineHeight: '1.3',
      color: '#000',
      background: 'white',
      margin: '0 auto', // Center di preview
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '1px solid #000', paddingBottom: '8px' }}>
        <h1 style={{ 
          fontSize: '20px', // Smaller for 58mm
          fontWeight: 'bold', 
          color: theme.primaryColor || '#D4AF37',
          margin: '0 0 3px 0',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {theme.clinicName}
        </h1>
        <p style={{ fontSize: '9px', margin: '0 0 2px 0', opacity: 0.9 }}>{theme.address}</p>
        <p style={{ fontSize: '10px', margin: 0, fontWeight: 'bold' }}>
          {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})}
        </p>
      </div>

      {/* NOMOR ANTRIAN BESAR CENTER */}
      <div style={{ 
        textAlign: 'center', 
        margin: '15px 0',
        padding: '12px 0',
        border: `2px solid ${theme.primaryColor}`,
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '32px', fontWeight: '900', color: theme.primaryColor, marginBottom: '3px', letterSpacing: '2px' }}>
          {queueData.queue_number}
        </div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', textTransform: 'uppercase' }}>
          {queueData.tujuan}
        </div>
        {queueData.staff_name && (
          <div style={{ fontSize: '11px', color: '#333', marginTop: '2px' }}>
            {queueData.staff_name}
          </div>
        )}
      </div>

      {/* Patient Info */}
      <div style={{ marginBottom: '12px', padding: '8px 6px', background: '#f5f5f5', borderRadius: '4px', border: '1px solid #ddd' }}>
        <p style={{ fontSize: '10px', margin: '0 0 2px 0', fontWeight: 'bold' }}>Pasien:</p>
        <p style={{ fontSize: '12px', fontWeight: '600', margin: 0 }}>{queueData.patient_name}</p>
        {queueData.rm_number && (
          <p style={{ fontSize: '9px', color: '#666', margin: '1px 0 0 0' }}>RM: {queueData.rm_number}</p>
        )}
      </div>

      {/* No Rawat */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <p style={{ fontSize: '9px', fontWeight: 'bold', margin: 0 }}>No. Rawat:</p>
        <p style={{ fontSize: '11px', fontWeight: '600', margin: '2px 0 0 0' }}>
          {queueData.encounter_number}
        </p>
      </div>

      {/* QR Code */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <div style={{ 
          padding: '6px', 
          background: 'white', 
          border: '1px solid #ddd',
          borderRadius: '4px',
          display: 'inline-block'
        }}>
          <QRCode value={queueData.id || queueData.encounter_number} size={70} />
        </div>
        <p style={{ fontSize: '8px', marginTop: '3px' }}>Scan QR antrean</p>
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '9px', 
        color: '#666', 
        borderTop: '1px solid #ddd', 
        paddingTop: '8px'
      }}>
        <p style={{ margin: '0 0 2px 0' }}>Terima kasih</p>
        <p style={{ margin: 0, fontSize: '8px' }}>Silakan tunggu panggilan</p>
      </div>

      <div style={{ height: '15px' }}></div> {/* Thermal cutter */}
    </div>
  );
});

export default QueuePrint;
