const express = require("express");
const { body, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/authMiddleware");
const { authRateLimit } = require("../middleware/rateLimitMiddleware");
const {
  firebaseSignIn,
  linkStudentId,
  getCurrentUser,
  refreshToken,
} = require("../controllers/authController");

const router = express.Router();

// Validation middleware
const validateFirebaseSignIn = [
  body("idToken")
    .notEmpty()
    .withMessage("Firebase ID token is required")
    .isLength({ min: 10 })
    .withMessage("Invalid Firebase ID token format"),
];

const validateLinkStudentId = [
  body("idToken")
    .notEmpty()
    .withMessage("Firebase ID token is required")
    .isLength({ min: 10 })
    .withMessage("Invalid Firebase ID token format"),
  body("studentId")
    .notEmpty()
    .withMessage("Student ID is required")
    .matches(/^[0-9]{4}[A-Z]{2}[0-9]{4}$/)
    .withMessage("Student ID must be in format: YYYYDDNNNN (e.g., 2025CS1001)"),
  body("verificationCode")
    .optional()
    .isLength({ min: 1 })
    .withMessage("Verification code cannot be empty if provided"),
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      },
    });
  }
  next();
};

/**
 * @route   POST /auth/firebaseSignIn
 * @desc    Sign in with Firebase ID token
 * @access  Public
 * @body    { idToken: string }
 */
router.post(
  "/firebaseSignIn",
  authRateLimit,
  validateFirebaseSignIn,
  handleValidationErrors,
  firebaseSignIn
);

/**
 * @route   POST /auth/linkStudentId
 * @desc    Link Firebase account to student ID
 * @access  Public
 * @body    { idToken: string, studentId: string, verificationCode?: string }
 */
router.post(
  "/linkStudentId",
  authRateLimit,
  validateLinkStudentId,
  handleValidationErrors,
  linkStudentId
);

/**
 * @route   GET /auth/me
 * @desc    Get current user information
 * @access  Private
 */
router.get("/me", authenticateToken, getCurrentUser);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post("/refresh", authenticateToken, refreshToken);

/**
 * @route   GET /auth/verify
 * @desc    Verify token validity (useful for client-side token validation)
 * @access  Private
 */
router.get("/verify", authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      studentId: req.user.studentId,
      email: req.user.email,
      displayName: req.user.displayName,
    },
  });
});

module.exports = router;
