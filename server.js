// ====== IMPORTS ======
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { exec } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

import { sendPdfByEmail } from './mail.js';
import { markAsSigned } from './excel-update-cloud.js';

// ====== CONFIG ======
const app = express();
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(process.cwd(), 'storage');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/files', express.static(STORAGE_DIR));

// ====== ROUTE API SIGNATURE ======
app.post('/api/signature', async (req, res) => {
  try {
    const {
      attendee_id = '',
      name = '',
      email = '',
      session = 'Inconnue',
      consent = false,
      signature_data_url,
      user_agent = ''
    } = req.body;

    if (!signature_data_url || !name || !session) {
      return res.status(400).json({ error: 'Champs manquants' });
    }

    if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

    const fileName = `${session}_${name.replace(/\s+/g, '_')}_${dayjs().format(
      'YYYYMMDD_HHmmss'
    )}_${uuidv4().slice(0, 8)}.png`;
    const filePath = path.join(STORAGE_DIR, fileName);

    const base64Data = signature_data_url.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    console.log(`✅ Signature enregistrée pour ${name} (${session})`);

    const csvPath = path.join(STORAGE_DIR, 'signatures.csv');
    const header =
      'attendee_id,name,email,session,consent,file_name,timestamp_iso,user_agent\n';
    const exists = fs.existsSync(csvPath);
    const line = `"${attendee_id}","${name}","${email}","${session}",${consent},"${fileName}","${new Date().toISOString()}","${user_agent}"\n`;
    if (!exists) fs.writeFileSync(csvPath, header);
    fs.appendFileSync(csvPath, line);

    console.log(`🧾 Génération PDF + mise à jour Excel cloud...`);

    exec(`node generate-pdf.js`, async (error, stdout, stderr) => {
      if (error) console.error('❌ Erreur PDF:', error.message);
      if (stderr) console.error(stderr);
      console.log(stdout);

      await markAsSigned({
        attendee_id,
        name,
        email,
        session,
        file_name: fileName,
        timestamp_iso: new Date().toISOString()
      });
    });

    res.json({ ok: true, ref: fileName });
  } catch (err) {
    console.error('❌ Erreur serveur:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ====== ROUTE PAR DÉFAUT (fallback pour Render) ======
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ====== SERVEUR ======
app.listen(PORT, () => {
  console.log(`✅ AKD Signature server running on http://localhost:${PORT}`);
});
