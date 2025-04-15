import { serialize } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event, session } = req.body;
  const projectRef = 'pdaoysgzyivhkkviszjp';

  if (event === 'SIGNED_IN' && session) {
    // Store the full session object as JSON
    const authCookie = serialize(
      `sb-${projectRef}-auth-token`,
      JSON.stringify(session),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: session.expires_in || 3600,
      }
    );
    const refreshCookie = serialize(
      `sb-${projectRef}-refresh-token`,
      session.refresh_token,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      }
    );
    res.setHeader('Set-Cookie', [authCookie, refreshCookie]);
    return res.status(200).json({ success: true });
  }

  // On SIGNED_OUT or missing session, clear the cookies
  const authCookie = serialize(`sb-${projectRef}-auth-token`, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  const refreshCookie = serialize(`sb-${projectRef}-refresh-token`, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.setHeader('Set-Cookie', [authCookie, refreshCookie]);
  return res.status(200).json({ success: true });
}