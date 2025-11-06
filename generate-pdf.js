// ====== IMPORTS ======
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { parse } from 'csv-parse/sync';
import dayjs from 'dayjs';

// ====== CONFIG ======
const STORAGE_DIR = path.join(process.cwd(), 'storage');
const CSV_PATH = path.join(STORAGE_DIR, 'signatures.csv');
const LOGO_PATH = path.join(STORAGE_DIR, 'logo-midea.png');

// ====== FONCTIONS UTILES ======
function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function loadSignatures() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ Aucun fichier signatures.csv trouvé');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });
}

function groupBySession(records) {
  const sessions = {};
  for (const r of records) {
    const key = r.session || 'Inconnue';
    if (!sessions[key]) sessions[key] = [];
    sessions[key].push(r);
  }
  return sessions;
}

// ====== GÉNÉRATION DU PDF ======
function generatePdfForSession(session, participants) {
  const pdfName = `emargement_${session}_${dayjs().format('YYYY-MM-DD')}.pdf`;
  const pdfPath = path.join(STORAGE_DIR, pdfName);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(fs.createWriteStream(pdfPath));

  const dateFormation = participants.length
    ? dayjs(participants[0].timestamp_iso).format('DD/MM/YYYY')
    : dayjs().format('DD/MM/YYYY');

  // === HEADER BLANC + LOGO BLEU ===
  doc.rect(0, 0, doc.page.width, 90).fill('#FFFFFF'); // fond blanc

  // Logo à droite
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, doc.page.width - 160, 15, { width: 120 });
  }

  // Titre Midea bleu
  doc
    .fillColor('#007BFF')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(`Feuille d'émargement – ${session}`, 40, 30, { align: 'left' })
    .fontSize(12)
    .text(`Date de la session : ${dateFormation}`, 40, 55, { align: 'left' });

  // Ligne bleue de séparation
  doc.moveTo(40, 95).lineTo(550, 95).strokeColor('#007BFF').lineWidth(2).stroke();
  doc.moveDown(2);

  // === TABLEAU ===
  const startX = 40;
  let y = 110;
  const colWidths = { name: 140, email: 170, date: 120, signature: 100 };
  const rowHeight = 60;

  // En-tête du tableau
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#007BFF')
    .text('Nom', startX, y)
    .text('Email', startX + colWidths.name, y)
    .text('Date / Heure', startX + colWidths.name + colWidths.email, y)
    .text('Signature', startX + colWidths.name + colWidths.email + colWidths.date, y)
    .fillColor('black');

  doc.moveTo(startX, y + 15).lineTo(550, y + 15).strokeColor('#007BFF').stroke();

  y += 25;
  doc.font('Helvetica').fontSize(10);

  participants.forEach((p, i) => {
    const date = p.timestamp_iso
      ? dayjs(p.timestamp_iso).format('DD/MM/YYYY HH:mm')
      : '—';

    // fond alterné léger
    if (i % 2 === 0) {
      doc.rect(startX - 5, y - 5, 510, rowHeight - 10)
        .fillOpacity(0.05)
        .fill('#007BFF')
        .fillOpacity(1);
    }

    doc.text(p.name || '—', startX, y, { width: colWidths.name });
    doc.text(p.email || '—', startX + colWidths.name, y, { width: colWidths.email });
    doc.text(date, startX + colWidths.name + colWidths.email, y, { width: colWidths.date });

    const imgPath = path.join(STORAGE_DIR, p.file_name || '');
    if (fs.existsSync(imgPath)) {
      try {
        doc.image(imgPath, startX + colWidths.name + colWidths.email + colWidths.date + 5, y - 10, {
          width: 80,
          height: 40
        });
      } catch {
        doc.text('⚠️', startX + colWidths.name + colWidths.email + colWidths.date + 40, y);
      }
    } else {
      doc.text('—', startX + colWidths.name + colWidths.email + colWidths.date + 40, y);
    }

    y += rowHeight;

    // Saut de page si nécessaire
    if (y > 750) {
      addFooter(doc);
      doc.addPage();
      y = 100;
      doc.font('Helvetica-Bold').fillColor('#007BFF');
      doc.text('Nom', startX, y);
      doc.text('Email', startX + colWidths.name, y);
      doc.text('Date / Heure', startX + colWidths.name + colWidths.email, y);
      doc.text('Signature', startX + colWidths.name + colWidths.email + colWidths.date, y);
      doc.moveTo(startX, y + 15).lineTo(550, y + 15).strokeColor('#007BFF').stroke();
      y += 25;
      doc.font('Helvetica').fillColor('black');
    }
  });

  addFooter(doc);
  doc.end();
  console.log(`✅ PDF généré : ${pdfPath}`);
}

// ====== PIED DE PAGE ======
function addFooter(doc) {
  const bottom = doc.page.height - 50;
  const range = doc.bufferedPageRange();
  const currentPage = range.start + doc.page.number;

  doc.fontSize(9).fillColor('gray');
  doc.text(`Généré automatiquement le ${dayjs().format('DD/MM/YYYY HH:mm')}`, 40, bottom, {
    align: 'left'
  });
  doc.text(`Page ${currentPage}`, -40, bottom, { align: 'right' });
  doc.fillColor('black');
}

// ====== MAIN ======
async function main() {
  ensureStorage();
  const records = loadSignatures();
  const sessions = groupBySession(records);
  for (const [session, participants] of Object.entries(sessions)) {
    generatePdfForSession(session, participants);
  }
}
main().catch((err) => console.error('❌ Erreur principale :', err));
