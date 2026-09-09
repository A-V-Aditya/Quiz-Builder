const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access denied. Malformed token.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_mca_quiz_key_2026');
    req.user = decoded; // { id, email, role, name }
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

// Middleware to verify Teacher role
function requireTeacher(req, res, next) {
  if (req.user && req.user.role === 'teacher') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden. Teacher access required.' });
  }
}

// Middleware to verify Student role
function requireStudent(req, res, next) {
  if (req.user && req.user.role === 'student') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden. Student access required.' });
  }
}

module.exports = {
  verifyToken,
  requireTeacher,
  requireStudent
};
