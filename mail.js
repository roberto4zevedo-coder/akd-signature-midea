// ====== mail.js ======
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

/**
 * Envoie le PDF de session par e-mail
 * @param {string} session Nom de la session (ex: FormationVRF)
 * @param {string} pdfPath Chemin du fichier PDF à envoyer
 */
export async function sendPdfByEmail(session, pdfPath) {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // ou smtp.office365.com pour Outlook
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  const recipients = [
    'roberto.4zevedo@gmail.com', // 👈 adresse(s) à modifier selon besoin
    'formation@midea.fr'
  ];

  const mailOptions = {
    from: `"Midea AKD" <${process.env.MAIL_USER}>`,
    to: recipients.join(', '),
    subject: `Feuille d'émargement - ${session}`,
    text: `Bonjour,\n\nVeuillez trouver ci-joint la feuille d'émargement de la session "${session}".\n\nCordialement,\nL'équipe Midea Vitrolles`,
    attachments: [
      {
        filename: path.basename(pdfPath),
        path: pdfPath,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email envoyé avec succès pour ${session}`);
  } catch (err) {
    console.error('❌ Erreur envoi email:', err);
  }
}
