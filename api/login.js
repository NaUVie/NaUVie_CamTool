// Vercel Serverless Function - Login authentication API

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};
  const validUsername = process.env.ADMIN_USERNAME || 'Admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'Trieu25032005@';

  if (username === validUsername && password === validPassword) {
    return res.status(200).json({
      success: true,
      token: 'nauvie_secret_admin_authenticated_' + Date.now(),
      message: 'Đăng nhập thành công!'
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Tài khoản hoặc mật khẩu không chính xác!'
  });
};
