const express = require("express");
const { body, query, validationResult } = require("express-validator");
const {
  requireAdmin,
  authenticateToken,
} = require("../middleware/authMiddleware");
const { adminRateLimit } = require("../middleware/rateLimitMiddleware");
const {
  uploadRoster,
  getReports,
  exportData,
  moderateContent,
  getPendingReports,
  processReport,
  createReport,
} = require("../controllers/adminController");

const router = express.Router();

// Validation middleware
const validateRosterUpload = [
  body("csvData")
    .notEmpty()
    .withMessage("CSV data is required")
    .isString()
    .withMessage("CSV data must be a string")
    .isLength({ min: 10 })
    .withMessage("CSV data appears to be too short"),
];

const validateReportsQuery = [
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  query("type")
    .optional()
    .isIn(["users", "content", "activity"])
    .withMessage("Type must be one of: users, content, activity"),
];

const validateExportQuery = [
  query("type")
    .notEmpty()
    .withMessage("Export type is required")
    .isIn(["users", "posts", "topics"])
    .withMessage("Type must be one of: users, posts, topics"),
  query("format")
    .optional()
    .isIn(["json", "csv"])
    .withMessage("Format must be either json or csv"),
];

const validateModerationAction = [
  body("action")
    .notEmpty()
    .withMessage("Moderation action is required")
    .isIn([
      "remove_content",
      "warn_user",
      "suspend_user",
      "ban_user",
      "dismiss_report",
    ])
    .withMessage("Invalid moderation action"),
  body("contentType")
    .optional()
    .isIn(["post", "comment", "topic", "story"])
    .withMessage("Invalid content type"),
  body("contentId")
    .optional()
    .isMongoId()
    .withMessage("Content ID must be a valid MongoDB ObjectId"),
  body("userId").optional().isString().withMessage("User ID must be a string"),
  body("reason")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Reason must be a string with max 500 characters"),
  body("notes")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Notes must be a string with max 1000 characters"),
];

const validateReportCreation = [
  body("contentType")
    .notEmpty()
    .withMessage("Content type is required")
    .isIn(["post", "comment", "topic", "story", "message", "user"])
    .withMessage("Invalid content type"),
  body("contentId")
    .notEmpty()
    .withMessage("Content ID is required")
    .isMongoId()
    .withMessage("Content ID must be a valid MongoDB ObjectId"),
  body("reportedStudentId")
    .notEmpty()
    .withMessage("Reported student ID is required")
    .isString()
    .withMessage("Reported student ID must be a string"),
  body("reason")
    .notEmpty()
    .withMessage("Report reason is required")
    .isIn([
      "spam",
      "harassment",
      "hate_speech",
      "inappropriate_content",
      "violence",
      "misinformation",
      "copyright",
      "privacy_violation",
      "other",
    ])
    .withMessage("Invalid report reason"),
  body("description")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Description must be a string with max 1000 characters"),
];

const validateReportProcess = [
  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn(["resolve", "dismiss"])
    .withMessage("Action must be either resolve or dismiss"),
  body("notes")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Notes must be a string with max 1000 characters"),
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
 * @route   POST /admin/roster
 * @desc    Upload and process roster CSV file
 * @access  Admin only
 * @body    { csvData: string }
 */
router.post(
  "/roster",
  adminRateLimit,
  requireAdmin,
  validateRosterUpload,
  handleValidationErrors,
  uploadRoster
);

/**
 * @route   GET /admin/reports
 * @desc    Get basic analytics and metrics
 * @access  Admin only
 * @query   { startDate?: string, endDate?: string, type?: string }
 */
router.get(
  "/reports",
  adminRateLimit,
  requireAdmin,
  validateReportsQuery,
  handleValidationErrors,
  getReports
);

/**
 * @route   GET /admin/export
 * @desc    Export data for privacy compliance
 * @access  Admin only
 * @query   { type: string, format?: string }
 */
router.get(
  "/export",
  adminRateLimit,
  requireAdmin,
  validateExportQuery,
  handleValidationErrors,
  exportData
);

/**
 * @route   POST /admin/moderate
 * @desc    Moderate content (remove, ban users, etc.)
 * @access  Admin only
 * @body    { action: string, contentType?: string, contentId?: string, userId?: string, reason?: string, notes?: string }
 */
router.post(
  "/moderate",
  adminRateLimit,
  requireAdmin,
  validateModerationAction,
  handleValidationErrors,
  moderateContent
);

/**
 * @route   GET /admin/reports/pending
 * @desc    Get pending reports for moderation
 * @access  Admin only
 * @query   { page?: number, limit?: number, contentType?: string, reason?: string }
 */
router.get("/reports/pending", adminRateLimit, requireAdmin, getPendingReports);

/**
 * @route   POST /admin/reports/:reportId/process
 * @desc    Process a specific report
 * @access  Admin only
 * @body    { action: string, notes?: string }
 */
router.post(
  "/reports/:reportId/process",
  adminRateLimit,
  requireAdmin,
  validateReportProcess,
  handleValidationErrors,
  processReport
);

/**
 * @route   POST /admin/reports
 * @desc    Create a new report (for users to report content)
 * @access  Authenticated users
 * @body    { contentType: string, contentId: string, reportedStudentId: string, reason: string, description?: string }
 */
router.post(
  "/reports",
  adminRateLimit,
  authenticateToken,
  validateReportCreation,
  handleValidationErrors,
  createReport
);

module.exports = router;
