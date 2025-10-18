const notificationService = require("../../src/services/notificationService");
const Notification = require("../../src/models/Notification");
const User = require("../../src/models/User");
const fcmService = require("../../src/services/fcmService");
const socketService = require("../../src/services/socketService");

// Mock dependencies
jest.mock("../../src/models/Notification");
jest.mock("../../src/models/User");
jest.mock("../../src/services/fcmService");
jest.mock("../../src/services/socketService");

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createNotification", () => {
    const mockUser = {
      studentId: "2025CS1001",
      settings: { notifications: true },
      fcmTokens: ["token1", "token2"],
    };

    beforeEach(() => {
      User.findByStudentId = jest.fn().mockResolvedValue(mockUser);
    });

    it("should create and send notification", async () => {
      const mockNotification = {
        _id: "notif123",
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "Someone liked your post",
        save: jest.fn().mockResolvedValue(true),
      };

      Notification.prototype.constructor = jest
        .fn()
        .mockReturnValue(mockNotification);
      socketService.sendNotificationToUser = jest.fn().mockResolvedValue(true);
      fcmService.sendNotificationToUser = jest.fn().mockResolvedValue(true);

      const notificationData = {
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

      const result = await notificationService.createNotification(
        notificationData
      );

      expect(User.findByStudentId).toHaveBeenCalledWith("2025CS1001");
      expect(mockNotification.save).toHaveBeenCalled();
      expect(socketService.sendNotificationToUser).toHaveBeenCalledWith(
        "2025CS1001",
        mockNotification
      );
      expect(fcmService.sendNotificationToUser).toHaveBeenCalledWith(
        mockUser,
        {
          title: "New Like",
          body: "Someone liked your post",
        },
        {
          type: "like",
          notificationId: "notif123",
          entityType: "Post",
          entityId: "507f1f77bcf86cd799439011",
        }
      );
      expect(result).toEqual(mockNotification);
    });

    it("should not create notification if user has notifications disabled", async () => {
      const userWithDisabledNotifications = {
        ...mockUser,
        settings: { notifications: false },
      };
      User.findByStudentId = jest
        .fn()
        .mockResolvedValue(userWithDisabledNotifications);

      const result = await notificationService.createNotification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "Someone liked your post",
      });

      expect(result).toBeNull();
      expect(socketService.sendNotificationToUser).not.toHaveBeenCalled();
      expect(fcmService.sendNotificationToUser).not.toHaveBeenCalled();
    });

    it("should not create notification if user not found", async () => {
      User.findByStudentId = jest.fn().mockResolvedValue(null);

      const result = await notificationService.createNotification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "Someone liked your post",
      });

      expect(result).toBeNull();
    });

    it("should handle socket service errors gracefully", async () => {
      const mockNotification = {
        _id: "notif123",
        save: jest.fn().mockResolvedValue(true),
      };

      Notification.prototype.constructor = jest
        .fn()
        .mockReturnValue(mockNotification);
      socketService.sendNotificationToUser = jest
        .fn()
        .mockRejectedValue(new Error("Socket error"));
      fcmService.sendNotificationToUser = jest.fn().mockResolvedValue(true);

      const result = await notificationService.createNotification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "Someone liked your post",
      });

      expect(result).toEqual(mockNotification);
      expect(fcmService.sendNotificationToUser).toHaveBeenCalled();
    });

    it("should handle FCM service errors gracefully", async () => {
      const mockNotification = {
        _id: "notif123",
        save: jest.fn().mockResolvedValue(true),
      };

      Notification.prototype.constructor = jest
        .fn()
        .mockReturnValue(mockNotification);
      socketService.sendNotificationToUser = jest.fn().mockResolvedValue(true);
      fcmService.sendNotificationToUser = jest
        .fn()
        .mockRejectedValue(new Error("FCM error"));

      const result = await notificationService.createNotification({
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "Someone liked your post",
      });

      expect(result).toEqual(mockNotification);
      expect(socketService.sendNotificationToUser).toHaveBeenCalled();
    });
  });

  describe("createBatchNotifications", () => {
    it("should create notifications for multiple users", async () => {
      const recipients = ["2025CS1001", "2025CS1002"];
      const mockUsers = [
        { studentId: "2025CS1001", settings: { notifications: true } },
        { studentId: "2025CS1002", settings: { notifications: true } },
      ];

      User.find = jest.fn().mockResolvedValue(mockUsers);
      Notification.createBatch = jest.fn().mockResolvedValue([
        { _id: "notif1", toStudentId: "2025CS1001" },
        { _id: "notif2", toStudentId: "2025CS1002" },
      ]);
      socketService.sendNotificationToUsers = jest.fn().mockResolvedValue(true);
      fcmService.sendBatchNotifications = jest.fn().mockResolvedValue(true);

      const notificationData = {
        type: "announcement",
        title: "System Update",
        message: "System will be updated tonight",
      };

      const result = await notificationService.createBatchNotifications(
        recipients,
        notificationData
      );

      expect(User.find).toHaveBeenCalledWith({
        studentId: { $in: recipients },
        "settings.notifications": true,
        isActive: true,
      });
      expect(Notification.createBatch).toHaveBeenCalledWith(
        ["2025CS1001", "2025CS1002"],
        notificationData
      );
      expect(result).toHaveLength(2);
    });

    it("should filter out users with notifications disabled", async () => {
      const recipients = ["2025CS1001", "2025CS1002"];
      const mockUsers = [
        { studentId: "2025CS1001", settings: { notifications: true } },
        // User 2025CS1002 not returned (notifications disabled)
      ];

      User.find = jest.fn().mockResolvedValue(mockUsers);
      Notification.createBatch = jest
        .fn()
        .mockResolvedValue([{ _id: "notif1", toStudentId: "2025CS1001" }]);

      const result = await notificationService.createBatchNotifications(
        recipients,
        { type: "announcement", title: "Test", message: "Test message" }
      );

      expect(result).toHaveLength(1);
      expect(result[0].toStudentId).toBe("2025CS1001");
    });
  });

  describe("createLikeNotification", () => {
    it("should create like notification", async () => {
      const mockNotification = { _id: "notif123" };
      notificationService.createNotification = jest
        .fn()
        .mockResolvedValue(mockNotification);

      const result = await notificationService.createLikeNotification(
        "2025CS1001", // recipient
        "2025CS1002", // liker
        "507f1f77bcf86cd799439011", // postId
        "Post"
      );

      expect(notificationService.createNotification).toHaveBeenCalledWith({
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "Someone liked your post",
        meta: {
          fromStudentId: "2025CS1002",
          entityType: "Post",
          entityId: "507f1f77bcf86cd799439011",
        },
        priority: "normal",
      });
      expect(result).toEqual(mockNotification);
    });

    it("should not create notification if user likes their own content", async () => {
      const result = await notificationService.createLikeNotification(
        "2025CS1001", // recipient
        "2025CS1001", // same user
        "507f1f77bcf86cd799439011",
        "Post"
      );

      expect(result).toBeNull();
    });
  });

  describe("createCommentNotification", () => {
    it("should create comment notification", async () => {
      const mockNotification = { _id: "notif123" };
      notificationService.createNotification = jest
        .fn()
        .mockResolvedValue(mockNotification);

      const result = await notificationService.createCommentNotification(
        "2025CS1001", // recipient
        "2025CS1002", // commenter
        "507f1f77bcf86cd799439011", // postId
        "Post",
        "Great post!"
      );

      expect(notificationService.createNotification).toHaveBeenCalledWith({
        toStudentId: "2025CS1001",
        type: "comment",
        title: "New Comment",
        message: "Someone commented on your post",
        meta: {
          fromStudentId: "2025CS1002",
          entityType: "Post",
          entityId: "507f1f77bcf86cd799439011",
          commentText: "Great post!",
        },
        priority: "normal",
      });
      expect(result).toEqual(mockNotification);
    });
  });

  describe("createFollowNotification", () => {
    it("should create follow notification", async () => {
      const mockNotification = { _id: "notif123" };
      notificationService.createNotification = jest
        .fn()
        .mockResolvedValue(mockNotification);

      const result = await notificationService.createFollowNotification(
        "2025CS1001", // recipient
        "2025CS1002" // follower
      );

      expect(notificationService.createNotification).toHaveBeenCalledWith({
        toStudentId: "2025CS1001",
        type: "follow",
        title: "New Follower",
        message: "Someone started following you",
        meta: {
          fromStudentId: "2025CS1002",
        },
        priority: "low",
      });
      expect(result).toEqual(mockNotification);
    });
  });

  describe("createMessageNotification", () => {
    it("should create message notification", async () => {
      const mockNotification = { _id: "notif123" };
      notificationService.createNotification = jest
        .fn()
        .mockResolvedValue(mockNotification);

      const result = await notificationService.createMessageNotification(
        "2025CS1001", // recipient
        "2025CS1002", // sender
        "507f1f77bcf86cd799439011", // conversationId
        "Hello there!"
      );

      expect(notificationService.createNotification).toHaveBeenCalledWith({
        toStudentId: "2025CS1001",
        type: "message",
        title: "New Message",
        message: "You have a new message",
        meta: {
          fromStudentId: "2025CS1002",
          conversationId: "507f1f77bcf86cd799439011",
          messagePreview: "Hello there!",
        },
        priority: "high",
        deliveryMethod: "push",
      });
      expect(result).toEqual(mockNotification);
    });
  });

  describe("getUserNotifications", () => {
    it("should get notifications for user", async () => {
      const mockNotifications = [
        { _id: "notif1", type: "like" },
        { _id: "notif2", type: "comment" },
      ];

      Notification.findForUser = jest.fn().mockResolvedValue(mockNotifications);

      const result = await notificationService.getUserNotifications(
        "2025CS1001",
        {
          limit: 20,
          page: 1,
        }
      );

      expect(Notification.findForUser).toHaveBeenCalledWith("2025CS1001", {
        limit: 20,
        page: 1,
      });
      expect(result).toEqual(mockNotifications);
    });

    it("should use default options", async () => {
      Notification.findForUser = jest.fn().mockResolvedValue([]);

      await notificationService.getUserNotifications("2025CS1001");

      expect(Notification.findForUser).toHaveBeenCalledWith("2025CS1001", {
        limit: 50,
        page: 1,
        unreadOnly: false,
      });
    });
  });

  describe("getUnreadNotifications", () => {
    it("should get unread notifications for user", async () => {
      const mockNotifications = [{ _id: "notif1", isRead: false }];

      Notification.findUnreadForUser = jest
        .fn()
        .mockResolvedValue(mockNotifications);

      const result = await notificationService.getUnreadNotifications(
        "2025CS1001"
      );

      expect(Notification.findUnreadForUser).toHaveBeenCalledWith("2025CS1001");
      expect(result).toEqual(mockNotifications);
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      const mockNotification = {
        _id: "notif123",
        markAsRead: jest.fn().mockResolvedValue(true),
      };

      Notification.findById = jest.fn().mockResolvedValue(mockNotification);

      await notificationService.markAsRead("notif123");

      expect(Notification.findById).toHaveBeenCalledWith("notif123");
      expect(mockNotification.markAsRead).toHaveBeenCalled();
    });

    it("should throw error for non-existent notification", async () => {
      Notification.findById = jest.fn().mockResolvedValue(null);

      await expect(notificationService.markAsRead("invalid")).rejects.toThrow(
        "Notification not found"
      );
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all notifications as read for user", async () => {
      Notification.markAllAsReadForUser = jest.fn().mockResolvedValue({
        modifiedCount: 5,
      });

      const result = await notificationService.markAllAsRead("2025CS1001");

      expect(Notification.markAllAsReadForUser).toHaveBeenCalledWith(
        "2025CS1001"
      );
      expect(result.modifiedCount).toBe(5);
    });
  });

  describe("getUnreadCount", () => {
    it("should get unread notification count", async () => {
      Notification.getUnreadCount = jest.fn().mockResolvedValue(3);

      const result = await notificationService.getUnreadCount("2025CS1001");

      expect(Notification.getUnreadCount).toHaveBeenCalledWith("2025CS1001");
      expect(result).toBe(3);
    });
  });

  describe("deleteNotification", () => {
    it("should delete notification", async () => {
      const mockNotification = {
        _id: "notif123",
        markAsInactive: jest.fn().mockResolvedValue(true),
      };

      Notification.findById = jest.fn().mockResolvedValue(mockNotification);

      await notificationService.deleteNotification("notif123");

      expect(Notification.findById).toHaveBeenCalledWith("notif123");
      expect(mockNotification.markAsInactive).toHaveBeenCalled();
    });

    it("should throw error for non-existent notification", async () => {
      Notification.findById = jest.fn().mockResolvedValue(null);

      await expect(
        notificationService.deleteNotification("invalid")
      ).rejects.toThrow("Notification not found");
    });
  });

  describe("cleanupExpiredNotifications", () => {
    it("should cleanup expired notifications", async () => {
      Notification.cleanupExpired = jest.fn().mockResolvedValue({
        deletedCount: 10,
      });

      const result = await notificationService.cleanupExpiredNotifications();

      expect(Notification.cleanupExpired).toHaveBeenCalled();
      expect(result.deletedCount).toBe(10);
    });
  });

  describe("getNotificationStats", () => {
    it("should get notification statistics", async () => {
      const mockStats = {
        total: 50,
        unread: 5,
        byType: { like: 20, comment: 15, follow: 10, message: 5 },
      };

      Notification.getNotificationStats = jest
        .fn()
        .mockResolvedValue(mockStats);

      const result = await notificationService.getNotificationStats(
        "2025CS1001"
      );

      expect(Notification.getNotificationStats).toHaveBeenCalledWith(
        "2025CS1001"
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe("validateNotificationData", () => {
    it("should validate correct notification data", () => {
      const validData = {
        toStudentId: "2025CS1001",
        type: "like",
        title: "New Like",
        message: "Someone liked your post",
      };

      expect(() =>
        notificationService.validateNotificationData(validData)
      ).not.toThrow();
    });

    it("should throw error for missing required fields", () => {
      expect(() => notificationService.validateNotificationData({})).toThrow(
        "toStudentId is required"
      );

      expect(() =>
        notificationService.validateNotificationData({
          toStudentId: "2025CS1001",
        })
      ).toThrow("type is required");

      expect(() =>
        notificationService.validateNotificationData({
          toStudentId: "2025CS1001",
          type: "like",
        })
      ).toThrow("title is required");

      expect(() =>
        notificationService.validateNotificationData({
          toStudentId: "2025CS1001",
          type: "like",
          title: "Test",
        })
      ).toThrow("message is required");
    });

    it("should throw error for invalid notification type", () => {
      expect(() =>
        notificationService.validateNotificationData({
          toStudentId: "2025CS1001",
          type: "invalid",
          title: "Test",
          message: "Test message",
        })
      ).toThrow("Invalid notification type");
    });

    it("should throw error for invalid student ID", () => {
      expect(() =>
        notificationService.validateNotificationData({
          toStudentId: "invalid",
          type: "like",
          title: "Test",
          message: "Test message",
        })
      ).toThrow("Invalid student ID format");
    });
  });
});
