// Public image renderer for a guest's opaque, unguessable QR token.
// The token is the QR payload; it contains no nickname or personal details.
const QRCode = require('qrcode');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');
  const token = String((req.query && req.query.token) || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(400).end('Invalid QR token');
  try {
    const png = await QRCode.toBuffer(token, {
      type: 'png', width: 480, margin: 2,
      errorCorrectionLevel: 'H', color: { dark: '#27251F', light: '#FFFFFF' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(png);
  } catch (error) {
    console.error('QR rendering failed:', error);
    return res.status(500).end('Could not render QR code');
  }
};
