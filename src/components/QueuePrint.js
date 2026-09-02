import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useContext } from 'react';
import { ThemeContext } from '../App';

const QueuePrint = forwardRef(({ queueData }, ref) => {
  const theme = useContext(ThemeContext);
  
  const clinicName = theme?.clinicName || 'SHC CLINIK';
  const address = theme?.address || 'Jl. Example No.123';
  
  return (
    <div ref={ref} className="printable-content" style={{
      width: '50mm',
      padding: '8px 4px 4px 4px',
      fontFamily: 'monospace',
      fontSize: '10px',
      lineHeight: '1.2',
      color: '#000',
      background: 'white',
      margin: '0 auto',
      textAlign: 'center',
      boxSizing: 'border-box'
    }}>
      {/* Header - Seirama dengan Nota Kasir */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <p style={{ fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #000', borderTop: '1px solid #000', padding: '2px 0', marginBottom: '5px', textTransform: 'uppercase' }}>
          Antrean Layanan
        </p>
        <img 
          src={theme.logo} 
          alt="Logo" 
          style={{ height: '40px', width: 'auto', margin: '0 auto 5px', objectFit: 'contain', filter: 'grayscale(1)' }}
          onError={(e) => e.target.style.display = 'none'}
        />
        <h1 style={{ 
          fontSize: '13px', 
          fontWeight: 'bold', 
          color: '#000',
          margin: '0 0 2px 0',
          textTransform: 'uppercase',
        }}>
          {clinicName}
        </h1>
        <p style={{ fontSize: '8px', margin: '0 0 1px 0' }}>{address}</p>
        <p style={{ fontSize: '9px', margin: 0, fontWeight: 'bold' }}>
          {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Queue Number BIG */}
      <div style={{ 
        textAlign: 'center', 
        margin: '15px 0',
        padding: '12px 8px',
        background: '#fff',
        border: `2px solid #000`,
        borderRadius: '6px'
      }}>
        <div style={{ fontSize: '38px', fontWeight: 'bold', color: '#000', marginBottom: '2px', letterSpacing: '2px' }}>
          {queueData?.queue_number || '000'}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', textTransform: 'uppercase' }}>
          {queueData?.tujuan || 'Antrean'}
        </div>
      </div>

      {/* Patient Info */}
      <div style={{ textAlign: 'left', marginBottom: '10px', fontSize: '10px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
        <p>No Rawat: {queueData?.encounter_number || '-'}</p>
        <p>Pasien  : {queueData?.patient_name?.substring(0, 15) || '-'}</p>
        {queueData?.rm_number && <p>No. RM  : {queueData.rm_number}</p>}
        <p>Petugas : {queueData?.staff_name?.substring(0, 15) || '-'}</p>
      </div>

      {/* QR Code */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ width: '60px', height: '60px', margin: '0 auto' }}>
          {(queueData?.id || queueData?.encounter_number) && (
            <QRCodeSVG 
              value={queueData.id || queueData.encounter_number}
              size={60}
              fgColor="#000"
              bgColor="#fff"
              level="H"
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: '8px', 
        borderTop: '1px solid #000', 
        paddingTop: '8px'
      }}>
        <p>*** TERIMA KASIH ***</p>
        <p>Layanan: SHC-System</p>
      </div>

      <div style={{ height: '10px' }} /> {/* Cutter space */}
    </div>
  );
});

export default QueuePrint;
