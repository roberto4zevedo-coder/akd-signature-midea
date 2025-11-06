// ====== excel-update-cloud.js ======
import fetch from "node-fetch";
import dayjs from "dayjs";

// On récupère les variables d'environnement Render
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const TENANT_ID = process.env.MICROSOFT_TENANT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const EXCEL_FILE_NAME = process.env.EXCEL_FILE_NAME;

// Authentification client credentials
async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: "https://graph.microsoft.com/.default",
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok) throw new Error("❌ Auth Microsoft Graph échouée");
  const data = await res.json();
  return data.access_token;
}

// Trouve le fichier OneDrive par son nom
async function findExcelFile(token) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(EXCEL_FILE_NAME)}')`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.value || !data.value.length) throw new Error(`❌ Fichier ${EXCEL_FILE_NAME} introuvable sur OneDrive`);
  return data.value[0]; // retourne le premier résultat trouvé
}

// Met à jour une ligne dans le tableau Excel (en fonction de l'e-mail)
export async function markAsSigned(record) {
  const token = await getAccessToken();
  const file = await findExcelFile(token);
  console.log(`📁 Fichier trouvé : ${file.name}`);

  // URL de base pour les tables Excel
  const workbookBase = `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook`;

  // Récupère toutes les lignes du premier tableau
  const tableRes = await fetch(`${workbookBase}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tables = await tableRes.json();
  if (!tables.value?.length) throw new Error("❌ Aucun tableau trouvé dans le fichier Excel");
  const tableId = tables.value[0].id;

  const rowsRes = await fetch(`${workbookBase}/tables/${tableId}/rows`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rowsData = await rowsRes.json();

  // Trouve la ligne correspondante à l'e-mail
  const targetRow = rowsData.value.find((row) =>
    row.values[0].some((v) => v && v.toString().toLowerCase() === record.email.toLowerCase())
  );

  if (!targetRow) {
    console.warn(`⚠️ Aucune ligne trouvée avec l'e-mail ${record.email}`);
    return;
  }

  // Met à jour la ligne : ici on suppose colonnes [Statut, Lien, Date] dans ton tableau Excel
  const updatedValues = [
    "✅ Signé",
    `https://akd-signature.onrender.com/files/${record.file_name}`,
    dayjs(record.timestamp_iso).format("DD/MM/YYYY HH:mm"),
  ];

  // Remplace la ligne entière (tu peux ajuster selon ton tableau)
  await fetch(`${workbookBase}/tables/${tableId}/rows/itemAt(index=${targetRow.index})/range`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [updatedValues] }),
  });

  console.log(`📊 Excel mis à jour pour ${record.email}`);
}
