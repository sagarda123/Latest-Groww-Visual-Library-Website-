import { authConfig, verifySession } from './_auth.mjs';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const cfg = authConfig();
  if (!cfg) return res.status(503).json({ error: 'Auth not configured on this server' });
  const session = verifySession(cfg, req.headers.cookie);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  return res.status(200).json({ user: session.user });
}
