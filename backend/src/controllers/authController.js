const firebaseService = require("../services/firebaseService");
const jwtService = require("../services/jwtService");
const User = require("../models/User");

/**
 * Firebase Sign-In endpoint
 * Verifies Firebase ID token and creates/returns user with app JWT
 */
const firebaseSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        error: {
          code: "MISSING_ID_TOKEN",
          message: "Firebase ID token is required",
        },
      });
    }

    // Verify Firebase token and validate email domain
    let decodedToken;
    try {
      decodedToken = await firebaseService.verifyTokenAndDomain(idToken);
    } catch (error) {
      let errorCode = "FIREBASE_VERIFICATION_FAILED";
      let statusCode = 401;

      if (error.message.includes("Access denied: school-domain required")) {
        errorCode = "INVALID_EMAIL_DOMAIN";
        statusCode = 403;
      } else if (error.message.includes("expired")) {
        errorCode = "FIREBASE_TOKEN_EXPIRED";
      } else if (error.message.includes("invalid")) {
        errorCode = "INVALID_FIREBASE_TOKEN";
      }

      return res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          details: error.message.includes("Access denied")
            ? {
                providedDomain: firebaseService.extractEmailDomain(
                  error.message.split("Provided: ")[1]?.split(",")[0]
                ),
                requiredDomain: firebaseService.getCollegeEmailDomain(),
              }
            : undefined,
        },
      });
    }

    const { email, uid, name, picture } = decodedToken;

    // Look for existing user by email
    let user = await User.findOne({ email }).lean();

    if (!user) {
      // Check if there's a user record with this email but no Firebase UID
      // This handles the case where admin uploaded roster but user hasn't signed in yet
      const existingUserByEmail = await User.findOne({ email });

      if (existingUserByEmail) {
        // Link Firebase UID to existing user record
        existingUserByEmail.uid = uid;
        existingUserByEmail.displayName =
          existingUserByEmail.displayName || name;
        existingUserByEmail.photoUrl = picture;
        existingUserByEmail.joinedAt = new Date();

        await existingUserByEmail.save();
        user = existingUserByEmail.toObject();
      } else {
        // No existing user found - this means they're not in the roster
        return res.status(403).json({
          error: {
            code: "STUDENT_NOT_IN_ROSTER",
            message:
              "Student record not found in roster. Please contact administrator.",
            details: {
              email,
              suggestion:
                "Ensure your email is registered in the college roster or use the student ID linking endpoint.",
            },
          },
        });
      }
    } else if (!user.uid) {
      // User exists but no Firebase UID linked - link it now
      await User.updateOne(
        { email },
        {
          uid,
          displayName: user.displayName || name,
          photoUrl: picture,
          joinedAt: user.joinedAt || new Date(),
        }
      );

      // Refresh user data
      user = await User.findOne({ email }).lean();
    }

    // Generate app JWT token
    const tokenPayload = {
      studentId: user.studentId,
      email: user.email,
      uid: user.uid,
      year: user.year,
      department: user.department,
      section: user.section,
    };

    const appToken = jwtService.generateToken(tokenPayload);

    // Return user data and token
    res.json({
      token: appToken,
      user: {
        studentId: user.studentId,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        year: user.year,
        department: user.department,
        section: user.section,
        bio: user.bio,
        badges: user.badges || [],
        joinedAt: user.joinedAt,
        settings: user.settings || { notifications: true },
      },
    });
  } catch (error) {
    console.error("Firebase sign-in error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Authentication process failed",
      },
    });
  }
};

/**
 * Link Student ID endpoint
 * Allows manual linking of Firebase account to student ID for users not found by email
 */
