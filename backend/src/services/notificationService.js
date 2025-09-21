const Notification = require("../models/Notification");
const fcmService = require("./fcmService");
const User = require("../models/User");

/**
 * Notification service for managing notifications and real-time delivery
 */
class NotificationService {
  constructor(socketService = null) {
    this.socketService = socketService;
    this.fcmService = fcmService;
    this.rateLimitConfig = {
      maxNotificationsPerUser: 50, // Max notifications per user per hour
      maxBatchSize: 100, // Max users to notify in one batch
      cooldownPeriod: 60 * 1000, // 1 minute cooldown between batches
    };
    this.lastBatchTime = new Map(); // Track last batch time per notification type
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

    // Check user notification preferences
    const userPreferences = await this.getUserNotificationPreferences(
      toStudentId
    );
    if (!userPreferences.enabled || !userPreferences.types[type]) {
      console.log(
        `Notification skipped for user ${toStudentId} due to preferences`
      );
      return null;
    }

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

    // Try to send real-time notification first
    let sentRealtime = false;
    if (this.socketService) {
      sentRealtime = this.socketService.sendNotificationToUser(toStudentId, {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        meta: notification.meta,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });
    }

    // If user is offline or real-time failed, send push notification
    if (!sentRealtime && userPreferences.pushEnabled) {
      try {
        await this.fcmService.sendNotificationToUser(
          toStudentId,
          {
            title: notification.title,
            body: notification.message,
          },
          {
            type: notification.type,
            notificationId: notification._id.toString(),
            entityType: notification.meta.entityType,
            entityId: notification.meta.entityId
              ? notification.meta.entityId.toString()
              : undefined,
            fromStudentId: notification.meta.fromStudentId,
          }
        );
      } catch (error) {
        console.error(
          `Failed to send push notification to ${toStudentId}:`,
          error.message
        );
      }
    }

    return notification;
  }

