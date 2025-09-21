const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const {
  getUserProfile,
  updateUserProfile,
  getUsers,
  searchUsers,
} = require("../controllers/usersController");
const {
  authenticateToken,
  optionalAuth,
} = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * Validation middleware to check for validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input data",
        details: errors.array(),
      },
    });
  }
  next();
};

/**
 * GET /users - Get users with filtering by year/department/section
 */
router.get(
  "/",
  [
    query("year")
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage("Year must be between 1 and 4"),
    query("department")
      .optional()
      .isIn(["CS", "ECE", "ME", "CE", "EE", "IT", "BT", "CH", "PH", "MA"])
      .withMessage(
        "Department must be one of: CS, ECE, ME, CE, EE, IT, BT, CH, PH, MA"
      ),
    query("section")
      .optional()
      .matches(/^[A-Za-z]$/)
      .withMessage("Section must be a single letter"),
    query("search")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be between 1 and 100 characters"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
  ],
  handleValidationErrors,
  optionalAuth,
  getUsers
);

/**
 * GET /users/search - Search users with advanced filtering
 */
router.get(
  "/search",
  [
    query("q")
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be between 1 and 100 characters"),
    query("year")
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage("Year must be between 1 and 4"),
    query("department")
      .optional()
      .isIn(["CS", "ECE", "ME", "CE", "EE", "IT", "BT", "CH", "PH", "MA"])
      .withMessage(
        "Department must be one of: CS, ECE, ME, CE, EE, IT, BT, CH, PH, MA"
      ),
    query("section")
      .optional()
      .matches(/^[A-Za-z]$/)
      .withMessage("Section must be a single letter"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  handleValidationErrors,
  optionalAuth,
  searchUsers
);

/**
 * GET /users/:studentId - Get user profile by student ID
 */
router.get(
  "/:studentId",
  [
    param("studentId")
      .matches(/^\d{4}[A-Z]{2,4}\d{3,4}$/)
      .withMessage("Student ID must follow format: YYYY[DEPT][NUMBER]"),
  ],
  handleValidationErrors,
  optionalAuth,
  getUserProfile
);

/**
 * PATCH /users/:studentId - Update user profile (owner only)
 */
router.patch(
  "/:studentId",
  authenticateToken,
  [
    param("studentId")
      .matches(/^\d{4}[A-Z]{2,4}\d{3,4}$/)
      .withMessage("Student ID must follow format: YYYY[DEPT][NUMBER]"),
    body("displayName")
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage("Display name must be between 2 and 50 characters"),
    body("photoUrl")
      .optional()
      .isURL()
      .withMessage("Photo URL must be a valid URL"),
    body("bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Bio cannot exceed 500 characters"),
    body("settings.notifications")
      .optional()
      .isBoolean()
      .withMessage("Notifications setting must be a boolean"),
    body("settings.privacy.showEmail")
      .optional()
      .isBoolean()
      .withMessage("Show email setting must be a boolean"),
    body("settings.privacy.showYear")
      .optional()
      .isBoolean()
      .withMessage("Show year setting must be a boolean"),
  ],
  handleValidationErrors,
  updateUserProfile
);

module.exports = router;
