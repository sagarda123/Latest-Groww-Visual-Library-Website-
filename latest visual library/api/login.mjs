import { authConfig, verifyCredentials, issueSessionCookie } from './_auth.mjs';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const cfg = authConfig();
  if (!cfg) return res.status(503).json({ error: 'Auth not configured on this server' });
  const { username, password } = req.body || {};
  if (!verifyCredentials(cfg, username, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.setHeader('Set-Cookie', issueSessionCookie(cfg));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ user: cfg.username });
}
