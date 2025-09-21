const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const NotificationService = require("../services/notificationService");
const { query, body, param, validationResult } = require("express-validator");

const router = express.Router();
const notificationService = new NotificationService();

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
 * GET /notifications
 * Get user's notifications with pagination
 */
router.get(
  "/",
  authenticateToken,
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("offset")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Offset must be non-negative"),
    query("unreadOnly")
      .optional()
      .isBoolean()
      .withMessage("UnreadOnly must be a boolean"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { limit = 20, offset = 0, unreadOnly = false } = req.query;
      const userStudentId = req.user.studentId;

      const result = await notificationService.getUserNotifications(
        userStudentId,
        {
          limit: parseInt(limit),
          offset: parseInt(offset),
          unreadOnly: unreadOnly === "true",
        }
      );

      res.json({
        notifications: result.notifications,
        pagination: {
          hasMore: result.hasMore,
          nextOffset: result.nextOffset,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch notifications",
        },
      });
    }
  }
);

/**
 * GET /notifications/unread-count
 * Get count of unread notifications for user
 */
router.get("/unread-count", authenticateToken, async (req, res) => {
  try {
    const userStudentId = req.user.studentId;
    const unreadCount = await notificationService.getUnreadCount(userStudentId);

    res.json({
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch unread count",
      },
    });
  }
});

/**
 * PUT /notifications/read
 * Mark notifications as read
 */
router.put(
  "/read",
  authenticateToken,
  [
    body("notificationIds")
      .optional()
      .isArray()
      .withMessage("Notification IDs must be an array"),
    body("notificationIds.*")
      .optional()
      .isMongoId()
      .withMessage("Each notification ID must be valid"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { notificationIds } = req.body;
      const userStudentId = req.user.studentId;

      const result = await notificationService.markNotificationsAsRead(
        userStudentId,
        notificationIds
      );

      res.json({
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
      });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark notifications as read",
        },
      });
    }
  }
);

/**
 * PUT /notifications/:notificationId/read
 * Mark a specific notification as read
 */
router.put(
  "/:notificationId/read",
  authenticateToken,
  [param("notificationId").isMongoId().withMessage("Invalid notification ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userStudentId = req.user.studentId;

      const result = await notificationService.markNotificationsAsRead(
        userStudentId,
        [notificationId]
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error: {
            code: "NOTIFICATION_NOT_FOUND",
            message: "Notification not found or does not belong to user",
          },
        });
      }

      res.json({
        message: "Notification marked as read",
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark notification as read",
        },
      });
    }
  }
);

/**
 * POST /notifications/test
 * Create a test notification (development only)
 */
if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
  router.post(
    "/test",
    authenticateToken,
    [
      body("type")
        .isIn([
          "like",
          "comment",
          "follow",
          "message",
          "topic_vote",
          "topic_comment",
          "system",
        ])
        .withMessage("Invalid notification type"),
      body("message")
        .optional()
        .isString()
        .isLength({ min: 1, max: 200 })
        .withMessage("Message must be 1-200 characters"),
      body("meta").optional().isObject().withMessage("Meta must be an object"),
    ],
    handleValidationErrors,
    async (req, res) => {
      try {
        const { type, message, meta = {} } = req.body;
        const userStudentId = req.user.studentId;

        const notification = await notificationService.createNotification({
          toStudentId: userStudentId,
          type,
          message: message || `Test ${type} notification`,
          meta: {
            ...meta,
            isTest: true,
            fromDisplayName: "Test User",
          },
        });

        res.status(201).json({
          message: "Test notification created",
          notification: {
            _id: notification._id,
            type: notification.type,
            message: notification.message,
            meta: notification.meta,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
          },
        });
      } catch (error) {
        console.error("Error creating test notification:", error);
        res.status(500).json({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create test notification",
          },
        });
      }
    }
  );
}

module.exports = router;
