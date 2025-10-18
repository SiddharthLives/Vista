const Notification = require("../../src/models/Notification");

describe("Notification Model", () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validNotificationData = {
      toStudentId: "2025CS1001",
      type: "like",
      title: "New Like",
      message: "Someone liked your post",
      meta: {
        fromStudentId: "2025CS1002",
        entityType: "Post",
        entityId: "507f1f77bcf86cd799439011",
      },
    };

    test("should create a valid notification", async () => {
      const notification = new Notification(validNotificationData);
      const savedNotification = await notification.save();

      expect(savedNotification._id).toBeDefined();
      expect(savedNotification.toStudentId).toBe("2025CS1001");
      expect(savedNotification.type).toBe("like");
      expect(savedNotification.title).toBe("New Like");
      expect(savedNotification.message).toBe("Someone liked your post");
      expect(savedNotification.priority).toBe("normal");
      expect(savedNotification.deliveryMethod).toBe("in_app");
      expect(savedNotification.isRead).toBe(false);
      expect(savedNotification.isActive).toBe(true);
      expect(savedNotification.createdAt).toBeDefined();
      expect(savedNotification.expiresAt).toBeDefined();
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

    test("should require notification type", async () => {
      const notificationData = { ...validNotificationData };
      delete notificationData.type;

      const notification = new Notification(notificationData);
      await expect(notification.save()).rejects.toThrow(
        "Notification type is required"
      );
    });

    test("should validate notification type enum", async () => {
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
        title: "A".repeat(201),
      });
      await expect(notification.save()).rejects.toThrow(
        "Title cannot exceed 200 characters"
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
        "Message cannot exceed 500 characters"
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

    test("should validate delivery method enum", async () => {
      const notification = new Notification({
        ...validNotificationData,
        deliveryMethod: "invalid",
      });
      await expect(notification.save()).rejects.toThrow(
        "Delivery method must be one of"
      );
    });

    test("should validate fromStudentId format in meta", async () => {
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

    test("should validate entityId format in meta", async () => {
      const notification = new Notification({
        ...validNotificationData,
        meta: {
          ...validNotificationData.meta,
          entityId: "invalid-id",
        },
      });
      await expect(notification.save()).rejects.toThrow(
        "Entity ID must be a valid ObjectId"
      );
    });

    test("should set default expiration time", async () => {
      const notification = new Notification(validNotificationData);
      const savedNotification = await notification.save();

      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const timeDiff = Math.abs(
        savedNotification.expiresAt.getTime() - expectedExpiry.getTime()
      );

      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    test("should trim title and message", async () => {
      const notification = new Notification({
        ...validNotificationData,
        title: "  Trimmed Title  ",
        message: "  Trimmed Message  ",
      });
      const savedNotification = await notification.save();

      expect(savedNotification.title).toBe("Trimmed Title");
      expect(savedNotification.message).toBe("Trimmed Message");
    });
  });

  describe("Instance Methods", () => {
    let notification;

    beforeEach(async () => {
      notification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "Someone liked your post",
        meta: {
          fromStudentId: "2025CS1002",
          entityType: "Post",
          entityId: "507f1f77bcf86cd799439011",
        },
      });
      await notification.save();
    });

    test("should mark as read", async () => {
      await notification.markAsRead();

      expect(notification.isRead).toBe(true);
      expect(notification.readAt).toBeDefined();
    });

    test("should mark as unread", async () => {
      await notification.markAsRead();
      await notification.markAsUnread();

      expect(notification.isRead).toBe(false);
      expect(notification.readAt).toBeNull();
    });

    test("should update delivery status", async () => {
      await notification.updateDeliveryStatus("push", {
        delivered: true,
        fcmMessageId: "msg-123",
      });

      expect(notification.deliveryStatus.push.delivered).toBe(true);
      expect(notification.deliveryStatus.push.fcmMessageId).toBe("msg-123");
      expect(notification.deliveryStatus.push.deliveredAt).toBeDefined();
    });

    test("should mark as inactive", async () => {
      await notification.markAsInactive();
      expect(notification.isActive).toBe(false);
    });

    test("should check if notification is urgent", () => {
      notification.priority = "high";
      expect(notification.isUrgent()).toBe(true);

      notification.priority = "normal";
      expect(notification.isUrgent()).toBe(false);
    });

    test("should check if notification is for specific entity", () => {
      expect(notification.isForEntity("Post", "507f1f77bcf86cd799439011")).toBe(
        true
      );
      expect(
        notification.isForEntity("Topic", "507f1f77bcf86cd799439011")
      ).toBe(false);
      expect(notification.isForEntity("Post", "507f1f77bcf86cd799439012")).toBe(
        false
      );
    });

    test("should get sender information", () => {
      const senderInfo = notification.getSenderInfo();
      expect(senderInfo.studentId).toBe("2025CS1002");
      expect(senderInfo.entityType).toBe("Post");
      expect(senderInfo.entityId.toString()).toBe("507f1f77bcf86cd799439011");
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const notifications = [
        {
          toStudentId: "2025CS1001",
          type: "like",
          title: "New Like",
          message: "Someone liked your post",
          meta: { fromStudentId: "2025CS1002" },
          createdAt: new Date(Date.now() - 1000),
        },
        {
          toStudentId: "2025CS1001",
          type: "comment",
          title: "New Comment",
          message: "Someone commented on your post",
          meta: { fromStudentId: "2025CS1003" },
          isRead: true,
          createdAt: new Date(Date.now() - 2000),
        },
        {
          toStudentId: "2025CS1002",
          type: "follow",
          title: "New Follower",
          message: "Someone started following you",
          meta: { fromStudentId: "2025CS1001" },
          createdAt: new Date(Date.now() - 3000),
        },
        {
          toStudentId: "2025CS1001",
          type: "like",
          title: "Inactive Like",
          message: "Inactive notification",
          meta: { fromStudentId: "2025CS1004" },
          isActive: false,
        },
      ];

      await Notification.insertMany(notifications);
    });

    test("should find notifications for user", async () => {
      const notifications = await Notification.findForUser("2025CS1001");
      expect(notifications).toHaveLength(2); // Only active notifications
      expect(notifications[0].type).toBe("like"); // Newest first
      expect(notifications[1].type).toBe("comment");
    });

    test("should find unread notifications for user", async () => {
      const notifications = await Notification.findUnreadForUser("2025CS1001");
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("like");
    });

    test("should get notification count for user", async () => {
      const count = await Notification.getUnreadCount("2025CS1001");
      expect(count).toBe(1);
    });

    test("should find notifications by type", async () => {
      const notifications = await Notification.findByType("like");
      expect(notifications).toHaveLength(1); // Only active notifications
    });

    test("should find notifications by sender", async () => {
      const notifications = await Notification.findBySender("2025CS1002");
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("like");
    });

    test("should mark all as read for user", async () => {
      const result = await Notification.markAllAsReadForUser("2025CS1001");
      expect(result.modifiedCount).toBe(1); // Only unread notifications

      const unreadCount = await Notification.getUnreadCount("2025CS1001");
      expect(unreadCount).toBe(0);
    });

    test("should cleanup expired notifications", async () => {
      // Create expired notification
      const expiredNotification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "Expired",
        message: "Expired notification",
        expiresAt: new Date(Date.now() - 1000),
      });
      await expiredNotification.save();

      const deletedCount = await Notification.cleanupExpired();
      expect(deletedCount.deletedCount).toBe(1);
    });

    test("should get notification stats", async () => {
      const stats = await Notification.getNotificationStats("2025CS1001");
      expect(stats.total).toBe(2);
      expect(stats.unread).toBe(1);
      expect(stats.byType.like).toBe(1);
      expect(stats.byType.comment).toBe(1);
    });

    test("should create batch notifications", async () => {
      const recipients = ["2025CS1004", "2025CS1005"];
      const notificationData = {
        type: "announcement",
        title: "System Announcement",
        message: "Important system update",
        priority: "high",
      };

      const notifications = await Notification.createBatch(
        recipients,
        notificationData
      );
      expect(notifications).toHaveLength(2);
      expect(notifications[0].toStudentId).toBe("2025CS1004");
      expect(notifications[1].toStudentId).toBe("2025CS1005");
    });
  });

  describe("Virtuals", () => {
    test("should check if notification is expired", async () => {
      const notification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "Test",
        message: "Test message",
        expiresAt: new Date(Date.now() + 1000),
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
        expiresAt: new Date(Date.now() + 60000), // 1 minute
      });

      const timeRemaining = notification.timeRemaining;
      expect(timeRemaining).toBeGreaterThan(50000);
      expect(timeRemaining).toBeLessThanOrEqual(60000);
    });

    test("should check if notification was delivered", async () => {
      const notification = new Notification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "Test",
        message: "Test message",
        deliveryStatus: {
          push: { delivered: true, deliveredAt: new Date() },
          inApp: { delivered: false },
          email: { delivered: false },
        },
      });

      expect(notification.wasDelivered).toBe(true);

      notification.deliveryStatus.push.delivered = false;
      expect(notification.wasDelivered).toBe(false);
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Notification.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames.some((name) => name.includes("toStudentId_1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("createdAt_-1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("isRead_1"))).toBe(true);
      expect(indexNames.some((name) => name.includes("type_1"))).toBe(true);
      expect(indexNames.some((name) => name.includes("expiresAt_1"))).toBe(
        true
      );
    });
  });
});
