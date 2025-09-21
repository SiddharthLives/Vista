const firebaseService = require("./firebaseService");
const User = require("../models/User");

class FCMService {
  constructor() {
    this.maxTokensPerUser = 5; // Limit tokens per user to prevent spam
  }

  /**
   * Register FCM token for a user
   * @param {string} studentId - User's student ID
   * @param {string} fcmToken - FCM registration token
   * @returns {Promise<Object>} Registration result
   */
  async registerToken(studentId, fcmToken) {
    try {
      if (!studentId) {
        throw new Error("Student ID is required");
      }

      if (!fcmToken) {
        throw new Error("FCM token is required");
      }

      // Find user by student ID
      const user = await User.findOne({ studentId });
      if (!user) {
        throw new Error("User not found");
      }

      // Check if token already exists
      if (user.fcmTokens && user.fcmTokens.includes(fcmToken)) {
        return {
          success: true,
          message: "Token already registered",
          tokenCount: user.fcmTokens.length,
        };
      }

      // Initialize fcmTokens array if it doesn't exist
      if (!user.fcmTokens) {
        user.fcmTokens = [];
      }

      // Add new token
      user.fcmTokens.push(fcmToken);

      // Limit number of tokens per user (keep most recent)
      if (user.fcmTokens.length > this.maxTokensPerUser) {
        user.fcmTokens = user.fcmTokens.slice(-this.maxTokensPerUser);
      }

      await user.save();

      console.log(`FCM token registered for user ${studentId}`);
      return {
        success: true,
        message: "Token registered successfully",
        tokenCount: user.fcmTokens.length,
      };
    } catch (error) {
      console.error("Error registering FCM token:", error);
      throw new Error(`Failed to register FCM token: ${error.message}`);
    }
  }

  /**
   * Unregister FCM token for a user
   * @param {string} studentId - User's student ID
   * @param {string} fcmToken - FCM registration token to remove
   * @returns {Promise<Object>} Unregistration result
   */
  async unregisterToken(studentId, fcmToken) {
    try {
      if (!studentId) {
        throw new Error("Student ID is required");
      }

      if (!fcmToken) {
        throw new Error("FCM token is required");
      }

      const user = await User.findOne({ studentId });
      if (!user) {
        throw new Error("User not found");
      }

      if (!user.fcmTokens || !user.fcmTokens.includes(fcmToken)) {
        return {
          success: true,
          message: "Token not found",
          tokenCount: user.fcmTokens ? user.fcmTokens.length : 0,
        };
      }

      // Remove the token
      user.fcmTokens = user.fcmTokens.filter((token) => token !== fcmToken);
      await user.save();

      console.log(`FCM token unregistered for user ${studentId}`);
      return {
        success: true,
        message: "Token unregistered successfully",
        tokenCount: user.fcmTokens.length,
      };
    } catch (error) {
      console.error("Error unregistering FCM token:", error);
      throw new Error(`Failed to unregister FCM token: ${error.message}`);
    }
  }

  /**
   * Get all FCM tokens for a user
   * @param {string} studentId - User's student ID
   * @returns {Promise<string[]>} Array of FCM tokens
   */
  async getUserTokens(studentId) {
    try {
      if (!studentId) {
        throw new Error("Student ID is required");
      }

      const user = await User.findOne({ studentId }).select("fcmTokens");
      if (!user) {
        throw new Error("User not found");
      }

      return user.fcmTokens || [];
    } catch (error) {
      console.error("Error getting user FCM tokens:", error);
      throw new Error(`Failed to get user tokens: ${error.message}`);
    }
  }

