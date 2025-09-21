const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const ChatService = require("../services/chatService");
const { body, param, query, validationResult } = require("express-validator");

const router = express.Router();
const chatService = new ChatService();

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
 * GET /chat/conversations
 * Get user's conversations with pagination
 */
router.get(
  "/conversations",
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
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userStudentId = req.user.studentId;

      const result = await chatService.getUserConversations(userStudentId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({
        conversations: result.conversations,
        pagination: {
          hasMore: result.hasMore,
          nextOffset: result.nextOffset,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch conversations",
        },
      });
    }
  }
);

/**
 * POST /chat/conversations
 * Create or get conversation with specified participants
 */
router.post(
  "/conversations",
  authenticateToken,
  [
    body("participants")
      .isArray({ min: 1, max: 10 })
      .withMessage("Participants must be an array with 1-10 members"),
    body("participants.*")
      .isString()
      .matches(/^[0-9]{4}[A-Z]{2}[0-9]{4}$/)
      .withMessage("Each participant must be a valid student ID"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { participants } = req.body;
      const userStudentId = req.user.studentId;

      // Add current user to participants if not already included
      const allParticipants = [...new Set([userStudentId, ...participants])];

      const conversation = await chatService.createOrGetConversation(
        allParticipants
      );

      res.status(201).json({
        conversation: {
          _id: conversation._id,
          participants: conversation.participants,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create conversation",
        },
      });
    }
  }
);

/**
 * GET /chat/conversations/:conversationId/messages
 * Get messages for a conversation with pagination
 */
router.get(
  "/conversations/:conversationId/messages",
  authenticateToken,
  [
    param("conversationId").isMongoId().withMessage("Invalid conversation ID"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("before")
      .optional()
      .isISO8601()
      .withMessage("Before must be a valid ISO date"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { limit = 50, before } = req.query;
      const userStudentId = req.user.studentId;

      const result = await chatService.getMessages(
        conversationId,
        userStudentId,
        {
          limit: parseInt(limit),
          before,
        }
      );

      res.json({
        messages: result.messages,
        pagination: {
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Error fetching messages:", error);

      if (
        error.message === "Conversation not found" ||
        error.message === "User is not a participant in this conversation"
      ) {
        return res.status(404).json({
          error: {
            code: "CONVERSATION_NOT_FOUND",
            message: error.message,
          },
        });
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch messages",
        },
      });
    }
  }
);

/**
 * POST /chat/conversations/:conversationId/messages
 * Send a message in a conversation
 */
router.post(
  "/conversations/:conversationId/messages",
  authenticateToken,
  [
    param("conversationId").isMongoId().withMessage("Invalid conversation ID"),
    body("text")
      .optional()
      .isString()
      .isLength({ min: 1, max: 2000 })
      .withMessage("Text must be 1-2000 characters"),
    body("media").optional().isObject().withMessage("Media must be an object"),
    body("media.url").optional().isURL().withMessage("Media URL must be valid"),
    body("media.cloudinaryPublicId")
      .optional()
      .isString()
      .withMessage("Cloudinary public ID must be a string"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { text, media } = req.body;
      const userStudentId = req.user.studentId;

      if (!text && !media) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Either text or media is required",
          },
        });
      }

      const message = await chatService.sendMessage(
        conversationId,
        userStudentId,
        {
          text,
          media,
        }
      );

      res.status(201).json({
        message: {
          _id: message._id,
          text: message.text,
          media: message.media,
          senderStudentId: message.senderStudentId,
          createdAt: message.createdAt,
          readBy: message.readBy,
        },
      });
    } catch (error) {
      console.error("Error sending message:", error);

      if (
        error.message === "Conversation not found" ||
        error.message === "Sender is not a participant in this conversation"
      ) {
        return res.status(404).json({
          error: {
            code: "CONVERSATION_NOT_FOUND",
            message: error.message,
          },
        });
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send message",
        },
      });
    }
  }
);

/**
 * PUT /chat/conversations/:conversationId/read
 * Mark messages as read in a conversation
 */
router.put(
  "/conversations/:conversationId/read",
  authenticateToken,
  [
    param("conversationId").isMongoId().withMessage("Invalid conversation ID"),
    body("messageIds")
      .optional()
      .isArray()
      .withMessage("Message IDs must be an array"),
    body("messageIds.*")
      .optional()
      .isMongoId()
      .withMessage("Each message ID must be valid"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { messageIds } = req.body;
      const userStudentId = req.user.studentId;

      const result = await chatService.markMessagesAsRead(
        conversationId,
        userStudentId,
        messageIds
      );

      res.json({
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);

      if (
        error.message === "Conversation not found" ||
        error.message === "User is not a participant in this conversation"
      ) {
        return res.status(404).json({
          error: {
            code: "CONVERSATION_NOT_FOUND",
            message: error.message,
          },
        });
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark messages as read",
        },
      });
    }
  }
);

/**
 * DELETE /chat/messages/:messageId
 * Delete a message (soft delete)
 */
router.delete(
  "/messages/:messageId",
  authenticateToken,
  [param("messageId").isMongoId().withMessage("Invalid message ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const userStudentId = req.user.studentId;

      const message = await chatService.deleteMessage(messageId, userStudentId);

      res.json({
        message: "Message deleted successfully",
        messageId: message._id,
      });
    } catch (error) {
      console.error("Error deleting message:", error);

      if (error.message === "Message not found") {
        return res.status(404).json({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: error.message,
          },
        });
      }

      if (error.message === "Only the sender can delete this message") {
        return res.status(403).json({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: error.message,
          },
        });
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete message",
        },
      });
    }
  }
);

/**
 * GET /chat/search
 * Search messages across conversations
 */
router.get(
  "/search",
  authenticateToken,
  [
    query("q")
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be 1-100 characters"),
    query("conversationId")
      .optional()
      .isMongoId()
      .withMessage("Invalid conversation ID"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { q: searchQuery, conversationId, limit = 20 } = req.query;
      const userStudentId = req.user.studentId;

      const messages = await chatService.searchMessages(
        userStudentId,
        searchQuery,
        {
          limit: parseInt(limit),
          conversationId,
        }
      );

      res.json({
        messages,
        query: searchQuery,
        totalResults: messages.length,
      });
    } catch (error) {
      console.error("Error searching messages:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search messages",
        },
      });
    }
  }
);

module.exports = router;
