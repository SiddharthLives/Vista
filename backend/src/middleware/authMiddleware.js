const jwtService = require("../services/jwtService");
const User = require("../models/User");

/**
 * Authentication middleware to verify JWT tokens and extract user context
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: {
          code: "MISSING_TOKEN",
          message: "Access token is required",
        },
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwtService.verifyToken(token);
    } catch (error) {
      let errorCode = "INVALID_TOKEN";
      let errorMessage = "Invalid access token";

      if (error.message === "Token has expired") {
        errorCode = "TOKEN_EXPIRED";
        errorMessage = "Access token has expired";
      } else if (error.message === "Token not active") {
        errorCode = "TOKEN_NOT_ACTIVE";
        errorMessage = "Access token is not yet active";
      }

      return res.status(401).json({
        error: {
          code: errorCode,
          message: errorMessage,
        },
      });
    }

    // Extract user information from token
    const { studentId, email, uid } = decoded;

    if (!studentId) {
      return res.status(401).json({
        error: {
          code: "INVALID_TOKEN_PAYLOAD",
          message: "Token does not contain required user information",
        },
      });
    }

    // Optionally verify user still exists in database
    // This can be disabled for performance if needed
    if (process.env.VERIFY_USER_EXISTS !== "false") {
      try {
        const user = await User.findOne({ studentId }).lean();
        if (!user) {
          return res.status(401).json({
            error: {
              code: "USER_NOT_FOUND",
              message: "User account no longer exists",
            },
          });
        }

        // Add full user data to request context
        req.user = {
          studentId: user.studentId,
          email: user.email,
          displayName: user.displayName,
          year: user.year,
          department: user.department,
          section: user.section,
          photoUrl: user.photoUrl,
          uid,
        };
      } catch (dbError) {
        console.error("Database error during authentication:", dbError);
        return res.status(500).json({
          error: {
            code: "DATABASE_ERROR",
            message: "Authentication verification failed",
          },
        });
      }
    } else {
      // Use token data directly without database lookup
      req.user = {
        studentId,
        email,
        uid,
      };
    }

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      error: {
        code: "AUTHENTICATION_ERROR",
        message: "Authentication process failed",
      },
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * Useful for endpoints that work for both authenticated and unauthenticated users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = jwtService.extractTokenFromHeader(authHeader);

  if (!token) {
    // No token provided, continue without user context
    req.user = null;
    return next();
  }

  // If token is provided, verify it
  try {
    const decoded = jwtService.verifyToken(token);
    const { studentId, email, uid } = decoded;

    if (studentId) {
      if (process.env.VERIFY_USER_EXISTS !== "false") {
        const user = await User.findOne({ studentId }).lean();
        if (user) {
          req.user = {
            studentId: user.studentId,
            email: user.email,
            displayName: user.displayName,
            year: user.year,
            department: user.department,
            section: user.section,
            photoUrl: user.photoUrl,
            uid,
          };
        } else {
          req.user = null;
        }
      } else {
        req.user = { studentId, email, uid };
      }
    } else {
      req.user = null;
    }
  } catch (error) {
    // Invalid token, continue without user context
    req.user = null;
  }

  next();
};

/**
 * Admin authentication middleware - requires admin role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = async (req, res, next) => {
  // First run standard authentication
  await new Promise((resolve, reject) => {
    authenticateToken(req, res, (error) => {
      if (error) reject(error);
      else resolve();
    });
  }).catch(() => {
    // Authentication failed, response already sent
    return;
  });

  // Check if user has admin privileges
  // This could be based on email domain, specific user list, or database role
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim());
  const isAdmin =
    adminEmails.includes(req.user?.email) ||
    req.user?.email?.endsWith("@admin.college.edu");

  if (!isAdmin) {
    return res.status(403).json({
      error: {
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Admin access required",
      },
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
};