  /**
   * Clean up invalid FCM tokens for a user
   * @param {string} studentId - User's student ID
   * @param {string[]} invalidTokens - Array of invalid tokens to remove
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupInvalidTokens(studentId, invalidTokens) {
    try {
      if (!studentId) {
        throw new Error("Student ID is required");
      }

      if (
        !invalidTokens ||
        !Array.isArray(invalidTokens) ||
        invalidTokens.length === 0
      ) {
        return {
          success: true,
          message: "No invalid tokens to clean up",
          removedCount: 0,
        };
      }

      const user = await User.findOne({ studentId });
      if (!user || !user.fcmTokens) {
        return {
          success: true,
          message: "User has no tokens to clean up",
          removedCount: 0,
        };
      }

      const originalCount = user.fcmTokens.length;
      user.fcmTokens = user.fcmTokens.filter(
        (token) => !invalidTokens.includes(token)
      );
      const removedCount = originalCount - user.fcmTokens.length;

      if (removedCount > 0) {
        await user.save();
        console.log(
          `Cleaned up ${removedCount} invalid FCM tokens for user ${studentId}`
        );
      }

      return {
        success: true,
        message: `Cleaned up ${removedCount} invalid tokens`,
        removedCount,
      };
    } catch (error) {
      console.error("Error cleaning up invalid FCM tokens:", error);
      throw new Error(`Failed to cleanup invalid tokens: ${error.message}`);
    }
  }

  /**
   * Send push notification to a specific user
   * @param {string} studentId - Target user's student ID
   * @param {Object} notification - Notification payload
   * @param {Object} data - Optional data payload
   * @returns {Promise<Object>} Send result
   */
  async sendNotificationToUser(studentId, notification, data = {}) {
    try {
      if (!studentId) {
        throw new Error("Student ID is required");
      }

      if (!notification || !notification.title) {
        throw new Error("Notification title is required");
      }

      const tokens = await this.getUserTokens(studentId);
      if (tokens.length === 0) {
        return {
          success: true,
          message: "User has no registered devices",
          sentCount: 0,
        };
      }

      // Add user-specific data
      const enrichedData = {
        ...data,
        targetStudentId: studentId,
        notificationType: data.type || "general",
      };

      const result = await firebaseService.sendNotificationToMultipleDevices(
        tokens,
        notification,
        enrichedData
      );

      // Clean up any invalid tokens
      if (result.invalidTokens && result.invalidTokens.length > 0) {
        await this.cleanupInvalidTokens(studentId, result.invalidTokens);
      }

      return {
        success: true,
        message: `Notification sent to ${result.successCount} devices`,
        sentCount: result.successCount,
        failedCount: result.failureCount,
        cleanedTokens: result.invalidTokens ? result.invalidTokens.length : 0,
      };
    } catch (error) {
      console.error("Error sending notification to user:", error);
      throw new Error(`Failed to send notification to user: ${error.message}`);
    }
  }

  /**
   * Send push notification to multiple users
   * @param {string[]} studentIds - Array of target user student IDs
   * @param {Object} notification - Notification payload
   * @param {Object} data - Optional data payload
   * @returns {Promise<Object>} Send result
   */
  async sendNotificationToUsers(studentIds, notification, data = {}) {
    try {
      if (
        !studentIds ||
        !Array.isArray(studentIds) ||
        studentIds.length === 0
      ) {
        throw new Error("Student IDs array is required and cannot be empty");
      }

      if (!notification || !notification.title) {
        throw new Error("Notification title is required");
      }

      // Get all tokens for all users
      const users = await User.find({
        studentId: { $in: studentIds },
      }).select("studentId fcmTokens");

      if (users.length === 0) {
        return {
          success: true,
          message: "No users found",
          sentCount: 0,
        };
      }

      // Collect all tokens
      const allTokens = [];
      const userTokenMap = new Map(); // Map tokens to users for cleanup

      users.forEach((user) => {
        if (user.fcmTokens && user.fcmTokens.length > 0) {
          user.fcmTokens.forEach((token) => {
            allTokens.push(token);
            userTokenMap.set(token, user.studentId);
          });
        }
      });

      if (allTokens.length === 0) {
        return {
          success: true,
          message: "No registered devices found for users",
          sentCount: 0,
        };
      }

      const result = await firebaseService.sendNotificationToMultipleDevices(
        allTokens,
        notification,
        data
      );

      // Clean up invalid tokens for each user
      if (result.invalidTokens && result.invalidTokens.length > 0) {
        const cleanupPromises = [];
        const userInvalidTokens = new Map();

        // Group invalid tokens by user
        result.invalidTokens.forEach((token) => {
          const studentId = userTokenMap.get(token);
          if (studentId) {
            if (!userInvalidTokens.has(studentId)) {
              userInvalidTokens.set(studentId, []);
            }
            userInvalidTokens.get(studentId).push(token);
          }
        });

        // Clean up tokens for each user
        userInvalidTokens.forEach((tokens, studentId) => {
          cleanupPromises.push(this.cleanupInvalidTokens(studentId, tokens));
        });

        await Promise.all(cleanupPromises);
      }

      return {
        success: true,
        message: `Notification sent to ${result.successCount} devices across ${users.length} users`,
        sentCount: result.successCount,
        failedCount: result.failureCount,
        userCount: users.length,
        cleanedTokens: result.invalidTokens ? result.invalidTokens.length : 0,
      };
    } catch (error) {
      console.error("Error sending notification to users:", error);
      throw new Error(`Failed to send notification to users: ${error.message}`);
    }
  }

