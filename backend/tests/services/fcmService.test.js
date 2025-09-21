const fcmService = require("../../src/services/fcmService");
const firebaseService = require("../../src/services/firebaseService");
const User = require("../../src/models/User");

// Mock dependencies
jest.mock("../../src/services/firebaseService");
jest.mock("../../src/models/User");

describe("FCMService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerToken", () => {
    it("should register a new FCM token for a user", async () => {
      const mockUser = {
        studentId: "2025CS1001",
        fcmTokens: [],
        save: jest.fn().mockResolvedValue(),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await fcmService.registerToken(
        "2025CS1001",
        "test-token-123"
      );

      expect(User.findOne).toHaveBeenCalledWith({ studentId: "2025CS1001" });
      expect(mockUser.fcmTokens).toContain("test-token-123");
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.tokenCount).toBe(1);
    });

    it("should not register duplicate tokens", async () => {
      const mockUser = {
        studentId: "2025CS1001",
        fcmTokens: ["test-token-123"],
        save: jest.fn().mockResolvedValue(),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await fcmService.registerToken(
        "2025CS1001",
        "test-token-123"
      );

      expect(mockUser.save).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe("Token already registered");
      expect(result.tokenCount).toBe(1);
    });

    it("should limit tokens per user to maximum allowed", async () => {
      const mockUser = {
        studentId: "2025CS1001",
        fcmTokens: ["token1", "token2", "token3", "token4", "token5"],
        save: jest.fn().mockResolvedValue(),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await fcmService.registerToken("2025CS1001", "token6");

      expect(mockUser.fcmTokens).toHaveLength(5);
      expect(mockUser.fcmTokens).toContain("token6");
      expect(mockUser.fcmTokens).not.toContain("token1"); // First token should be removed
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should throw error if student ID is missing", async () => {
      await expect(fcmService.registerToken("", "test-token")).rejects.toThrow(
        "Student ID is required"
      );
    });

    it("should throw error if FCM token is missing", async () => {
      await expect(fcmService.registerToken("2025CS1001", "")).rejects.toThrow(
        "FCM token is required"
      );
    });

    it("should throw error if user not found", async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        fcmService.registerToken("2025CS1001", "test-token")
      ).rejects.toThrow("User not found");
    });
  });

  describe("unregisterToken", () => {
    it("should unregister an existing FCM token", async () => {
      const mockUser = {
        studentId: "2025CS1001",
        fcmTokens: ["token1", "token2", "token3"],
        save: jest.fn().mockResolvedValue(),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await fcmService.unregisterToken("2025CS1001", "token2");

      expect(mockUser.fcmTokens).toEqual(["token1", "token3"]);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.tokenCount).toBe(2);
    });

    it("should handle unregistering non-existent token gracefully", async () => {
      const mockUser = {
        studentId: "2025CS1001",
        fcmTokens: ["token1", "token2"],
        save: jest.fn().mockResolvedValue(),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await fcmService.unregisterToken(
        "2025CS1001",
        "non-existent-token"
      );

      expect(mockUser.save).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe("Token not found");
      expect(result.tokenCount).toBe(2);
    });

    it("should throw error if user not found", async () => {
      User.findOne.mockResolvedValue(null);

      await expect(
        fcmService.unregisterToken("2025CS1001", "test-token")
      ).rejects.toThrow("User not found");
    });
  });

  describe("getUserTokens", () => {
    it("should return user FCM tokens", async () => {
      const mockUser = {
        fcmTokens: ["token1", "token2", "token3"],
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const tokens = await fcmService.getUserTokens("2025CS1001");

      expect(User.findOne).toHaveBeenCalledWith({ studentId: "2025CS1001" });
      expect(tokens).toEqual(["token1", "token2", "token3"]);
    });

    it("should return empty array if user has no tokens", async () => {
      const mockUser = {};

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const tokens = await fcmService.getUserTokens("2025CS1001");

      expect(tokens).toEqual([]);
    });

    it("should throw error if user not found", async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(fcmService.getUserTokens("2025CS1001")).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("cleanupInvalidTokens", () => {
    it("should remove invalid tokens from user", async () => {
      const mockUser = {
        studentId: "2025CS1001",
        fcmTokens: ["valid-token", "invalid-token1", "invalid-token2"],
        save: jest.fn().mockResolvedValue(),
      };

      User.findOne.mockResolvedValue(mockUser);

      const result = await fcmService.cleanupInvalidTokens("2025CS1001", [
        "invalid-token1",
        "invalid-token2",
      ]);

      expect(mockUser.fcmTokens).toEqual(["valid-token"]);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(2);
    });

    it("should handle empty invalid tokens array", async () => {
      const result = await fcmService.cleanupInvalidTokens("2025CS1001", []);

      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(0);
      expect(result.message).toBe("No invalid tokens to clean up");
    });
  });

  describe("sendNotificationToUser", () => {
    it("should send notification to user with tokens", async () => {
      const mockTokens = ["token1", "token2"];
      const mockNotification = { title: "Test", body: "Test message" };
      const mockData = { type: "like" };

      jest.spyOn(fcmService, "getUserTokens").mockResolvedValue(mockTokens);
      firebaseService.sendNotificationToMultipleDevices.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        invalidTokens: [],
      });

      const result = await fcmService.sendNotificationToUser(
        "2025CS1001",
        mockNotification,
        mockData
      );

      expect(fcmService.getUserTokens).toHaveBeenCalledWith("2025CS1001");
      expect(
        firebaseService.sendNotificationToMultipleDevices
      ).toHaveBeenCalledWith(
        mockTokens,
        mockNotification,
        expect.objectContaining({
          type: "like",
          targetStudentId: "2025CS1001",
          notificationType: "like",
        })
      );
      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2);
    });

    it("should handle user with no tokens", async () => {
      jest.spyOn(fcmService, "getUserTokens").mockResolvedValue([]);

      const result = await fcmService.sendNotificationToUser("2025CS1001", {
        title: "Test",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(0);
      expect(result.message).toBe("User has no registered devices");
    });

    it("should cleanup invalid tokens after sending", async () => {
      const mockTokens = ["valid-token", "invalid-token"];
      const mockNotification = { title: "Test", body: "Test message" };

      jest.spyOn(fcmService, "getUserTokens").mockResolvedValue(mockTokens);
      jest
        .spyOn(fcmService, "cleanupInvalidTokens")
        .mockResolvedValue({ success: true, removedCount: 1 });

      firebaseService.sendNotificationToMultipleDevices.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        invalidTokens: ["invalid-token"],
      });

      const result = await fcmService.sendNotificationToUser(
        "2025CS1001",
        mockNotification
      );

      expect(fcmService.cleanupInvalidTokens).toHaveBeenCalledWith(
        "2025CS1001",
        ["invalid-token"]
      );
      expect(result.cleanedTokens).toBe(1);
    });

    it("should throw error if notification title is missing", async () => {
      await expect(
        fcmService.sendNotificationToUser("2025CS1001", {})
      ).rejects.toThrow("Notification title is required");
    });
  });

  describe("sendNotificationToUsers", () => {
    it("should send notification to multiple users", async () => {
      const mockUsers = [
        { studentId: "2025CS1001", fcmTokens: ["token1", "token2"] },
        { studentId: "2025CS1002", fcmTokens: ["token3"] },
      ];

      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUsers),
      });

      firebaseService.sendNotificationToMultipleDevices.mockResolvedValue({
        successCount: 3,
        failureCount: 0,
        invalidTokens: [],
      });

      const result = await fcmService.sendNotificationToUsers(
        ["2025CS1001", "2025CS1002"],
        { title: "Test", body: "Test message" }
      );

      expect(User.find).toHaveBeenCalledWith({
        studentId: { $in: ["2025CS1001", "2025CS1002"] },
      });
      expect(
        firebaseService.sendNotificationToMultipleDevices
      ).toHaveBeenCalledWith(
        ["token1", "token2", "token3"],
        { title: "Test", body: "Test message" },
        {}
      );
      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(3);
      expect(result.userCount).toBe(2);
    });

    it("should handle empty student IDs array", async () => {
      await expect(
        fcmService.sendNotificationToUsers([], { title: "Test" })
      ).rejects.toThrow("Student IDs array is required and cannot be empty");
    });

    it("should handle users with no tokens", async () => {
      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      const result = await fcmService.sendNotificationToUsers(["2025CS1001"], {
        title: "Test",
      });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(0);
      expect(result.message).toBe("No users found");
    });
  });

  describe("getTokenStatistics", () => {
    it("should return FCM token statistics", async () => {
      const mockStats = [
        {
          totalUsers: 100,
          usersWithTokens: 75,
          totalTokens: 150,
          avgTokensPerUser: 1.5,
        },
      ];

      User.aggregate.mockResolvedValue(mockStats);

      const result = await fcmService.getTokenStatistics();

      expect(result.totalUsers).toBe(100);
      expect(result.usersWithTokens).toBe(75);
      expect(result.usersWithoutTokens).toBe(25);
      expect(result.totalTokens).toBe(150);
      expect(result.averageTokensPerUser).toBe(1.5);
    });

    it("should handle empty statistics", async () => {
      User.aggregate.mockResolvedValue([]);

      const result = await fcmService.getTokenStatistics();

      expect(result.totalUsers).toBe(0);
      expect(result.usersWithTokens).toBe(0);
      expect(result.usersWithoutTokens).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.averageTokensPerUser).toBe(0);
    });
  });
});
