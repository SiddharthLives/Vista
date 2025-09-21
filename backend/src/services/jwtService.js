const jwt = require("jsonwebtoken");

class JWTService {
  constructor() {
    // Don't cache env vars to allow for testing
  }

  get secret() {
    return process.env.JWT_SECRET || "default-secret-change-in-production";
  }

  get expiresIn() {
    return process.env.JWT_EXPIRES_IN || "7d";
  }

  /**
   * Generate JWT token for authenticated user
   * @param {Object} payload - User data to include in token
   * @returns {string} JWT token
   */
  generateToken(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Payload is required and must be an object");
    }

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: "college-social-media-api",
      audience: "college-social-media-app",
    });
  }

  /**
   * Verify and decode JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    if (!token) {
      throw new Error("Token is required");
    }

    try {
      return jwt.verify(token, this.secret, {
        issuer: "college-social-media-api",
        audience: "college-social-media-app",
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new Error("Token has expired");
      } else if (error.name === "JsonWebTokenError") {
        throw new Error("Invalid token");
      } else if (error.name === "NotBeforeError") {
        throw new Error("Token not active");
      } else {
        throw new Error("Token verification failed");
      }
    }
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Extracted token or null
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader || typeof authHeader !== "string") {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      return parts[1];
    }

    return null;
  }
}

// Export singleton instance
module.exports = new JWTService();