  /**
   * Get FCM token statistics
   * @returns {Promise<Object>} Token statistics
   */
  async getTokenStatistics() {
    try {
      const stats = await User.aggregate([
        {
          $project: {
            studentId: 1,
            tokenCount: { $size: { $ifNull: ["$fcmTokens", []] } },
          },
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            usersWithTokens: {
              $sum: { $cond: [{ $gt: ["$tokenCount", 0] }, 1, 0] },
            },
            totalTokens: { $sum: "$tokenCount" },
            avgTokensPerUser: { $avg: "$tokenCount" },
          },
        },
      ]);

      const result = stats[0] || {
        totalUsers: 0,
        usersWithTokens: 0,
        totalTokens: 0,
        avgTokensPerUser: 0,
      };

      return {
        totalUsers: result.totalUsers,
        usersWithTokens: result.usersWithTokens,
        usersWithoutTokens: result.totalUsers - result.usersWithTokens,
        totalTokens: result.totalTokens,
        averageTokensPerUser: Math.round(result.avgTokensPerUser * 100) / 100,
      };
    } catch (error) {
      console.error("Error getting FCM token statistics:", error);
      throw new Error(`Failed to get token statistics: ${error.message}`);
    }
  }

  /**
   * Cleanup all invalid tokens across all users (maintenance function)
   * @param {number} batchSize - Number of users to process at once
   * @returns {Promise<Object>} Cleanup result
   */
  async performMaintenanceCleanup(batchSize = 100) {
    try {
      let totalCleaned = 0;
      let processedUsers = 0;
      let skip = 0;

      console.log("Starting FCM token maintenance cleanup...");

      while (true) {
        // Get batch of users with FCM tokens
        const users = await User.find({
          fcmTokens: { $exists: true, $ne: [] },
        })
          .select("studentId fcmTokens")
          .skip(skip)
          .limit(batchSize);

        if (users.length === 0) {
          break;
        }

        // Process each user's tokens
        for (const user of users) {
          if (user.fcmTokens && user.fcmTokens.length > 0) {
            try {
              // Test tokens by sending a dry-run message
              const testResult =
                await firebaseService.sendNotificationToMultipleDevices(
                  user.fcmTokens,
                  { title: "Test", body: "Token validation" },
                  { dryRun: true }
                );

              if (
                testResult.invalidTokens &&
                testResult.invalidTokens.length > 0
              ) {
                await this.cleanupInvalidTokens(
                  user.studentId,
                  testResult.invalidTokens
                );
                totalCleaned += testResult.invalidTokens.length;
              }
            } catch (error) {
              console.error(
                `Error processing tokens for user ${user.studentId}:`,
                error.message
              );
            }
          }
          processedUsers++;
        }

        skip += batchSize;
        console.log(
          `Processed ${processedUsers} users, cleaned ${totalCleaned} tokens so far...`
        );
      }

      console.log(
        `FCM maintenance cleanup completed. Processed ${processedUsers} users, cleaned ${totalCleaned} invalid tokens.`
      );

      return {
        success: true,
        processedUsers,
        cleanedTokens: totalCleaned,
      };
    } catch (error) {
      console.error("Error during FCM maintenance cleanup:", error);
      throw new Error(
        `Failed to perform maintenance cleanup: ${error.message}`
      );
    }
  }
}

// Export singleton instance
module.exports = new FCMService();
