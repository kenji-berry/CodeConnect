import { serialize } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { access_token, expires_in } = req.body;
    
    console.log('Setting access token in cookie:', { 
      hasAccessToken: !!access_token,
      expiresIn: expires_in
    });

    // Set access token cookie only
    const cookie = serialize('github_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expires_in || 2628000 // 1 month
    });

    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error setting session cookie:', error);
    return res.status(500).json({ error: 'Failed to set session' });
  }
}