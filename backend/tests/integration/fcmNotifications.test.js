const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../src/server");
const User = require("../../src/models/User");
const Notification = require("../../src/models/Notification");
const NotificationService = require("../../src/services/notificationService");
const fcmService = require("../../src/services/fcmService");

// Mock FCM service
jest.mock("../../src/services/fcmService");

describe("FCM Notifications Integration", () => {
  let testUser1, testUser2;
  let notificationService;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_TEST_URI ||
          "mongodb://localhost:27017/college-app-test"
      );
    }
  });

  beforeEach(async () => {
    // Clear test data
    await User.deleteMany({});
    await Notification.deleteMany({});

    // Create test users
    testUser1 = await User.create({
      studentId: "2025CS1001",
      email: "student1@college.edu",
      displayName: "Test Student 1",
      year: 3,
      department: "CS",
      section: "A",
      fcmTokens: ["token1", "token2"],
      settings: {
        notifications: true,
        pushNotifications: true,
        notificationTypes: {
          like: true,
          comment: true,
          message: true,
        },
      },
    });

    testUser2 = await User.create({
      studentId: "2025CS1002",
      email: "student2@college.edu",
      displayName: "Test Student 2",
      year: 3,
      department: "CS",
      section: "A",
      fcmTokens: ["token3"],
      settings: {
        notifications: true,
        pushNotifications: false, // Push disabled
        notificationTypes: {
          like: true,
          comment: false, // Comments disabled
          message: true,
        },
      },
    });

    // Initialize notification service
    notificationService = new NotificationService();

    // Clear mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("Single User Notifications", () => {
    it("should send push notification when user is offline", async () => {
      fcmService.sendNotificationToUser.mockResolvedValue({
        success: true,
        sentCount: 2,
        failedCount: 0,
      });

      const postId = new mongoose.Types.ObjectId();
      const notification = await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "like",
        fromStudentId: testUser2.studentId,
        meta: {
          postId: postId,
          entityId: postId,
          entityType: "Post",
          fromDisplayName: testUser2.displayName,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification.type).toBe("like");
      expect(notification.toStudentId).toBe(testUser1.studentId);

      // Should attempt to send push notification since no socket service
      expect(fcmService.sendNotificationToUser).toHaveBeenCalledWith(
        testUser1.studentId,
        {
          title: "Post Liked",
          body: "Test Student 2 liked your post",
        },
        {
          type: "like",
          notificationId: notification._id.toString(),
          entityType: "Post",
          entityId: postId.toString(),
          fromStudentId: testUser2.studentId,
        }
      );
    });

    it("should not send push notification when user has push disabled", async () => {
      const postId = new mongoose.Types.ObjectId();
      const notification = await notificationService.createNotification({
        toStudentId: testUser2.studentId,
        type: "like",
        fromStudentId: testUser1.studentId,
        meta: {
          postId: postId,
          entityId: postId,
          entityType: "Post",
          fromDisplayName: testUser1.displayName,
        },
      });

      expect(notification).toBeTruthy();
      expect(fcmService.sendNotificationToUser).not.toHaveBeenCalled();
    });

    it("should not create notification when user has notification type disabled", async () => {
      const postId = new mongoose.Types.ObjectId();
      const notification = await notificationService.createNotification({
        toStudentId: testUser2.studentId,
        type: "comment",
        fromStudentId: testUser1.studentId,
        meta: {
          postId: postId,
          entityId: postId,
          entityType: "Post",
          fromDisplayName: testUser1.displayName,
        },
      });

      expect(notification).toBeNull();
      expect(fcmService.sendNotificationToUser).not.toHaveBeenCalled();
    });

    it("should handle FCM service errors gracefully", async () => {
      fcmService.sendNotificationToUser.mockRejectedValue(
        new Error("FCM service error")
      );

      const conversationId = new mongoose.Types.ObjectId();
      const notification = await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "message",
        fromStudentId: testUser2.studentId,
        meta: {
          conversationId: conversationId,
          entityId: conversationId,
          entityType: "Message",
          fromDisplayName: testUser2.displayName,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification.type).toBe("message");

      // Should still create notification even if FCM fails
      const savedNotification = await Notification.findById(notification._id);
      expect(savedNotification).toBeTruthy();
    });
  });

  describe("Batch Notifications", () => {
    it("should send batch push notifications to offline users", async () => {
      fcmService.sendNotificationToUsers.mockResolvedValue({
        success: true,
        sentCount: 2,
        failedCount: 0,
        userCount: 2,
      });

      const notifications =
        await notificationService.createNotificationsForUsers(
          [testUser1.studentId, testUser2.studentId],
          {
            type: "system",
            message: "System announcement",
            meta: {
              title: "System Notification",
              fullMessage: "This is a system announcement",
            },
          }
        );

      // Should create notifications for both users (system notifications are created regardless of push settings)
      // But only send push to user1 (user2 has push disabled)
      expect(notifications).toHaveLength(2);
      const user1Notification = notifications.find(
        (n) => n.toStudentId === testUser1.studentId
      );
      const user2Notification = notifications.find(
        (n) => n.toStudentId === testUser2.studentId
      );
      expect(user1Notification).toBeTruthy();
      expect(user2Notification).toBeTruthy();

      // Should send push notification to user1 only (user2 has push disabled)
      expect(fcmService.sendNotificationToUsers).toHaveBeenCalledWith(
        [testUser1.studentId],
        {
          title: "System Notification",
          body: "System announcement",
        },
        {
          type: "system",
          entityType: "Post",
          entityId: undefined,
          fromStudentId: undefined,
        }
      );
    });

    it("should respect user preferences in batch notifications", async () => {
      const postId = new mongoose.Types.ObjectId();
      const notifications =
        await notificationService.createNotificationsForUsers(
          [testUser1.studentId, testUser2.studentId],
          {
            type: "comment",
            fromStudentId: "2025CS1003",
            meta: {
              postId: postId,
              entityId: postId,
              entityType: "Post",
              fromDisplayName: "Other User",
            },
          }
        );

      // Should only create notification for user1 (user2 has comments disabled)
      expect(notifications).toHaveLength(1);
      expect(notifications[0].toStudentId).toBe(testUser1.studentId);
    });

    it("should handle empty user arrays", async () => {
      const notifications =
        await notificationService.createNotificationsForUsers([], {
          type: "like",
          meta: { postId: "post123" },
        });

      expect(notifications).toEqual([]);
      expect(fcmService.sendNotificationToUsers).not.toHaveBeenCalled();
    });
  });

  describe("Group Notifications", () => {
    it("should send notifications to users in specific group", async () => {
      fcmService.sendNotificationToUsers.mockResolvedValue({
        success: true,
        sentCount: 1,
        failedCount: 0,
        userCount: 1,
      });

      const notifications = await notificationService.sendGroupNotification(
        {
          year: 3,
          department: "CS",
          section: "A",
        },
        {
          type: "system",
          message: "Department announcement",
          meta: {
            title: "Department Notification",
            fullMessage: "This is a department announcement",
          },
        }
      );

      // Should find both users and create notifications for both (system notifications are created regardless of push settings)
      expect(notifications).toHaveLength(2);
      const user1Notification = notifications.find(
        (n) => n.toStudentId === testUser1.studentId
      );
      const user2Notification = notifications.find(
        (n) => n.toStudentId === testUser2.studentId
      );
      expect(user1Notification).toBeTruthy();
      expect(user2Notification).toBeTruthy();
    });
  });

  describe("FCM Token Management", () => {
    it("should register FCM token", async () => {
      fcmService.registerToken.mockResolvedValue({
        success: true,
        tokenCount: 3,
      });

      const result = await notificationService.registerFCMToken(
        testUser1.studentId,
        "new-token"
      );

      expect(result.success).toBe(true);
      expect(fcmService.registerToken).toHaveBeenCalledWith(
        testUser1.studentId,
        "new-token"
      );
    });

    it("should unregister FCM token", async () => {
      fcmService.unregisterToken.mockResolvedValue({
        success: true,
        tokenCount: 1,
      });

      const result = await notificationService.unregisterFCMToken(
        testUser1.studentId,
        "token1"
      );

      expect(result.success).toBe(true);
      expect(fcmService.unregisterToken).toHaveBeenCalledWith(
        testUser1.studentId,
        "token1"
      );
    });

    it("should handle FCM token registration errors", async () => {
      fcmService.registerToken.mockRejectedValue(
        new Error("Registration failed")
      );

      await expect(
        notificationService.registerFCMToken(testUser1.studentId, "new-token")
      ).rejects.toThrow("Failed to register FCM token: Registration failed");
    });
  });

  describe("User Preferences", () => {
    it("should get user notification preferences", async () => {
      const preferences =
        await notificationService.getUserNotificationPreferences(
          testUser1.studentId
        );

      expect(preferences).toEqual({
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
      });
    });

    it("should return default preferences for non-existent user", async () => {
      const preferences =
        await notificationService.getUserNotificationPreferences(
          "non-existent-user"
        );

      expect(preferences).toEqual({
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
      });
    });

    it("should update user notification preferences", async () => {
      const result =
        await notificationService.updateUserNotificationPreferences(
          testUser1.studentId,
          {
            enabled: true,
            pushEnabled: false,
            types: {
              like: false,
              comment: true,
            },
          }
        );

      expect(result.success).toBe(true);

      // Verify the update
      const updatedUser = await User.findOne({
        studentId: testUser1.studentId,
      });
      expect(updatedUser.settings.pushNotifications).toBe(false);
      expect(updatedUser.settings.notificationTypes.like).toBe(false);
      expect(updatedUser.settings.notificationTypes.comment).toBe(true);
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting for batch notifications", async () => {
      // Mock a large number of users
      const manyUserIds = Array.from({ length: 200 }, (_, i) => `user${i}`);

      const notifications =
        await notificationService.createNotificationsForUsers(manyUserIds, {
          type: "system",
          message: "Bulk notification",
          meta: { title: "Bulk Test" },
        });

      // Should be rate limited due to exceeding maxNotificationsPerUser
      expect(notifications).toEqual([]);
    });

    it("should apply cooldown between batches", async () => {
      const batchKey = "system_batch";

      // First batch should succeed
      expect(notificationService.shouldRateLimit(batchKey, 10)).toBe(false);

      // Simulate setting last batch time
      notificationService.lastBatchTime.set(batchKey, Date.now());

      // Second batch should be rate limited due to cooldown
      expect(notificationService.shouldRateLimit(batchKey, 10)).toBe(true);
    });
  });
});