  /**
   * Create notifications for multiple users with batching and rate limiting
   * @param {Array} studentIds - Array of student IDs
   * @param {Object} notificationData - Notification data
   * @returns {Array} - Created notifications
   */
  async createNotificationsForUsers(studentIds, notificationData) {
    if (!studentIds || studentIds.length === 0) {
      return [];
    }

    // Apply rate limiting for batch notifications
    const batchKey = `${notificationData.type}_batch`;
    if (this.shouldRateLimit(batchKey, studentIds.length)) {
      console.log(
        `Rate limiting applied for notification type: ${notificationData.type}`
      );
      return [];
    }

    // Process in batches to avoid overwhelming the system
    const batchSize = Math.min(
      this.rateLimitConfig.maxBatchSize,
      studentIds.length
    );
    const batches = [];

    for (let i = 0; i < studentIds.length; i += batchSize) {
      batches.push(studentIds.slice(i, i + batchSize));
    }

    const allNotifications = [];

    for (const batch of batches) {
      // Get user preferences for the batch
      const usersWithPreferences = await this.getBatchUserPreferences(
        batch,
        notificationData.type
      );

      // Filter users who want to receive this notification
      const eligibleUsers = usersWithPreferences.filter(
        (user) =>
          user.preferences.enabled &&
          user.preferences.types[notificationData.type]
      );

      if (eligibleUsers.length === 0) {
        continue;
      }

      // Create notifications for eligible users
      const batchNotifications = await Promise.all(
        eligibleUsers.map(async (user) => {
          const notification = new Notification({
            toStudentId: user.studentId,
            type: notificationData.type,
            title: this.generateNotificationTitle(
              notificationData.type,
              notificationData.meta
            ),
            message:
              notificationData.message ||
              this.generateNotificationMessage(
                notificationData.type,
                notificationData.meta
              ),
            meta: {
              entityType:
                notificationData.meta.entityType ||
                this.getEntityTypeFromNotificationType(notificationData.type),
              entityId:
                notificationData.meta.entityId ||
                notificationData.meta.postId ||
                notificationData.meta.topicId ||
                notificationData.meta.conversationId,
              fromStudentId: notificationData.fromStudentId,
              ...notificationData.meta,
            },
            isRead: false,
            createdAt: new Date(),
          });

          await notification.save();
          return notification;
        })
      );

      allNotifications.push(...batchNotifications);

      // Send real-time notifications to online users
      const onlineUsers = [];
      const offlineUsers = [];

      if (this.socketService) {
        for (const user of eligibleUsers) {
          const notification = batchNotifications.find(
            (n) => n.toStudentId === user.studentId
          );
          const sentRealtime = this.socketService.sendNotificationToUser(
            user.studentId,
            {
              _id: notification._id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              meta: notification.meta,
              isRead: notification.isRead,
              createdAt: notification.createdAt,
            }
          );

          if (sentRealtime) {
            onlineUsers.push(user);
          } else if (user.preferences.pushEnabled) {
            offlineUsers.push(user);
          }
        }
      } else {
        // If no socket service, treat all as offline
        offlineUsers.push(
          ...eligibleUsers.filter((user) => user.preferences.pushEnabled)
        );
      }

      // Send push notifications to offline users
      if (offlineUsers.length > 0) {
        try {
          const offlineStudentIds = offlineUsers.map((user) => user.studentId);
          await this.fcmService.sendNotificationToUsers(
            offlineStudentIds,
            {
              title: this.generateNotificationTitle(
                notificationData.type,
                notificationData.meta
              ),
              body:
                notificationData.message ||
                this.generateNotificationMessage(
                  notificationData.type,
                  notificationData.meta
                ),
            },
            {
              type: notificationData.type,
              entityType:
                notificationData.meta.entityType ||
                this.getEntityTypeFromNotificationType(notificationData.type),
              entityId: notificationData.meta.entityId
                ? notificationData.meta.entityId.toString()
                : undefined,
              fromStudentId: notificationData.fromStudentId,
            }
          );
        } catch (error) {
          console.error(
            `Failed to send batch push notifications:`,
            error.message
          );
        }
      }

      // Add cooldown between batches
      if (batches.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms between batches
      }
    }

    // Update rate limiting tracker
    this.lastBatchTime.set(batchKey, Date.now());

    return allNotifications;
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

    try {
      // Build query based on target group
      const query = {};
      if (year) query.year = year;
      if (department) query.department = department;
      if (section) query.section = section;

      // Find matching users
      const users = await User.find(query).select("studentId").lean();
      const studentIds = users.map((user) => user.studentId);

      if (studentIds.length === 0) {
        return [];
      }

      return await this.createNotificationsForUsers(
        studentIds,
        notificationData
      );
    } catch (error) {
      console.error("Error sending group notification:", error);
      return [];
    }
  }

  /**
   * Get user notification preferences
   * @param {string} studentId - Student ID
   * @returns {Object} - User preferences
   */
  async getUserNotificationPreferences(studentId) {
    try {
      const user = await User.findOne({ studentId }).select("settings").lean();

      if (!user || !user.settings) {
        return this.getDefaultNotificationPreferences();
      }

      return {
        enabled: user.settings.notifications !== false,
        pushEnabled: user.settings.pushNotifications !== false,
        types: {
          like: user.settings.notificationTypes?.like !== false,
          comment: user.settings.notificationTypes?.comment !== false,
          topic_vote: user.settings.notificationTypes?.topic_vote !== false,
          topic_comment:
            user.settings.notificationTypes?.topic_comment !== false,
          message: user.settings.notificationTypes?.message !== false,
          follow: user.settings.notificationTypes?.follow !== false,
          system: user.settings.notificationTypes?.system !== false,
        },
      };
    } catch (error) {
      console.error(
        `Error getting notification preferences for ${studentId}:`,
        error
      );
      return this.getDefaultNotificationPreferences();
    }
  }

