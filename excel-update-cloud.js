// ====== excel-update-cloud.js ======
import fetch from "node-fetch";
import dayjs from "dayjs";

// Variables d'environnement Render
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const TENANT_ID = process.env.MICROSOFT_TENANT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const EXCEL_FILE_NAME = process.env.EXCEL_FILE_NAME;

// ====== AUTHENTIFICATION MICROSOFT GRAPH ======
async function getAccessToken() {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  // 🔍 Log d'erreur détaillé si échec
  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Auth Microsoft Graph échouée :", text);
    throw new Error("Auth Microsoft Graph échouée");
  }

  const data = await res.json();
  console.log(`✅ Token reçu (expires_in ${data.expires_in}s)`);
  return data.access_token;
}

// ====== RECHERCHE DU FICHIER EXCEL SUR ONEDRIVE ======
async function findExcelFile(token) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(EXCEL_FILE_NAME)}')`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!data.value || !data.value.length)
    throw new Error(`❌ Fichier ${EXCEL_FILE_NAME} introuvable sur OneDrive`);
  console.log(`📁 Fichier trouvé : ${data.value[0].name}`);
  return data.value[0];
}

// ====== MISE À JOUR D'UNE LIGNE DANS LE TABLEAU EXCEL ======
export async function markAsSigned(record) {
  const token = await getAccessToken();
  const file = await findExcelFile(token);

  const workbookBase = `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/workbook`;

  // Liste les tableaux présents
  const tableRes = await fetch(`${workbookBase}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tables = await tableRes.json();

  if (!tables.value?.length)
    throw new Error("❌ Aucun tableau trouvé dans le fichier Excel");

  const tableId = tables.value[0].id;
  console.log(`📋 Tableau détecté : ${tableId}`);

  // Récupère les lignes existantes
  const rowsRes = await fetch(`${workbookBase}/tables/${tableId}/rows`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rowsData = await rowsRes.json();

  const targetRow = rowsData.value.find((row) =>
    row.values[0].some(
      (v) => v && v.toString().toLowerCase() === record.email.toLowerCase()
    )
  );

  if (!targetRow) {
    console.warn(`⚠️ Aucune ligne trouvée avec l'email ${record.email}`);
    return;
  }

  // Prépare les nouvelles valeurs
  const updatedValues = [
    "✅ Signé",
    `https://akd-signature-midea.onrender.com/files/${record.file_name}`,
    dayjs(record.timestamp_iso).format("DD/MM/YYYY HH:mm"),
  ];

  // Met à jour la ligne
  const patchUrl = `${workbookBase}/tables/${tableId}/rows/itemAt(index=${targetRow.index})/range`;
  await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [updatedValues] }),
  });

  console.log(`📊 Excel mis à jour pour ${record.email}`);
}
