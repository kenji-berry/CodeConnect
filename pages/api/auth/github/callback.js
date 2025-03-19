import axios from 'axios';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Send access token to session endpoint
    await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/session`,
      { access_token, expires_in },
      { headers: { Cookie: req.headers.cookie || '' } }
    );

    // Redirect user
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Auth callback error:', error);
    return res.status(500).redirect('/auth/error');
  }
}