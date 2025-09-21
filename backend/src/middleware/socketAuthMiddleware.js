const jwtService = require("../services/jwtService");
const User = require("../models/User");

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from socket handshake and attaches user data
 * @param {Object} socket - Socket.IO socket instance
 * @param {Function} next - Next function to continue or reject connection
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    // Extract token from handshake auth or query parameters
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      (socket.handshake.headers?.authorization &&
        socket.handshake.headers.authorization.replace("Bearer ", ""));

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwtService.verifyToken(token);
    } catch (error) {
      let errorMessage = "Invalid authentication token";

      if (error.message === "Token has expired") {
        errorMessage = "Authentication token has expired";
      } else if (error.message === "Token not active") {
        errorMessage = "Authentication token is not yet active";
      }

      return next(new Error(errorMessage));
    }

    const { studentId, email, uid } = decoded;

    if (!studentId) {
      return next(
        new Error("Token does not contain required user information")
      );
    }

    // Verify user exists in database
    try {
      const user = await User.findOne({ studentId }).lean();
      if (!user) {
        return next(new Error("User account no longer exists"));
      }

      // Attach user data to socket
      socket.user = {
        studentId: user.studentId,
        email: user.email,
        displayName: user.displayName,
        year: user.year,
        department: user.department,
        section: user.section,
        photoUrl: user.photoUrl,
        uid,
      };

      // Create a unique room for this user for private notifications
      socket.join(`user:${user.studentId}`);

      next();
    } catch (dbError) {
      console.error("Database error during socket authentication:", dbError);
      return next(new Error("Authentication verification failed"));
    }
  } catch (error) {
    console.error("Socket authentication middleware error:", error);
    return next(new Error("Authentication process failed"));
  }
};

module.exports = {
  socketAuthMiddleware,
};
