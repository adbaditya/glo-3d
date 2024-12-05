// auth.js
const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const token = req.cookies.authToken;
  
  if (!token) {
    // Check if request expects JSON
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ authenticated: false });
    }
    // For regular page requests, render the page (modal will show)
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('authToken');
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ authenticated: false });
    }
    return next();
  }
};

const getRandomExpiry = () => {
  const minDays = 7;
  const maxDays = 14;
  const randomDays = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
  return randomDays * 24 * 60 * 60 * 1000;
};

module.exports = { requireAuth, getRandomExpiry };