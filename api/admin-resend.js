// Organizer-only: sends the invitation email again to a guest who already entered an email.
// The organizer desk calls this once per guest.
const { loadConfig, buildHtml, buildText, sendMail, rpc, providers } = require('./send-invite.js').helpers;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!providers().length) return res.status(500).json({ error: 'Email is not set up yet.' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const password = String(body.password || '');
    const nickname = String(body.nickname || '').trim().slice(0, 24);
    if (!password || !nickname) return res.status(400).json({ error: 'Missing password or nickname.' });

    const C = loadConfig();
    // checks the organizer password inside the database and returns this guest's saved email
    const g = await rpc(C, 'admin_prepare_resend', { p_password: password, p_nickname: nickname });
    if (!g.ok) return res.status(400).json({ error: g.data.message || 'Could not prepare the email.' });

    await sendMail(C, g.data.email, `Your invitation: ${C.partyName}`,
      buildText(C, g.data.nickname, g.data.raffle_number), buildHtml(C, g.data.nickname, g.data.raffle_number));
    await rpc(C, 'mark_invite_sent', { p_nickname: g.data.nickname }).catch(() => {});
    return res.status(200).json({ ok: true, email: g.data.email });
  } catch (err) {
    console.error('admin-resend failed:', err);
    return res.status(500).json({ error: 'We could not send the email. Please try again in a moment.' });
  }
};
