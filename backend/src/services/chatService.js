const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const mongoose = require("mongoose");

/**
 * Chat service for managing conversations and messages
 */
class ChatService {
  /**
   * Create or get existing conversation between participants
   * @param {Array} participantIds - Array of student IDs
   * @returns {Object} - Conversation object
   */
  async createOrGetConversation(participantIds) {
    // Sort participant IDs to ensure consistent conversation lookup
    const sortedParticipants = participantIds.sort();

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: {
        $all: sortedParticipants,
        $size: sortedParticipants.length,
      },
    });

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: sortedParticipants,
        type: sortedParticipants.length === 2 ? "direct" : "group",
        updatedAt: new Date(),
      });
      await conversation.save();
    }

    return conversation;
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} senderStudentId - Sender's student ID
   * @param {Object} messageData - Message data (text, media)
   * @returns {Object} - Created message
   */
  async sendMessage(conversationId, senderStudentId, messageData) {
    const { text, media } = messageData;

    // Validate conversation exists and sender is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (!conversation.participants.includes(senderStudentId)) {
      throw new Error("Sender is not a participant in this conversation");
    }

    // Create message
    const message = new Message({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      senderStudentId,
      text: text || null,
      media: media || null,
      createdAt: new Date(),
      readBy: [{ studentId: senderStudentId, readAt: new Date() }], // Sender has read their own message
    });

    await message.save();

    // Update conversation's last message and timestamp
    await conversation.updateLastMessage({
      content: text || (media ? "Media message" : "Message"),
      senderStudentId,
      createdAt: message.createdAt,
      type: media ? "image" : "text",
    });

    // Populate sender information for response
    await message.populate("senderStudentId", "studentId displayName photoUrl");

    return message;
  }

  /**
   * Get messages for a conversation with pagination
   * @param {string} conversationId - Conversation ID
   * @param {string} userStudentId - Requesting user's student ID
   * @param {Object} options - Pagination options
   * @returns {Object} - Messages and pagination info
   */
  async getMessages(conversationId, userStudentId, options = {}) {
    const { limit = 50, before = null } = options;

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (!conversation.participants.includes(userStudentId)) {
      throw new Error("User is not a participant in this conversation");
    }

    // Build query
    const query = {
      conversationId: new mongoose.Types.ObjectId(conversationId),
    };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Get messages with pagination
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1) // Get one extra to check if there are more
      .populate("senderStudentId", "studentId displayName photoUrl")
      .lean();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove the extra message
    }

    return {
      messages: messages.reverse(), // Reverse to get chronological order
      hasMore,
      nextCursor: hasMore ? messages[0]?.createdAt : null,
    };
  }

  /**
   * Mark messages as read by a user
   * @param {string} conversationId - Conversation ID
   * @param {string} userStudentId - User's student ID
   * @param {Array} messageIds - Array of message IDs to mark as read
   * @returns {Object} - Update result
   */
  async markMessagesAsRead(conversationId, userStudentId, messageIds = null) {
    // Validate conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (!conversation.participants.includes(userStudentId)) {
      throw new Error("User is not a participant in this conversation");
    }

    // Build query for messages to mark as read
    const query = {
      conversationId: new mongoose.Types.ObjectId(conversationId),
      "readBy.studentId": { $ne: userStudentId }, // Only messages not already read by user
    };

    if (messageIds && messageIds.length > 0) {
      query._id = {
        $in: messageIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    // Update messages to add user to readBy array
    const result = await Message.updateMany(query, {
      $addToSet: { readBy: { studentId: userStudentId, readAt: new Date() } },
    });

    return {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    };
  }

  /**
   * Get conversations for a user with pagination
   * @param {string} userStudentId - User's student ID
   * @param {Object} options - Pagination options
   * @returns {Object} - Conversations and pagination info
   */
  async getUserConversations(userStudentId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    const conversations = await Conversation.find({
      participants: userStudentId,
    })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit + 1) // Get one extra to check if there are more
      .populate("participants", "studentId displayName photoUrl")
      .lean();

    const hasMore = conversations.length > limit;
    if (hasMore) {
      conversations.pop(); // Remove the extra conversation
    }

    // Get unread message counts for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conversation._id,
          "readBy.studentId": { $ne: userStudentId },
        });

        return {
          ...conversation,
          unreadCount,
        };
      })
    );

    return {
      conversations: conversationsWithUnread,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /**
   * Get typing users in a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Array} - Array of typing user IDs
   */
  getTypingUsers(conversationId) {
    // This would typically be stored in Redis or memory
    // For now, return empty array as typing is handled via Socket.IO events
    return [];
  }

  /**
   * Delete a message (soft delete by setting deleted flag)
   * @param {string} messageId - Message ID
   * @param {string} userStudentId - User's student ID
   * @returns {Object} - Updated message
   */
  async deleteMessage(messageId, userStudentId) {
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Only sender can delete their own message
    if (message.senderStudentId !== userStudentId) {
      throw new Error("Only the sender can delete this message");
    }

    // Soft delete by updating the message content
    message.text = "This message was deleted";
    message.media = null;
    message.isDeleted = true;
    await message.save();

    return message;
  }

  /**
   * Search messages in conversations
   * @param {string} userStudentId - User's student ID
   * @param {string} searchQuery - Search query
   * @param {Object} options - Search options
   * @returns {Array} - Matching messages
   */
  async searchMessages(userStudentId, searchQuery, options = {}) {
    const { limit = 20, conversationId = null } = options;

    // Get user's conversations
    const userConversations = await Conversation.find({
      participants: userStudentId,
    }).select("_id");

    const conversationIds = userConversations.map((conv) => conv._id);

    // Build search query
    const query = {
      conversationId: { $in: conversationIds },
      text: { $regex: searchQuery, $options: "i" },
      isDeleted: { $ne: true },
    };

    if (conversationId) {
      query.conversationId = new mongoose.Types.ObjectId(conversationId);
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("senderStudentId", "studentId displayName photoUrl")
      .populate("conversationId", "participants")
      .lean();

    return messages;
  }
}

module.exports = ChatService;
