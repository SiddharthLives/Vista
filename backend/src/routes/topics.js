const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const {
  authenticateToken,
  optionalAuth,
} = require("../middleware/authMiddleware");
const {
  getTopics,
  createTopic,
  getTopicById,
  voteTopic,
  commentOnTopic,
  getTopicComments,
} = require("../controllers/topicsController");

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
 * GET /topics - Get topics with tag filtering and pagination
 */
router.get(
  "/",
  [
    query("cursor")
      .optional()
      .custom((value) => {
        // Accept either ISO date or MongoDB ObjectId
        const isValidDate = !isNaN(Date.parse(value));
        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(value);
        return isValidDate || isValidObjectId;
      })
      .withMessage("Cursor must be a valid ISO date or MongoDB ObjectId"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("sortBy")
      .optional()
      .isIn(["recent", "popular", "engagement"])
      .withMessage("Sort by must be one of: recent, popular, engagement"),
    query("authorStudentId")
      .optional()
      .matches(/^\d{4}[A-Z]{2,4}\d{3,4}$/)
      .withMessage("Author student ID must follow format: YYYY[DEPT][NUMBER]"),
    query("tags")
      .optional()
      .custom((value) => {
        if (typeof value === "string") {
          return value
            .split(",")
            .every((tag) => /^[a-z0-9_-]+$/.test(tag.trim()));
        }
        return (
          Array.isArray(value) &&
          value.every((tag) => /^[a-z0-9_-]+$/.test(tag))
        );
      })
      .withMessage(
        "Tags must contain only lowercase letters, numbers, underscores, and hyphens"
      ),
    query("search")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be between 1 and 100 characters"),
  ],
  handleValidationErrors,
  optionalAuth,
  getTopics
);

/**
 * POST /topics - Create a new topic
 */
router.post(
  "/",
  authenticateToken,
  [
    body("title")
      .isLength({ min: 3, max: 200 })
      .withMessage("Title must be between 3 and 200 characters")
      .trim(),
    body("body")
      .isLength({ min: 10, max: 5000 })
      .withMessage("Body must be between 10 and 5000 characters")
      .trim(),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("tags.*")
      .if(body("tags").exists())
      .matches(/^[a-z0-9_-]+$/)
      .withMessage(
        "Tags can only contain lowercase letters, numbers, underscores, and hyphens"
      )
      .isLength({ max: 50 })
      .withMessage("Each tag cannot exceed 50 characters"),
  ],
  handleValidationErrors,
  createTopic
);

/**
 * GET /topics/:id - Get a specific topic by ID
 */
router.get(
  "/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("Topic ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  optionalAuth,
  getTopicById
);

/**
 * POST /topics/:id/vote - Vote on a topic (upvote/downvote)
 */
router.post(
  "/:id/vote",
  authenticateToken,
  [
    param("id")
      .isMongoId()
      .withMessage("Topic ID must be a valid MongoDB ObjectId"),
    body("voteType")
      .isIn(["up", "down", "remove_up", "remove_down"])
      .withMessage(
        "Vote type must be one of: up, down, remove_up, remove_down"
      ),
  ],
  handleValidationErrors,
  voteTopic
);

/**
 * POST /topics/:id/comment - Add a comment to a topic
 */
router.post(
  "/:id/comment",
  authenticateToken,
  [
    param("id")
      .isMongoId()
      .withMessage("Topic ID must be a valid MongoDB ObjectId"),
    body("content")
      .isLength({ min: 1, max: 1000 })
      .withMessage("Comment content must be between 1 and 1000 characters")
      .trim(),
    body("parentCommentId")
      .optional()
      .isMongoId()
      .withMessage("Parent comment ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  commentOnTopic
);

/**
 * GET /topics/:id/comments - Get comments for a topic
 */
router.get(
  "/:id/comments",
  [
    param("id")
      .isMongoId()
      .withMessage("Topic ID must be a valid MongoDB ObjectId"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("sortBy")
      .optional()
      .isIn(["newest", "oldest", "popular"])
      .withMessage("Sort by must be one of: newest, oldest, popular"),
    query("parentCommentId")
      .optional()
      .isMongoId()
      .withMessage("Parent comment ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  optionalAuth,
  getTopicComments
);

module.exports = router;
