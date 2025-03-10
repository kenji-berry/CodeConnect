export default function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Clear the GitHub token cookie
    res.setHeader('Set-Cookie', 'github_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
    
    return res.status(200).json({ success: true });
  }