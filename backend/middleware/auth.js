const jwt = require('jsonwebtoken');

// We get the secret key from our environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_and_long_jwt_key_that_is_hard_to_guess';

module.exports = (req, res, next) => {
  try {
    // Get the token from the 'Authorization' header (e.g., "Bearer eyJhbGci...")
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication failed: No token provided.' });
    }

    // Verify the token is valid
    const decodedToken = jwt.verify(token, JWT_SECRET);
    
    // Add the userId from the token to the request object
    req.userData = { userId: decodedToken.userId };
    
    // Continue to the next function in the chain
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed: Invalid token.' });
  }
};