const linkStudentId = async (req, res) => {
  try {
    const { idToken, studentId, verificationCode } = req.body;

    if (!idToken || !studentId) {
      return res.status(400).json({
        error: {
          code: "MISSING_REQUIRED_FIELDS",
          message: "Firebase ID token and student ID are required",
        },
      });
    }

    // Verify Firebase token and domain
    let decodedToken;
    try {
      decodedToken = await firebaseService.verifyTokenAndDomain(idToken);
    } catch (error) {
      return res.status(401).json({
        error: {
          code: "FIREBASE_VERIFICATION_FAILED",
          message: error.message,
        },
      });
    }

    const { email, uid, name, picture } = decodedToken;

    // Check if student ID exists in roster
    const existingUser = await User.findOne({ studentId });

    if (!existingUser) {
      return res.status(404).json({
        error: {
          code: "STUDENT_ID_NOT_FOUND",
          message: "Student ID not found in roster",
          details: {
            studentId,
            suggestion:
              "Verify the student ID is correct or contact administrator.",
          },
        },
      });
    }

    // Check if student ID is already linked to another account
    if (existingUser.email && existingUser.email !== email) {
      return res.status(409).json({
        error: {
          code: "STUDENT_ID_ALREADY_LINKED",
          message: "Student ID is already linked to another account",
          details: {
            linkedEmail: existingUser.email.replace(/(.{2}).*(@.*)/, "$1***$2"), // Partially mask email
          },
        },
      });
    }

    // For now, we'll skip verification code validation
    // In production, you might want to implement email verification or admin approval
    if (verificationCode && verificationCode !== "SKIP_VERIFICATION") {
      // Implement verification logic here if needed
      // For now, we'll accept any verification code
    }

    // Link the accounts
    existingUser.email = email;
    existingUser.uid = uid;
    existingUser.displayName = existingUser.displayName || name;
    existingUser.photoUrl = picture;
    existingUser.joinedAt = new Date();

    await existingUser.save();

    // Generate app JWT token
    const tokenPayload = {
      studentId: existingUser.studentId,
      email: existingUser.email,
      uid: existingUser.uid,
      year: existingUser.year,
      department: existingUser.department,
      section: existingUser.section,
    };

    const appToken = jwtService.generateToken(tokenPayload);

    // Return success response
    res.json({
      token: appToken,
      user: {
        studentId: existingUser.studentId,
        email: existingUser.email,
        displayName: existingUser.displayName,
        photoUrl: existingUser.photoUrl,
        year: existingUser.year,
        department: existingUser.department,
        section: existingUser.section,
        bio: existingUser.bio,
        badges: existingUser.badges || [],
        joinedAt: existingUser.joinedAt,
        settings: existingUser.settings || { notifications: true },
      },
      message: "Student ID successfully linked to your account",
    });
  } catch (error) {
    console.error("Link student ID error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Student ID linking process failed",
      },
    });
  }
};

/**
 * Get current user info (requires authentication)
 */
const getCurrentUser = async (req, res) => {
  try {
    // User info is already available from auth middleware
    const user = await User.findOne({ studentId: req.user.studentId }).lean();

    if (!user) {
      return res.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User account not found",
        },
      });
    }

    res.json({
      user: {
        studentId: user.studentId,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        year: user.year,
        department: user.department,
        section: user.section,
        bio: user.bio,
        badges: user.badges || [],
        joinedAt: user.joinedAt,
        settings: user.settings || { notifications: true },
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve user information",
      },
    });
  }
};

/**
 * Refresh JWT token (requires valid but potentially expiring token)
 */
const refreshToken = async (req, res) => {
  try {
    // Generate new token with same payload
    const tokenPayload = {
      studentId: req.user.studentId,
      email: req.user.email,
      uid: req.user.uid,
      year: req.user.year,
      department: req.user.department,
      section: req.user.section,
    };

    const newToken = jwtService.generateToken(tokenPayload);

    res.json({
      token: newToken,
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Token refresh failed",
      },
    });
  }
};

module.exports = {
  firebaseSignIn,
  linkStudentId,
  getCurrentUser,
  refreshToken,
};
