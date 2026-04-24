/**
 * Utility untuk Integrasi API SatuSehat Kemenkes
 * Berdasarkan standar HL7 FHIR
 */

const AUTH_URL = process.env.REACT_APP_SATUSEHAT_AUTH_URL;
const BASE_URL = process.env.REACT_APP_SATUSEHAT_BASE_URL;
const CLIENT_ID = process.env.REACT_APP_SATUSEHAT_CLIENT_ID;
const CLIENT_SECRET = process.env.REACT_APP_SATUSEHAT_CLIENT_SECRET;

// 1. Fungsi mendapatkan Access Token (OAuth2)
export const getSatuSehatToken = async () => {
  try {
    const response = await fetch(`${AUTH_URL}/accesstoken?grant_type=client_credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Gagal mendapatkan Token SatuSehat:", error);
    return null;
  }
};

// 2. Fungsi mencari Patient ID berdasarkan NIK
// SatuSehat mewajibkan kita mencari ID Internal mereka menggunakan NIK
export const getPatientByNIK = async (nik) => {
  const token = await getSatuSehatToken();
  if (!token) return null;

  try {
    const response = await fetch(`${BASE_URL}/Patient?identifier=https://fhir.kemkes.go.id/id/nik|${nik}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    // Mengembalikan Patient ID versi SatuSehat (Contoh: P0123...)
    return data.entry ? data.entry[0].resource.id : null;
  } catch (error) {
    console.error("NIK tidak ditemukan di SatuSehat:", error);
    return null;
  }
};

// 3. Template Struktur FHIR untuk Encounter (Kunjungan Klinik)
export const createEncounterResource = (patientID, doctorID, startTime) => {
  return {
    resourceType: "Encounter",
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB", // Ambulatory (Rawat Jalan)
      display: "ambulatory"
    },
    subject: {
      reference: `Patient/${patientID}`,
      display: "Nama Pasien"
    },
    participant: [
      {
        type: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType",
                code: "PPRF",
                display: "primary performer"
              }
            ]
          }
        ],
        individual: {
          reference: `Practitioner/${doctorID}`
        }
      }
    ],
    period: {
      start: startTime // ISO Format
    }
  };
};