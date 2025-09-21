const Notification = require("../models/Notification");

/**
 * Notification service for managing notifications and real-time delivery
 */
class NotificationService {
  constructor(socketService = null) {
    this.socketService = socketService;
  }

  /**
   * Set the socket service for real-time notifications
   * @param {Object} socketService - SocketService instance
   */
  setSocketService(socketService) {
    this.socketService = socketService;
  }

  /**
   * Create and send a notification
   * @param {Object} notificationData - Notification data
   * @returns {Object} - Created notification
   */
  async createNotification(notificationData) {
    const {
      toStudentId,
      type,
      meta,
      fromStudentId = null,
      message = null,
    } = notificationData;

    // Create notification in database
    const notification = new Notification({
      toStudentId,
      type,
      title: this.generateNotificationTitle(type, meta),
      message: message || this.generateNotificationMessage(type, meta),
      meta: {
        entityType:
          meta.entityType || this.getEntityTypeFromNotificationType(type),
        entityId:
          meta.entityId || meta.postId || meta.topicId || meta.conversationId,
        fromStudentId,
        ...meta,
      },
      isRead: false,
      createdAt: new Date(),
    });

    await notification.save();

    // Send real-time notification if user is online
    if (this.socketService) {
      this.socketService.sendNotificationToUser(toStudentId, {
        _id: notification._id,
        type: notification.type,
        message: notification.message,
        meta: notification.meta,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  }

  /**
   * Create notifications for multiple users
   * @param {Array} studentIds - Array of student IDs
   * @param {Object} notificationData - Notification data
   * @returns {Array} - Created notifications
   */
  async createNotificationsForUsers(studentIds, notificationData) {
    const notifications = await Promise.all(
      studentIds.map((studentId) =>
        this.createNotification({
          ...notificationData,
          toStudentId: studentId,
        })
      )
    );

    return notifications;
  }

  /**
   * Send notification for post like
   * @param {Object} likeData - Like data
   */
  async sendLikeNotification(likeData) {
    const { postId, postAuthorStudentId, likerStudentId, likerDisplayName } =
      likeData;

    // Don't send notification if user liked their own post
    if (postAuthorStudentId === likerStudentId) {
      return;
    }

    await this.createNotification({
      toStudentId: postAuthorStudentId,
      type: "like",
      fromStudentId: likerStudentId,
      meta: {
        entityId: postId,
        postId,
        fromStudentId: likerStudentId,
        fromDisplayName: likerDisplayName,
      },
    });
  }

  /**
   * Send notification for post comment
   * @param {Object} commentData - Comment data
   */
  async sendCommentNotification(commentData) {
    const {
      postId,
      postAuthorStudentId,
      commenterStudentId,
      commenterDisplayName,
      commentId,
      commentText,
    } = commentData;

    // Don't send notification if user commented on their own post
    if (postAuthorStudentId === commenterStudentId) {
      return;
    }

    await this.createNotification({
      toStudentId: postAuthorStudentId,
      type: "comment",
      fromStudentId: commenterStudentId,
      meta: {
        postId,
        commentId,
        fromStudentId: commenterStudentId,
        fromDisplayName: commenterDisplayName,
        commentText: commentText?.substring(0, 100), // Truncate for preview
      },
    });
  }

  /**
   * Send notification for topic vote
   * @param {Object} voteData - Vote data
   */
  async sendTopicVoteNotification(voteData) {
    const {
      topicId,
      topicAuthorStudentId,
      voterStudentId,
      voterDisplayName,
      voteType, // 'upvote' or 'downvote'
    } = voteData;

    // Don't send notification if user voted on their own topic
    if (topicAuthorStudentId === voterStudentId) {
      return;
    }

    // Only send notifications for upvotes to avoid spam
    if (voteType !== "upvote") {
      return;
    }

    await this.createNotification({
      toStudentId: topicAuthorStudentId,
      type: "topic_vote",
      fromStudentId: voterStudentId,
      meta: {
        topicId,
        fromStudentId: voterStudentId,
        fromDisplayName: voterDisplayName,
        voteType,
      },
    });
  }

  /**
   * Send notification for topic comment
   * @param {Object} commentData - Comment data
   */
  async sendTopicCommentNotification(commentData) {
    const {
      topicId,
      topicAuthorStudentId,
      commenterStudentId,
      commenterDisplayName,
      commentId,
      commentText,
    } = commentData;

    // Don't send notification if user commented on their own topic
    if (topicAuthorStudentId === commenterStudentId) {
      return;
    }

    await this.createNotification({
      toStudentId: topicAuthorStudentId,
      type: "topic_comment",
      fromStudentId: commenterStudentId,
      meta: {
        topicId,
        commentId,
        fromStudentId: commenterStudentId,
        fromDisplayName: commenterDisplayName,
        commentText: commentText?.substring(0, 100), // Truncate for preview
      },
    });
  }

  /**
   * Send notification for new message
   * @param {Object} messageData - Message data
   */
  async sendMessageNotification(messageData) {
    const {
      conversationId,
      senderStudentId,
      senderDisplayName,
      messageText,
      recipientStudentIds,
    } = messageData;

    // Send notification to all recipients except sender
    const recipients = recipientStudentIds.filter(
      (id) => id !== senderStudentId
    );

    await this.createNotificationsForUsers(recipients, {
      type: "message",
      fromStudentId: senderStudentId,
      meta: {
        conversationId,
        fromStudentId: senderStudentId,
        fromDisplayName: senderDisplayName,
        messagePreview: messageText?.substring(0, 100), // Truncate for preview
      },
    });
  }

  /**
   * Send notification for follow/connection request
   * @param {Object} followData - Follow data
   */
  async sendFollowNotification(followData) {
    const { followedStudentId, followerStudentId, followerDisplayName } =
      followData;

    await this.createNotification({
      toStudentId: followedStudentId,
      type: "follow",
      fromStudentId: followerStudentId,
      meta: {
        fromStudentId: followerStudentId,
        fromDisplayName: followerDisplayName,
      },
    });
  }

  /**
   * Get notifications for a user with pagination
   * @param {string} studentId - Student ID
   * @param {Object} options - Pagination options
   * @returns {Object} - Notifications and pagination info
   */
  async getUserNotifications(studentId, options = {}) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const query = { toStudentId: studentId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit + 1) // Get one extra to check if there are more
      .lean();

    const hasMore = notifications.length > limit;
    if (hasMore) {
      notifications.pop(); // Remove the extra notification
    }

    return {
      notifications,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  /**
   * Mark notifications as read
   * @param {string} studentId - Student ID
   * @param {Array} notificationIds - Array of notification IDs (optional)
   * @returns {Object} - Update result
   */
  async markNotificationsAsRead(studentId, notificationIds = null) {
    const query = {
      toStudentId: studentId,
      isRead: false,
    };

    if (notificationIds && notificationIds.length > 0) {
      query._id = { $in: notificationIds };
    }

    const result = await Notification.updateMany(query, {
      isRead: true,
      readAt: new Date(),
    });

    return {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    };
  }

  /**
   * Get unread notification count for a user
   * @param {string} studentId - Student ID
   * @returns {number} - Unread count
   */
  async getUnreadCount(studentId) {
    return await Notification.countDocuments({
      toStudentId: studentId,
      isRead: false,
    });
  }

  /**
   * Delete old notifications (cleanup job)
   * @param {number} daysOld - Days old threshold
   * @returns {Object} - Delete result
   */
  async deleteOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    return {
      deletedCount: result.deletedCount,
    };
  }

  /**
   * Generate notification title based on type and metadata
   * @param {string} type - Notification type
   * @param {Object} meta - Notification metadata
   * @returns {string} - Generated title
   */
  generateNotificationTitle(type, meta) {
    switch (type) {
      case "like":
        return "Post Liked";

      case "comment":
        return "New Comment";

      case "topic_vote":
        return "Topic Upvoted";

      case "topic_comment":
        return "Topic Comment";

      case "message":
        return "New Message";

      case "follow":
        return "New Follower";

      case "system":
        return meta.title || "System Notification";

      default:
        return "Notification";
    }
  }

  /**
   * Get entity type from notification type
   * @param {string} type - Notification type
   * @returns {string} - Entity type
   */
  getEntityTypeFromNotificationType(type) {
    switch (type) {
      case "like":
      case "comment":
        return "Post";

      case "topic_vote":
      case "topic_comment":
        return "Topic";

      case "message":
        return "Message";

      case "follow":
        return "User";

      case "story_view":
        return "Story";

      default:
        return "Post"; // Default fallback
    }
  }

  /**
   * Generate notification message based on type and metadata
   * @param {string} type - Notification type
   * @param {Object} meta - Notification metadata
   * @returns {string} - Generated message
   */
  generateNotificationMessage(type, meta) {
    const { fromDisplayName } = meta;

    switch (type) {
      case "like":
        return `${fromDisplayName} liked your post`;

      case "comment":
        return `${fromDisplayName} commented on your post`;

      case "topic_vote":
        return `${fromDisplayName} upvoted your topic`;

      case "topic_comment":
        return `${fromDisplayName} commented on your topic`;

      case "message":
        return `${fromDisplayName} sent you a message`;

      case "follow":
        return `${fromDisplayName} started following you`;

      case "system":
        return meta.fullMessage || meta.message || "System notification";

      default:
        return `${fromDisplayName} interacted with your content`;
    }
  }

  /**
   * Send bulk notifications for system announcements
   * @param {Array} studentIds - Array of student IDs
   * @param {Object} announcementData - Announcement data
   * @returns {Array} - Created notifications
   */
  async sendSystemAnnouncement(studentIds, announcementData) {
    const { title, message, meta = {} } = announcementData;

    const notifications = await this.createNotificationsForUsers(studentIds, {
      type: "system",
      message: title,
      meta: {
        ...meta,
        fullMessage: message,
        isSystemAnnouncement: true,
      },
    });

    return notifications;
  }

  /**
   * Send notifications to users in specific groups (year, department, section)
   * @param {Object} targetGroup - Target group criteria
   * @param {Object} notificationData - Notification data
   * @returns {Array} - Created notifications
   */
  async sendGroupNotification(targetGroup, notificationData) {
    const { year, department, section } = targetGroup;

    // This would require User model to find matching users
    // For now, return empty array as this would be implemented
    // when integrating with the User service
    return [];
  }
}

module.exports = NotificationService;
