const Notification = require("../../src/models/Notification");
const mongoose = require("mongoose");

describe("Notification Model", () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validNotificationData = {
      toStudentId: "2025CS1001",
      type: "like",
      title: "New Like",
      message: "John Doe liked your post",
      meta: {
        entityType: "Post",
        entityId: new mongoose.Types.ObjectId(),
        fromStudentId: "2025CS1002",
        fromUserName: "John Doe",
        postId: new mongoose.Types.ObjectId(),
      },
    };

    const validSystemNotificationData = {
      toStudentId: "2025CS1001",
      type: "system",
      title: "System Update",
      message: "The system will be under maintenance tonight",
      meta: {
        additionalData: { maintenanceWindow: "2024-01-15 02:00-04:00" },
      },
    };

    test("should create a valid notification", async () => {
      const notification = new Notification(validNotificationData);
      const savedNotification = await notification.save();

      expect(savedNotification._id).toBeDefined();
      expect(savedNotification.toStudentId).toBe("2025CS1001");
      expect(savedNotification.type).toBe("like");
      expect(savedNotification.title).toBe("New Like");
      expect(savedNotification.message).toBe("John Doe liked your post");
      expect(savedNotification.meta.fromStudentId).toBe("2025CS1002");
      expect(savedNotification.meta.fromUserName).toBe("John Doe");
      expect(savedNotification.isRead).toBe(false);
      expect(savedNotification.priority).toBe("normal");
      expect(savedNotification.deliveryMethod).toBe("in_app");
      expect(savedNotification.isActive).toBe(true);
      expect(savedNotification.createdAt).toBeDefined();
      expect(savedNotification.expiresAt).toBeDefined();
    });

    test("should create a valid system notification", async () => {
      const notification = new Notification(validSystemNotificationData);
      const savedNotification = await notification.save();

      expect(savedNotification.type).toBe("system");
      expect(savedNotification.title).toBe("System Update");
      expect(savedNotification.meta.additionalData.maintenanceWindow).toBe(
        "2024-01-15 02:00-04:00"
      );
    });

    test("should require toStudentId", async () => {
      const notificationData = { ...validNotificationData };
      delete notificationData.toStudentId;

      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(
        "Recipient student ID is required"
      );
    });

    test("should validate toStudentId format", async () => {
      const invalidIds = ["invalid", "2025CS", "CS1001", "25CS1001"];

      for (const invalidId of invalidIds) {
        const notification = new Notification({
          ...validNotificationData,
          toStudentId: invalidId,
        });
        await expect(notification.save()).rejects.toThrow(
          "Recipient student ID must follow format"
        );
      }
    });

    test("should require type", async () => {
      const notificationData = { ...validNotificationData };
      delete notificationData.type;

      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(
        "Notification type is required"
      );
    });

    test("should validate type enum", async () => {
      const notification = new Notification({
        ...validNotificationData,
        type: "invalid",
      });
      await expect(notification.save()).rejects.toThrow(
        "Notification type must be one of"
      );
    });

    test("should require title", async () => {
      const notificationData = { ...validNotificationData };
      delete notificationData.title;

      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(
        "Notification title is required"
      );
    });

    test("should validate title length", async () => {
      const notification = new Notification({
        ...validNotificationData,
        title: "A".repeat(101),
      });
      await expect(notification.save()).rejects.toThrow(
        "Notification title cannot exceed 100 characters"
      );
    });

    test("should require message", async () => {
      const notificationData = { ...validNotificationData };
      delete notificationData.message;

      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(
        "Notification message is required"
      );
    });

    test("should validate message length", async () => {
      const notification = new Notification({
        ...validNotificationData,
        message: "A".repeat(501),
      });
      await expect(notification.save()).rejects.toThrow(
        "Notification message cannot exceed 500 characters"
      );
    });

    test("should validate priority enum", async () => {
      const notification = new Notification({
        ...validNotificationData,
        priority: "invalid",
      });
      await expect(notification.save()).rejects.toThrow(
        "Priority must be one of"
      );
    });

    test("should validate deliveryMethod enum", async () => {
      const notification = new Notification({
        ...validNotificationData,
        deliveryMethod: "invalid",
      });
      await expect(notification.save()).rejects.toThrow(
        "Delivery method must be one of"
      );
    });

    test("should validate fromStudentId format", async () => {
      const notification = new Notification({
        ...validNotificationData,
        meta: {
          ...validNotificationData.meta,
          fromStudentId: "invalid-id",
        },
      });
      await expect(notification.save()).rejects.toThrow(
        "From student ID must follow format"
      );
    });

    test("should validate fromUserName length", async () => {
      const notification = new Notification({
        ...validNotificationData,
        meta: {
          ...validNotificationData.meta,
          fromUserName: "A".repeat(51),
        },
      });
      await expect(notification.save()).rejects.toThrow(
        "From user name cannot exceed 50 characters"
      );
    });

    test("should require entityType and entityId for non-system notifications", async () => {
      const notificationData = {
        ...validNotificationData,
        meta: {
          fromStudentId: "2025CS1002",
          fromUserName: "John Doe",
        },
      };

      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(
        "Non-system notifications must have entityType and entityId"
      );
    });

    test("should not allow fromStudentId for system notifications", async () => {
      const notification = new Notification({
        ...validSystemNotificationData,
        meta: {
          ...validSystemNotificationData.meta,
          fromStudentId: "2025CS1002",
        },
      });
      await expect(notification.save()).rejects.toThrow(
        "System notifications cannot have fromStudentId"
      );
    });

    test("should set default expiration time", async () => {
      const notification = new Notification(validNotificationData);
      const savedNotification = await notification.save();

      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(
        savedNotification.expiresAt.getTime() - expectedExpiry.getTime()
      );

      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    test("should trim title, message, and meta fields", async () => {
      const notification = new Notification({
        ...validNotificationData,
        title: "  Trimmed Title  ",
        message: "  Trimmed message  ",
        meta: {
          ...validNotificationData.meta,
          fromUserName: "  John Doe  ",
        },
      });
      const savedNotification = await notification.save();

      expect(savedNotification.title).toBe("Trimmed Title");
      expect(savedNotification.message).toBe("Trimmed message");
      expect(savedNotification.meta.fromUserName).toBe("John Doe");
    });
  });

  describe("Instance Methods", () => {
    let notification;

    beforeEach(async () => {
      notification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "John Doe liked your post",
        meta: {
          entityType: "Post",
          entityId: new mongoose.Types.ObjectId(),
          fromStudentId: "2025CS1002",
          fromUserName: "John Doe",
        },
      });
      await notification.save();
    });

    test("should mark notification as read", async () => {
      await notification.markAsRead();

      expect(notification.isRead).toBe(true);
      expect(notification.readAt).toBeDefined();
    });

    test("should mark notification as unread", async () => {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      await notification.markAsUnread();
      expect(notification.isRead).toBe(false);
      expect(notification.readAt).toBeNull();
    });

    test("should mark as delivered for in-app", async () => {
      await notification.markAsDelivered("in_app");

      expect(notification.deliveryStatus.inApp.delivered).toBe(true);
      expect(notification.deliveryStatus.inApp.deliveredAt).toBeDefined();
    });

    test("should mark as delivered for push with metadata", async () => {
      await notification.markAsDelivered("push", { fcmMessageId: "fcm-123" });

      expect(notification.deliveryStatus.push.delivered).toBe(true);
      expect(notification.deliveryStatus.push.deliveredAt).toBeDefined();
      expect(notification.deliveryStatus.push.fcmMessageId).toBe("fcm-123");
    });

    test("should mark as delivered for email with metadata", async () => {
      await notification.markAsDelivered("email", { emailId: "email-456" });

      expect(notification.deliveryStatus.email.delivered).toBe(true);
      expect(notification.deliveryStatus.email.deliveredAt).toBeDefined();
      expect(notification.deliveryStatus.email.emailId).toBe("email-456");
    });

    test("should update priority", async () => {
      await notification.updatePriority("high");
      expect(notification.priority).toBe("high");
    });

    test("should extend expiration", async () => {
      const originalExpiry = notification.expiresAt;
      await notification.extendExpiration(7);

      const expectedExpiry = new Date(
        originalExpiry.getTime() + 7 * 24 * 60 * 60 * 1000
      );
      expect(notification.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });

    test("should mark as inactive", async () => {
      await notification.markAsInactive();
      expect(notification.isActive).toBe(false);
    });

    test("should check if should send push", () => {
      notification.deliveryMethod = "push";
      expect(notification.shouldSendPush()).toBe(true);

      notification.deliveryStatus.push.delivered = true;
      expect(notification.shouldSendPush()).toBe(false);
    });

    test("should check if should send email", () => {
      notification.deliveryMethod = "email";
      expect(notification.shouldSendEmail()).toBe(true);

      notification.deliveryStatus.email.delivered = true;
      expect(notification.shouldSendEmail()).toBe(false);
    });
  });

  describe("Virtuals", () => {
    test("should check if notification is expired", async () => {
      const notification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "Test",
        message: "Test message",
        meta: {
          entityType: "Post",
          entityId: new mongoose.Types.ObjectId(),
        },
      });

      expect(notification.isExpired).toBe(false);

      notification.expiresAt = new Date(Date.now() - 1000);
      expect(notification.isExpired).toBe(true);
    });

    test("should calculate time remaining", async () => {
      const notification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "Test",
        message: "Test message",
        meta: {
          entityType: "Post",
          entityId: new mongoose.Types.ObjectId(),
        },
      });

      const timeRemaining = notification.timeRemaining;
      expect(timeRemaining).toBeGreaterThan(0);
      expect(timeRemaining).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000); // Less than or equal to 30 days
    });

    test("should check delivery status", async () => {
      const notification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "Test",
        message: "Test message",
        meta: {
          entityType: "Post",
          entityId: new mongoose.Types.ObjectId(),
        },
        deliveryMethod: "in_app",
      });

      expect(notification.isDelivered).toBe(false);

      notification.deliveryStatus.inApp.delivered = true;
      expect(notification.isDelivered).toBe(true);
    });

    test("should get display message with user context", async () => {
      const notification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "Test",
        message: "{userName} liked your post",
        meta: {
          entityType: "Post",
          entityId: new mongoose.Types.ObjectId(),
          fromUserName: "John Doe",
        },
      });

      expect(notification.displayMessage).toBe("John Doe liked your post");
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const notifications = [
        {
          toStudentId: "2025CS1001",
          type: "like",
          title: "Like 1",
          message: "Someone liked your post",
          meta: {
            entityType: "Post",
            entityId: new mongoose.Types.ObjectId(),
            fromStudentId: "2025CS1002",
          },
          isRead: false,
          priority: "normal",
        },
        {
          toStudentId: "2025CS1001",
          type: "comment",
          title: "Comment 1",
          message: "Someone commented on your post",
          meta: {
            entityType: "Comment",
            entityId: new mongoose.Types.ObjectId(),
            fromStudentId: "2025ECE1001",
          },
          isRead: true,
          priority: "high",
        },
        {
          toStudentId: "2025ECE1001",
          type: "message",
          title: "Message 1",
          message: "You have a new message",
          meta: {
            entityType: "Message",
            entityId: new mongoose.Types.ObjectId(),
            fromStudentId: "2025CS1001",
          },
          isRead: false,
          priority: "high",
        },
        {
          toStudentId: "2025CS1001",
          type: "system",
          title: "System Update",
          message: "System maintenance scheduled",
          meta: {},
          isActive: false,
        },
      ];

      await Notification.insertMany(notifications);
    });

    test("should find notifications by user", async () => {
      const notifications = await Notification.findByUser("2025CS1001");
      expect(notifications).toHaveLength(2); // Only active notifications

      const notificationTypes = notifications.map((n) => n.type);
      expect(notificationTypes).toContain("like");
      expect(notificationTypes).toContain("comment");
      expect(notificationTypes).not.toContain("system"); // Inactive
    });

    test("should find unread notifications by user", async () => {
      const notifications = await Notification.findUnreadByUser("2025CS1001");
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("like");
      expect(notifications[0].isRead).toBe(false);
    });

    test("should find notifications by type", async () => {
      const notifications = await Notification.findByType("like");
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("like");
    });

    test("should find pending delivery notifications", async () => {
      const notifications = await Notification.findPendingDelivery("push");
      expect(notifications.length).toBeGreaterThanOrEqual(0);

      // All should be active and not expired
      notifications.forEach((notification) => {
        expect(notification.isActive).toBe(true);
        expect(notification.expiresAt.getTime()).toBeGreaterThan(Date.now());
      });
    });

    test("should mark all as read", async () => {
      const result = await Notification.markAllAsRead("2025CS1001");
      expect(result.modifiedCount).toBeGreaterThan(0);

      const unreadCount = await Notification.getUnreadCount("2025CS1001");
      expect(unreadCount).toBe(0);
    });

    test("should get unread count", async () => {
      const count = await Notification.getUnreadCount("2025CS1001");
      expect(count).toBe(1); // One unread notification
    });

    test("should cleanup expired notifications", async () => {
      // Create an expired notification
      await Notification.create({
        toStudentId: "2025CS1001",
        type: "like",
        title: "Expired",
        message: "This is expired",
        meta: {
          entityType: "Post",
          entityId: new mongoose.Types.ObjectId(),
        },
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await Notification.cleanupExpired();
      expect(result.deletedCount).toBe(1);
    });

    test("should create like notification", async () => {
      const notification = await Notification.createLikeNotification(
        "2025CS1001",
        "2025CS1002",
        "John Doe",
        new mongoose.Types.ObjectId()
      );

      expect(notification.type).toBe("like");
      expect(notification.title).toBe("New Like");
      expect(notification.message).toBe("{userName} liked your post");
      expect(notification.meta.fromUserName).toBe("John Doe");
      expect(notification.priority).toBe("normal");
      expect(notification.deliveryMethod).toBe("all");
    });

    test("should create comment notification", async () => {
      const notification = await Notification.createCommentNotification(
        "2025CS1001",
        "2025CS1002",
        "John Doe",
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      );

      expect(notification.type).toBe("comment");
      expect(notification.title).toBe("New Comment");
      expect(notification.priority).toBe("high");
    });

    test("should create message notification", async () => {
      const notification = await Notification.createMessageNotification(
        "2025CS1001",
        "2025CS1002",
        "John Doe",
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      );

      expect(notification.type).toBe("message");
      expect(notification.title).toBe("New Message");
      expect(notification.priority).toBe("high");
    });

    test("should create topic notification", async () => {
      const notification = await Notification.createTopicNotification(
        "2025CS1001",
        "2025CS1002",
        "John Doe",
        new mongoose.Types.ObjectId(),
        "commented"
      );

      expect(notification.type).toBe("topic");
      expect(notification.title).toBe("Topic Activity");
      expect(notification.message).toBe(
        "{userName} commented on a topic you follow"
      );
      expect(notification.meta.additionalData.action).toBe("commented");
    });

    test("should create system notification", async () => {
      const notification = await Notification.createSystemNotification(
        "2025CS1001",
        "Maintenance",
        "System will be down for maintenance",
        { duration: "2 hours" }
      );

      expect(notification.type).toBe("system");
      expect(notification.title).toBe("Maintenance");
      expect(notification.meta.additionalData.duration).toBe("2 hours");
    });

    test("should get notification stats", async () => {
      const stats = await Notification.getNotificationStats("2025CS1001");
      expect(stats.length).toBeGreaterThan(0);

      const likeStats = stats.find((s) => s._id === "like");
      const commentStats = stats.find((s) => s._id === "comment");

      expect(likeStats.total).toBe(1);
      expect(likeStats.unread).toBe(1);
      expect(commentStats.total).toBe(1);
      expect(commentStats.unread).toBe(0);
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Notification.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames.some((name) => name.includes("toStudentId_1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("type_1"))).toBe(true);
      expect(indexNames.some((name) => name.includes("priority_1"))).toBe(true);
      expect(indexNames.some((name) => name.includes("expiresAt_1"))).toBe(
        true
      );
    });
  });
});
