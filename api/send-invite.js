// Vercel serverless function: emails a guest their digital invitation card.
// Needs 2 environment variables in Vercel: GMAIL_USER and GMAIL_APP_PASSWORD
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Reads the same config.js the website uses, so details always match.
function loadConfig() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
  const w = {};
  new Function('window', code)(w);
  return w.CONFIG;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HEAD = "'Arial Black',Impact,Arial,sans-serif";

function buildHtml(C, nickname, num) {
  const row = (label, val) => `<tr><td style="padding:10px 12px 10px 0;border-top:2px solid #F0D9A0;font:700 12px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#DA291C;width:100px;vertical-align:top">${label}</td><td style="padding:10px 0;border-top:2px solid #F0D9A0;font:600 16px Georgia,serif;color:#27251F">${val}</td></tr>`;
  const lineup = (C.lineup || []).map(x => `<tr><td style="padding:3px 14px 3px 0;font:700 13px Arial,sans-serif;color:#DA291C;white-space:nowrap">${esc(x.time)}</td><td style="padding:3px 0;font:600 15px Georgia,serif;color:#27251F">${esc(x.act)}</td></tr>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#FFF9EA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFF4D6;border:3px solid #27251F;border-radius:20px;overflow:hidden">
<tr><td align="center" style="background:#DA291C;padding:28px 20px 24px">
  <div style="font:900 42px/1 ${HEAD};letter-spacing:2px;color:#FFFFFF;text-transform:uppercase">Coachella</div>
  <div style="font:700 12px Arial,sans-serif;letter-spacing:6px;color:#FFC72C;text-transform:uppercase;margin-top:8px">Beyond the Arches</div>
  <div style="font:700 15px Arial,sans-serif;color:#FFFFFF;margin-top:14px">${esc(C.partyName)}</div>
</td></tr>
<tr><td align="center" style="padding:28px 24px 6px">
  <div style="font:900 14px Arial,sans-serif;letter-spacing:4px;color:#DA291C;text-transform:uppercase">You are invited</div>
  <div style="font:900 34px/1.1 ${HEAD};color:#27251F;margin-top:10px;word-break:break-word">${esc(nickname)}</div>
</td></tr>
<tr><td align="center" style="padding:14px 24px 22px">
  <table role="presentation" cellpadding="0" cellspacing="0" style="background:#27251F;border-radius:16px"><tr><td align="center" style="padding:14px 38px">
    <div style="font:700 11px Arial,sans-serif;letter-spacing:3px;color:#FFF4D6;text-transform:uppercase">Your raffle number</div>
    <div style="font:900 64px/1.05 ${HEAD};color:#FFC72C">${num}</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:0 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  ${row('When', esc(C.when))}${row('Where', esc(C.where))}${row('Dress code', esc(C.dress))}
</table></td></tr>
<tr><td style="padding:14px 28px 6px">
  <div style="font:900 13px Arial,sans-serif;letter-spacing:3px;color:#DA291C;text-transform:uppercase;margin-bottom:6px">Lineup</div>
  <table role="presentation" cellpadding="0" cellspacing="0">${lineup}</table>
</td></tr>
<tr><td align="center" style="padding:20px 24px 28px;font:600 13px Arial,sans-serif;color:#6B3A1E">Keep this number safe. You will need it for the raffle draw!</td></tr>
</table></td></tr></table></body></html>`;
}

function buildText(C, nickname, num) {
  return [`${C.partyName}`, 'Coachella: Beyond the Arches', '', `You are invited, ${nickname}!`, `Your raffle number: ${num}`, '',
    `When: ${C.when}`, `Where: ${C.where}`, `Dress code: ${C.dress}`, '', 'Lineup:',
    ...(C.lineup || []).map(x => `  ${x.time}  ${x.act}`), '', 'Keep this number safe. You will need it for the raffle draw!'].join('\n');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) return res.status(500).json({ error: 'Email is not set up yet. Please tell the organizers.' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const nickname = String(body.nickname || '').trim().slice(0, 24);
    const email = String(body.email || '').trim().toLowerCase();
    if (!nickname || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    const C = loadConfig();
    // Ask the database: is this a real guest with a raffle number? (also enforces the 5-copy limit)
    const headers = { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY };
    if (!String(C.SUPABASE_ANON_KEY).startsWith('sb_')) headers.Authorization = 'Bearer ' + C.SUPABASE_ANON_KEY;
    const r = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/request_invite_copy`, {
      method: 'POST', headers, body: JSON.stringify({ p_nickname: nickname, p_email: email })
    });
    const guest = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(400).json({ error: guest.message || 'Could not find your invitation.' });

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await transporter.sendMail({
      from: `"${C.partyName}" <${user}>`,
      to: email,
      subject: `Your invitation: ${C.partyName}`,
      text: buildText(C, guest.nickname, guest.raffle_number),
      html: buildHtml(C, guest.nickname, guest.raffle_number)
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-invite failed:', err);
    return res.status(500).json({ error: 'We could not send the email. Please try again in a moment.' });
  }
};
