import { serialize } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, expires_in } = req.body;
  
  // Set HttpOnly cookie with the token
  res.setHeader('Set-Cookie', serialize('github_token', access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: expires_in || 28800, // Default to 8 hours if not provided
    path: '/'
  }));

  return res.status(200).json({ success: true });
}