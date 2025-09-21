const express = require("express");
const { body, validationResult } = require("express-validator");
const { authenticateToken } = require("../middleware/authMiddleware");
const { mediaUploadRateLimit } = require("../middleware/rateLimitMiddleware");
const {
  generateSignedUploadParams,
  validateMediaForPost,
} = require("../controllers/mediaController");

const router = express.Router();

// Validation middleware for signed upload parameters
const validateSignRequest = [
  body("filename")
    .notEmpty()
    .withMessage("Filename is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Filename must be between 1 and 255 characters"),
  body("mimeType")
    .notEmpty()
    .withMessage("MIME type is required")
    .matches(/^(image|video)\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*$/)
    .withMessage("Invalid MIME type format"),
  body("size")
    .isInt({ min: 1 })
    .withMessage("File size must be a positive integer")
    .custom((value) => {
      const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default
      if (value > maxSize) {
        throw new Error(`File size exceeds maximum limit of ${maxSize} bytes`);
      }
      return true;
    }),
  body("resourceType")
    .optional()
    .isIn(["image", "video", "auto"])
    .withMessage("Resource type must be image, video, or auto"),
];

// Validation middleware for media validation
const validateMediaValidation = [
  body("media")
    .isArray({ min: 1 })
    .withMessage("Media array is required and must contain at least one item"),
  body("media.*.cloudinaryPublicId")
    .notEmpty()
    .withMessage("Cloudinary public ID is required for each media item"),
  body("media.*.url")
    .notEmpty()
    .withMessage("URL is required for each media item")
    .isURL()
    .withMessage("Invalid URL format"),
  body("media.*.width")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Width must be a positive integer"),
  body("media.*.height")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Height must be a positive integer"),
  body("postType")
    .isIn(["image", "video", "text"])
    .withMessage("Post type must be image, video, or text"),
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
 * @route   POST /media/sign
 * @desc    Generate signed upload parameters for Cloudinary
 * @access  Private
 * @body    { filename: string, mimeType: string, size: number, resourceType?: string }
 */
router.post(
  "/sign",
  mediaUploadRateLimit,
  authenticateToken,
  validateSignRequest,
  handleValidationErrors,
  generateSignedUploadParams
);

/**
 * @route   POST /media/validate
 * @desc    Validate media for post creation
 * @access  Private
 * @body    { media: Array<{cloudinaryPublicId, url, width?, height?}>, postType: string }
 */
router.post(
  "/validate",
  mediaUploadRateLimit,
  authenticateToken,
  validateMediaValidation,
  handleValidationErrors,
  validateMediaForPost
);

/**
 * @route   GET /media/limits
 * @desc    Get media upload limits and supported formats
 * @access  Public
 */
router.get("/limits", (req, res) => {
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default
  const maxFilesPerPost = parseInt(process.env.MAX_FILES_PER_POST) || 5;

  res.json({
    maxFileSize,
    maxFilesPerPost,
    supportedImageFormats: ["jpg", "jpeg", "png", "gif"],
    supportedVideoFormats: ["mp4", "mov", "avi"],
    supportedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
    ],
  });
});

module.exports = router;
