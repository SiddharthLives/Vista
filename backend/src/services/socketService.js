const { socketAuthMiddleware } = require("../middleware/socketAuthMiddleware");
const ChatService = require("./chatService");

/**
 * Socket.IO service for managing connections, user presence, and real-time features
 */
class SocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // Map of studentId -> Set of socket IDs
    this.userSockets = new Map(); // Map of socket ID -> user data
    this.typingUsers = new Map(); // Map of conversationId -> Set of typing user IDs
    this.chatService = new ChatService();
    this.notificationService = null;
    this.setupMiddleware();
    this.setupConnectionHandlers();
  }

  /**
   * Set the notification service for bidirectional communication
   * @param {Object} notificationService - NotificationService instance
   */
  setNotificationService(notificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Set up Socket.IO middleware
   */
  setupMiddleware() {
    // Authentication middleware
    this.io.use(socketAuthMiddleware);

    // Connection logging middleware
    this.io.use((socket, next) => {
      console.log(`Socket connection attempt from ${socket.handshake.address}`);
      next();
    });
  }

  /**
   * Set up connection event handlers
   */
  setupConnectionHandlers() {
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   * @param {Object} socket - Socket.IO socket instance
   */
  handleConnection(socket) {
    const user = socket.user;
    console.log(
      `User connected: ${user.displayName} (${user.studentId}) - Socket: ${socket.id}`
    );

    // Track user connection
    this.addUserConnection(user.studentId, socket.id, user);

    // Join user-specific room for notifications
    socket.join(`user:${user.studentId}`);

    // Join year/department/section rooms for targeted content
    socket.join(`year:${user.year}`);
    socket.join(`dept:${user.department}`);
    socket.join(`section:${user.section}`);

    // Emit user online status to relevant users
    this.broadcastUserStatus(user.studentId, "online");

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle user presence updates
    socket.on("user_presence", (data) => {
      this.handleUserPresence(socket, data);
    });

    // Handle chat events
    socket.on("join_conversation", (data) => {
      this.handleJoinConversation(socket, data);
    });

    socket.on("leave_conversation", (data) => {
      this.handleLeaveConversation(socket, data);
    });

    socket.on("send_message", (data) => {
      this.handleSendMessage(socket, data);
    });

    socket.on("typing_start", (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on("typing_stop", (data) => {
      this.handleTypingStop(socket, data);
    });

    socket.on("mark_messages_read", (data) => {
      this.handleMarkMessagesRead(socket, data);
    });

    // Emit connection success
    socket.emit("connected", {
      message: "Successfully connected to real-time server",
      user: {
        studentId: user.studentId,
        displayName: user.displayName,
      },
    });
  }

  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket.IO socket instance
   * @param {string} reason - Disconnection reason
   */
  handleDisconnection(socket, reason) {
    const user = this.userSockets.get(socket.id);
    if (!user) return;

    console.log(
      `User disconnected: ${user.displayName} (${user.studentId}) - Reason: ${reason}`
    );

    // Clean up typing indicators
    this.cleanupTypingIndicators(user.studentId);

    // Remove user connection
    this.removeUserConnection(user.studentId, socket.id);

    // If user has no more active connections, broadcast offline status
    if (!this.isUserOnline(user.studentId)) {
      this.broadcastUserStatus(user.studentId, "offline");
    }
  }

  /**
   * Handle user presence updates (typing, active, away, etc.)
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Presence data
   */
  handleUserPresence(socket, data) {
    const user = socket.user;
    const { status, context } = data;

    // Validate presence status
    const validStatuses = ["active", "away", "typing", "stopped_typing"];
    if (!validStatuses.includes(status)) {
      socket.emit("error", { message: "Invalid presence status" });
      return;
    }

    // Broadcast presence update to relevant users
    if (context?.conversationId) {
      // Typing indicators for conversations
      socket
        .to(`conversation:${context.conversationId}`)
        .emit("user_presence", {
          studentId: user.studentId,
          displayName: user.displayName,
          status,
          context,
        });
    } else {
      // General presence updates
      this.broadcastUserStatus(user.studentId, status);
    }
  }

  /**
   * Add user connection to tracking maps
   * @param {string} studentId - Student ID
   * @param {string} socketId - Socket ID
   * @param {Object} userData - User data
   */
  addUserConnection(studentId, socketId, userData) {
    // Add to connected users map
    if (!this.connectedUsers.has(studentId)) {
      this.connectedUsers.set(studentId, new Set());
    }
    this.connectedUsers.get(studentId).add(socketId);

    // Add to user sockets map
    this.userSockets.set(socketId, userData);
  }

  /**
   * Remove user connection from tracking maps
   * @param {string} studentId - Student ID
   * @param {string} socketId - Socket ID
   */
  removeUserConnection(studentId, socketId) {
    // Remove from connected users map
    if (this.connectedUsers.has(studentId)) {
      this.connectedUsers.get(studentId).delete(socketId);
      if (this.connectedUsers.get(studentId).size === 0) {
        this.connectedUsers.delete(studentId);
      }
    }

    // Remove from user sockets map
    this.userSockets.delete(socketId);
  }

  /**
   * Check if user is currently online
   * @param {string} studentId - Student ID
   * @returns {boolean} - True if user has active connections
   */
  isUserOnline(studentId) {
    return (
      this.connectedUsers.has(studentId) &&
      this.connectedUsers.get(studentId).size > 0
    );
  }

  /**
   * Get all online users
   * @returns {Array} - Array of online student IDs
   */
  getOnlineUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * Get user connection count
   * @param {string} studentId - Student ID
   * @returns {number} - Number of active connections for user
   */
  getUserConnectionCount(studentId) {
    return this.connectedUsers.has(studentId)
      ? this.connectedUsers.get(studentId).size
      : 0;
  }

  /**
   * Broadcast user status to relevant users
   * @param {string} studentId - Student ID
   * @param {string} status - Status to broadcast
   */
  broadcastUserStatus(studentId, status) {
    // This could be enhanced to only broadcast to friends/contacts
    // For now, broadcast to all connected users
    this.io.emit("user_status", {
      studentId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send notification to specific user
   * @param {string} studentId - Target student ID
   * @param {Object} notification - Notification data
   */
  sendNotificationToUser(studentId, notification) {
    this.io.to(`user:${studentId}`).emit("notification", {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send notification to multiple users
   * @param {Array} studentIds - Array of target student IDs
   * @param {Object} notification - Notification data
   */
  sendNotificationToUsers(studentIds, notification) {
    studentIds.forEach((studentId) => {
      this.sendNotificationToUser(studentId, notification);
    });
  }

  /**
   * Broadcast to year group
   * @param {number} year - Year number
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcastToYear(year, event, data) {
    this.io.to(`year:${year}`).emit(event, data);
  }

  /**
   * Broadcast to department
   * @param {string} department - Department name
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcastToDepartment(department, event, data) {
    this.io.to(`dept:${department}`).emit(event, data);
  }

  /**
   * Broadcast to section
   * @param {string} section - Section name
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcastToSection(section, event, data) {
    this.io.to(`section:${section}`).emit(event, data);
  }

  /**
   * Get connection statistics
   * @returns {Object} - Connection statistics
   */
  getConnectionStats() {
    return {
      totalConnections: this.userSockets.size,
      uniqueUsers: this.connectedUsers.size,
      onlineUsers: this.getOnlineUsers(),
    };
  }

  // Chat Event Handlers

  /**
   * Handle user joining a conversation
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Join conversation data
   */
  async handleJoinConversation(socket, data) {
    try {
      const { conversationId } = data;
      const user = socket.user;

      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID is required" });
        return;
      }

      // Verify user is participant in conversation
      const conversations = await this.chatService.getUserConversations(
        user.studentId
      );
      const conversation = conversations.conversations.find(
        (conv) => conv._id.toString() === conversationId
      );

      if (!conversation) {
        socket.emit("error", {
          message: "Conversation not found or access denied",
        });
        return;
      }

      // Join conversation room
      socket.join(`conversation:${conversationId}`);

      // Notify other participants that user joined
      socket
        .to(`conversation:${conversationId}`)
        .emit("user_joined_conversation", {
          conversationId,
          user: {
            studentId: user.studentId,
            displayName: user.displayName,
          },
        });

      socket.emit("joined_conversation", { conversationId });
    } catch (error) {
      console.error("Error joining conversation:", error);
      socket.emit("error", { message: "Failed to join conversation" });
    }
  }

  /**
   * Handle user leaving a conversation
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Leave conversation data
   */
  handleLeaveConversation(socket, data) {
    try {
      const { conversationId } = data;
      const user = socket.user;

      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID is required" });
        return;
      }

      // Leave conversation room
      socket.leave(`conversation:${conversationId}`);

      // Stop typing if user was typing
      this.handleTypingStop(socket, { conversationId });

      // Notify other participants that user left
      socket
        .to(`conversation:${conversationId}`)
        .emit("user_left_conversation", {
          conversationId,
          user: {
            studentId: user.studentId,
            displayName: user.displayName,
          },
        });

      socket.emit("left_conversation", { conversationId });
    } catch (error) {
      console.error("Error leaving conversation:", error);
      socket.emit("error", { message: "Failed to leave conversation" });
    }
  }

  /**
   * Handle sending a message
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Message data
   */
  async handleSendMessage(socket, data) {
    try {
      const { conversationId, text, media } = data;
      const user = socket.user;

      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID is required" });
        return;
      }

      if (!text && !media) {
        socket.emit("error", { message: "Message text or media is required" });
        return;
      }

      // Send message using chat service
      const message = await this.chatService.sendMessage(
        conversationId,
        user.studentId,
        { text, media }
      );

      // Stop typing indicator for sender
      this.handleTypingStop(socket, { conversationId });

      // Emit message to all participants in conversation
      this.io.to(`conversation:${conversationId}`).emit("message_received", {
        conversationId,
        message: {
          _id: message._id,
          text: message.text,
          media: message.media,
          senderStudentId: message.senderStudentId,
          createdAt: message.createdAt,
          readBy: message.readBy,
        },
      });

      // Send notifications to offline participants
      if (this.notificationService) {
        // Get conversation participants
        const conversation = await this.chatService.getUserConversations(
          user.studentId
        );
        const targetConversation = conversation.conversations.find(
          (conv) => conv._id.toString() === conversationId
        );

        if (targetConversation) {
          const offlineParticipants = targetConversation.participants.filter(
            (participantId) =>
              participantId !== user.studentId &&
              !this.isUserOnline(participantId)
          );

          if (offlineParticipants.length > 0) {
            await this.notificationService.sendMessageNotification({
              conversationId,
              senderStudentId: user.studentId,
              senderDisplayName: user.displayName,
              messageText: text,
              recipientStudentIds: offlineParticipants,
            });
          }
        }
      }

      // Send confirmation to sender
      socket.emit("message_sent", {
        conversationId,
        messageId: message._id,
        tempId: data.tempId, // Client-side temporary ID for optimistic updates
      });
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", {
        message: "Failed to send message",
        details: error.message,
      });
    }
  }

  /**
   * Handle typing start indicator
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Typing data
   */
  handleTypingStart(socket, data) {
    try {
      const { conversationId } = data;
      const user = socket.user;

      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID is required" });
        return;
      }

      // Add user to typing users for this conversation
      if (!this.typingUsers.has(conversationId)) {
        this.typingUsers.set(conversationId, new Set());
      }
      this.typingUsers.get(conversationId).add(user.studentId);

      // Notify other participants
      socket.to(`conversation:${conversationId}`).emit("user_typing", {
        conversationId,
        user: {
          studentId: user.studentId,
          displayName: user.displayName,
        },
        isTyping: true,
      });
    } catch (error) {
      console.error("Error handling typing start:", error);
    }
  }

  /**
   * Handle typing stop indicator
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Typing data
   */
  handleTypingStop(socket, data) {
    try {
      const { conversationId } = data;
      const user = socket.user;

      if (!conversationId) {
        return; // Silently ignore if no conversation ID
      }

      // Remove user from typing users for this conversation
      if (this.typingUsers.has(conversationId)) {
        this.typingUsers.get(conversationId).delete(user.studentId);

        // Clean up empty sets
        if (this.typingUsers.get(conversationId).size === 0) {
          this.typingUsers.delete(conversationId);
        }
      }

      // Notify other participants
      socket.to(`conversation:${conversationId}`).emit("user_typing", {
        conversationId,
        user: {
          studentId: user.studentId,
          displayName: user.displayName,
        },
        isTyping: false,
      });
    } catch (error) {
      console.error("Error handling typing stop:", error);
    }
  }

  /**
   * Handle marking messages as read
   * @param {Object} socket - Socket.IO socket instance
   * @param {Object} data - Read receipt data
   */
  async handleMarkMessagesRead(socket, data) {
    try {
      const { conversationId, messageIds } = data;
      const user = socket.user;

      if (!conversationId) {
        socket.emit("error", { message: "Conversation ID is required" });
        return;
      }

      // Mark messages as read
      const result = await this.chatService.markMessagesAsRead(
        conversationId,
        user.studentId,
        messageIds
      );

      // Notify other participants about read receipts
      socket.to(`conversation:${conversationId}`).emit("messages_read", {
        conversationId,
        readBy: user.studentId,
        readByUser: {
          studentId: user.studentId,
          displayName: user.displayName,
        },
        messageIds: messageIds || "all",
        timestamp: new Date().toISOString(),
      });

      socket.emit("messages_marked_read", {
        conversationId,
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      socket.emit("error", {
        message: "Failed to mark messages as read",
        details: error.message,
      });
    }
  }

  /**
   * Clean up typing indicators when user disconnects
   * @param {string} studentId - Student ID
   */
  cleanupTypingIndicators(studentId) {
    for (const [conversationId, typingSet] of this.typingUsers.entries()) {
      if (typingSet.has(studentId)) {
        typingSet.delete(studentId);

        // Notify other participants that user stopped typing
        this.io.to(`conversation:${conversationId}`).emit("user_typing", {
          conversationId,
          user: { studentId },
          isTyping: false,
        });

        // Clean up empty sets
        if (typingSet.size === 0) {
          this.typingUsers.delete(conversationId);
        }
      }
    }
  }
}

module.exports = SocketService;
