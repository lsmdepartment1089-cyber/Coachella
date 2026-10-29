// Vercel serverless function: emails a guest their digital invitation card.
// Sends with Google Apps Script (APPS_SCRIPT_URL + APPS_SCRIPT_SECRET), or Brevo, or Gmail App Password.
const fs = require('fs');
const path = require('path');

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

const hasAppsScript = () => process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_SECRET;
const hasBrevo = () => process.env.BREVO_API_KEY && process.env.SENDER_EMAIL;
const hasGmail = () => process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;

// 1) Google Apps Script: sends from your real Gmail (best delivery, no App Password needed)
async function viaAppsScript(C, to, subject, text, html) {
  const r = await fetch(process.env.APPS_SCRIPT_URL, {
    method: 'POST', redirect: 'follow', headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: process.env.APPS_SCRIPT_SECRET, to, subject, text, html, name: C.partyName })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error('Apps Script error: ' + (d.error || r.status));
}
// 2) Brevo
async function viaBrevo(C, to, subject, text, html) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: C.partyName, email: process.env.SENDER_EMAIL }, to: [{ email: to }], subject, textContent: text, htmlContent: html })
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error('Brevo error ' + r.status + ': ' + (d.message || 'unknown')); }
}
// 3) Gmail App Password
async function viaGmail(C, to, subject, text, html) {
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  await t.sendMail({ from: `"${C.partyName}" <${process.env.GMAIL_USER}>`, to, subject, text, html });
}
const providers = () => [hasAppsScript() && viaAppsScript, hasBrevo() && viaBrevo, hasGmail() && viaGmail].filter(Boolean);

// tries each configured sender in order until one works
async function sendMail(...args) {
  let last;
  for (const p of providers()) { try { await p(...args); return; } catch (e) { console.error(e.message); last = e; } }
  throw last || new Error('No email sender configured');
}

async function rpc(C, fn, args) {
  const headers = { 'Content-Type': 'application/json', apikey: C.SUPABASE_ANON_KEY };
  if (!String(C.SUPABASE_ANON_KEY).startsWith('sb_')) headers.Authorization = 'Bearer ' + C.SUPABASE_ANON_KEY;
  const r = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!providers().length) return res.status(500).json({ error: 'Email is not set up yet. Please tell the organizers.' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const nickname = String(body.nickname || '').trim().slice(0, 24);
    const email = String(body.email || '').trim().toLowerCase();
    if (!nickname || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    const C = loadConfig();
    // Ask the database: is this a real guest with a raffle number? (also enforces the 5-copy limit)
    const g = await rpc(C, 'request_invite_copy', { p_nickname: nickname, p_email: email });
    if (!g.ok) return res.status(400).json({ error: g.data.message || 'Could not find your invitation.' });

    await sendMail(C, email, `Your invitation: ${C.partyName}`,
      buildText(C, g.data.nickname, g.data.raffle_number), buildHtml(C, g.data.nickname, g.data.raffle_number));
    await rpc(C, 'mark_invite_sent', { p_nickname: g.data.nickname }).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-invite failed:', err);
    return res.status(500).json({ error: 'We could not send the email. Please try again in a moment.' });
  }
}

module.exports = handler;
module.exports.helpers = { loadConfig, buildHtml, buildText, sendMail, rpc, providers };
