// ===============================
// 🚀 AKD Signature Server - Midea
// ===============================

// ====== IMPORTS ======
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { exec } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

import { sendPdfByEmail } from './mail.js';
import { markAsSigned } from "./excel-update-cloud.js";


// ====== CONFIG ======
const app = express();
const PORT = process.env.PORT || 8080;
const STORAGE_DIR = path.join(process.cwd(), 'storage');

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));
app.use('/files', express.static(STORAGE_DIR));

// ====== PAGE D'ACCUEIL (Landing page) ======
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// ====== ROUTE : ENVOI DE SIGNATURE ======
app.post('/api/signature', async (req, res) => {
  try {
    const {
      attendee_id = '',
      name = '',
      email = '',
      session = 'Inconnue',
      consent = false,
      signature_data_url,
      user_agent = '',
    } = req.body;

    if (!signature_data_url || !name || !session) {
      return res.status(400).json({ error: 'Champs manquants' });
    }

    // ====== 1️⃣ SAUVEGARDE DE LA SIGNATURE ======
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const fileName = `${session}_${name.replace(/\s+/g, '_')}_${dayjs().format(
      'YYYYMMDD_HHmmss'
    )}_${uuidv4().slice(0, 8)}.png`;
    const filePath = path.join(STORAGE_DIR, fileName);

    const base64Data = signature_data_url.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    console.log(`✅ Signature enregistrée pour ${name} (${session})`);

    // ====== 2️⃣ MISE À JOUR DU CSV ======
    const csvPath = path.join(STORAGE_DIR, 'signatures.csv');
    const header =
      'attendee_id,name,email,session,consent,file_name,timestamp_iso,user_agent\n';
    const exists = fs.existsSync(csvPath);
    const line = `"${attendee_id}","${name}","${email}","${session}",${consent},"${fileName}","${new Date().toISOString()}","${user_agent}"\n`;

    if (!exists) fs.writeFileSync(csvPath, header);
    fs.appendFileSync(csvPath, line);

    // ====== 3️⃣ MISE À JOUR DU FICHIER EXCEL ======
    markAsSigned({
      email,
      file_name: fileName,
      timestamp_iso: new Date().toISOString(),
    });

    // ====== 4️⃣ GÉNÉRATION AUTOMATIQUE DU PDF + ENVOI EMAIL ======
    console.log(`🧾 Mise à jour du PDF pour la session ${session}...`);

    exec(`node generate-pdf.js`, async (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Erreur PDF:', error.message);
        return;
      }
      if (stderr) console.error(stderr);
      console.log(stdout);

      const pdfName = `emargement_${session}_${dayjs().format('YYYY-MM-DD')}.pdf`;
      const pdfPath = path.join(STORAGE_DIR, pdfName);

      // Petit délai pour être sûr que le PDF est bien généré avant envoi
      setTimeout(async () => {
        if (fs.existsSync(pdfPath)) {
          console.log(`📤 Envoi du PDF par mail pour ${session}...`);
          await sendPdfByEmail(session, pdfPath);
        } else {
          console.warn(`⚠️ PDF introuvable pour ${session}`);
        }
      }, 2000);
    });

    // ====== 5️⃣ RÉPONSE AU FRONT ======
    res.json({ ok: true, ref: fileName });
  } catch (err) {
    console.error('❌ Erreur côté serveur:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ====== DÉMARRAGE DU SERVEUR ======
app.listen(PORT, () => {
  console.log(`✅ AKD signature server running on http://localhost:${PORT}`);
});
