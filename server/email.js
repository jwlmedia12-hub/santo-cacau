// Envio de e-mails (confirmação de pedido, recuperação de senha, contato).
// Com SMTP_HOST configurado usa o Nodemailer; sem ele, mostra no console
// (útil para testar localmente: o link de nova senha aparece no terminal).
const nodemailer = require('nodemailer');

const configurado = !!process.env.SMTP_HOST;
const transporte = configurado
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;
const remetente = process.env.EMAIL_REMETENTE || 'Santo Cacau <nao-responda@santocacau.com.br>';

async function enviar({ para, assunto, texto }) {
  if (!para) return;
  if (!transporte) {
    console.log('\n[e-mail não enviado: configure SMTP_HOST]\nPara: %s\nAssunto: %s\n%s\n', para, assunto, texto);
    return;
  }
  try {
    await transporte.sendMail({ from: remetente, to: para, subject: assunto, text: texto });
  } catch (erro) {
    // Falha de e-mail não pode derrubar a compra.
    console.error('[e-mail] falha ao enviar para %s: %s', para, erro.message);
  }
}

module.exports = { enviar, configurado };
