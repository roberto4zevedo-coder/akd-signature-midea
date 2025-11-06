// ====== excel-update.js ======
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import dayjs from "dayjs";

const STORAGE_DIR = path.join(process.cwd(), "storage");
const EXCEL_PATH = "/Users/robertoazevedo/OneDrive - FRIGICOLL, S.A/Bureau/Excel VB SIGNATURE/Formulaire d'inscription à la formation PAC Midea du 05_09_2025.xlsm";





/**
 * Met à jour le fichier Excel existant avec statut + lien signature
 */
export function markAsSigned(record) {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("❌ Fichier Excel maître introuvable :", EXCEL_PATH);
    return;
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  // Recherche du participant par email
  const participant = rows.find(
    (r) =>
      r["E-mail"]?.toString().trim().toLowerCase() ===
      record.email.toString().trim().toLowerCase()
  );

  if (!participant) {
    console.warn(`⚠️ Aucun participant trouvé avec l'email : ${record.email}`);
    return;
  }

  // Mise à jour du statut + lien signature
  participant["Statut"] = "✅ Signé";
  participant["Lien Signature"] = `http://localhost:8080/files/${record.file_name}`;
  participant["Date de signature"] = dayjs(record.timestamp_iso).format("DD/MM/YYYY HH:mm");

  // Réécrire toutes les données dans la feuille
  const newSheet = XLSX.utils.json_to_sheet(rows);
  workbook.Sheets[sheetName] = newSheet;

  XLSX.writeFile(workbook, EXCEL_PATH);
  console.log(`📊 Excel mis à jour : ${record.email}`);
}