  /**
   * Get batch user preferences for multiple users
   * @param {Array} studentIds - Array of student IDs
   * @param {string} notificationType - Type of notification
   * @returns {Array} - Array of users with preferences
   */
  async getBatchUserPreferences(studentIds, notificationType) {
    try {
      const users = await User.find({
        studentId: { $in: studentIds },
      })
        .select("studentId settings")
        .lean();

      return users.map((user) => ({
        studentId: user.studentId,
        preferences: {
          enabled: user.settings?.notifications !== false,
          pushEnabled: user.settings?.pushNotifications !== false,
          types: {
            [notificationType]:
              user.settings?.notificationTypes?.[notificationType] !== false,
            like: user.settings?.notificationTypes?.like !== false,
            comment: user.settings?.notificationTypes?.comment !== false,
            topic_vote: user.settings?.notificationTypes?.topic_vote !== false,
            topic_comment:
              user.settings?.notificationTypes?.topic_comment !== false,
            message: user.settings?.notificationTypes?.message !== false,
            follow: user.settings?.notificationTypes?.follow !== false,
            system: user.settings?.notificationTypes?.system !== false,
          },
        },
      }));
    } catch (error) {
      console.error("Error getting batch user preferences:", error);
      // Return default preferences for all users
      return studentIds.map((studentId) => ({
        studentId,
        preferences: this.getDefaultNotificationPreferences(),
      }));
    }
  }

  /**
   * Get default notification preferences
   * @returns {Object} - Default preferences
   */
  getDefaultNotificationPreferences() {
    return {
      enabled: true,
      pushEnabled: true,
      types: {
        like: true,
        comment: true,
        topic_vote: true,
        topic_comment: true,
        message: true,
        follow: true,
        system: true,
      },
    };
  }

  /**
   * Check if notification should be rate limited
   * @param {string} batchKey - Batch key for rate limiting
   * @param {number} userCount - Number of users to notify
   * @returns {boolean} - Whether to rate limit
   */
  shouldRateLimit(batchKey, userCount) {
    const lastTime = this.lastBatchTime.get(batchKey);
    const now = Date.now();

    // Check cooldown period
    if (lastTime && now - lastTime < this.rateLimitConfig.cooldownPeriod) {
      return true;
    }

    // Check batch size limit
    if (userCount > this.rateLimitConfig.maxNotificationsPerUser) {
      return true;
    }

    return false;
  }

  /**
   * Update user notification preferences
   * @param {string} studentId - Student ID
   * @param {Object} preferences - New preferences
   * @returns {Object} - Update result
   */
  async updateUserNotificationPreferences(studentId, preferences) {
    try {
      const updateData = {
        "settings.notifications": preferences.enabled,
        "settings.pushNotifications": preferences.pushEnabled,
      };

      if (preferences.types) {
        Object.keys(preferences.types).forEach((type) => {
          updateData[`settings.notificationTypes.${type}`] =
            preferences.types[type];
        });
      }

      const result = await User.updateOne({ studentId }, { $set: updateData });

      return {
        success: result.modifiedCount > 0,
        modifiedCount: result.modifiedCount,
      };
    } catch (error) {
      console.error(
        `Error updating notification preferences for ${studentId}:`,
        error
      );
      throw new Error(
        `Failed to update notification preferences: ${error.message}`
      );
    }
  }

  /**
   * Register FCM token for a user
   * @param {string} studentId - Student ID
   * @param {string} fcmToken - FCM token
   * @returns {Object} - Registration result
   */
  async registerFCMToken(studentId, fcmToken) {
    try {
      return await this.fcmService.registerToken(studentId, fcmToken);
    } catch (error) {
      console.error(`Error registering FCM token for ${studentId}:`, error);
      throw new Error(`Failed to register FCM token: ${error.message}`);
    }
  }

  /**
   * Unregister FCM token for a user
   * @param {string} studentId - Student ID
   * @param {string} fcmToken - FCM token
   * @returns {Object} - Unregistration result
   */
  async unregisterFCMToken(studentId, fcmToken) {
    try {
      return await this.fcmService.unregisterToken(studentId, fcmToken);
    } catch (error) {
      console.error(`Error unregistering FCM token for ${studentId}:`, error);
      throw new Error(`Failed to unregister FCM token: ${error.message}`);
    }
  }
}

module.exports = NotificationService;
