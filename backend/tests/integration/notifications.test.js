const request = require("supertest");
const { app } = require("../../src/server");
const User = require("../../src/models/User");
const Notification = require("../../src/models/Notification");
const jwtService = require("../../src/services/jwtService");
const NotificationService = require("../../src/services/notificationService");

describe("Notifications API Integration Tests", () => {
  let testUser1, testUser2;
  let user1Token, user2Token;
  let notificationService;

  beforeAll(async () => {
    // Create test users
    testUser1 = new User({
      studentId: "2025CS1001",
      email: "user1@college.edu",
      displayName: "Test User 1",
      year: 3,
      department: "CS",
      section: "A",
    });

    testUser2 = new User({
      studentId: "2025CS1002",
      email: "user2@college.edu",
      displayName: "Test User 2",
      year: 3,
      department: "CS",
      section: "A",
    });

    await Promise.all([testUser1.save(), testUser2.save()]);

    // Generate JWT tokens
    user1Token = jwtService.generateToken({
      studentId: testUser1.studentId,
      email: testUser1.email,
      uid: "firebase-uid-1",
    });

    user2Token = jwtService.generateToken({
      studentId: testUser2.studentId,
      email: testUser2.email,
      uid: "firebase-uid-2",
    });

    // Initialize notification service
    notificationService = new NotificationService();
  });

  afterAll(async () => {
    // Clean up test data
    await Promise.all([
      User.deleteMany({ studentId: { $in: ["2025CS1001", "2025CS1002"] } }),
      Notification.deleteMany({}),
    ]);
  });

  beforeEach(async () => {
    // Clean up notifications before each test
    await Notification.deleteMany({});
  });

  describe("GET /notifications", () => {
    beforeEach(async () => {
      // Create test notifications
      await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "like",
        fromStudentId: testUser2.studentId,
        meta: {
          postId: "post-123",
          fromStudentId: testUser2.studentId,
          fromDisplayName: testUser2.displayName,
        },
      });

      await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "comment",
        fromStudentId: testUser2.studentId,
        meta: {
          postId: "post-456",
          commentId: "comment-789",
          fromStudentId: testUser2.studentId,
          fromDisplayName: testUser2.displayName,
          commentText: "Great post!",
        },
      });
    });

    it("should return user notifications with pagination", async () => {
      const response = await request(app)
        .get("/notifications")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it("should return notifications ordered by most recent", async () => {
      const response = await request(app)
        .get("/notifications")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications[0].type).toBe("comment"); // More recent
      expect(response.body.notifications[1].type).toBe("like");
    });

    it("should support pagination with limit and offset", async () => {
      const response = await request(app)
        .get("/notifications?limit=1&offset=0")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.pagination.hasMore).toBe(true);
      expect(response.body.pagination.nextOffset).toBe(1);
    });

    it("should filter unread notifications only", async () => {
      // Mark one notification as read
      const notifications = await Notification.find({
        toStudentId: testUser1.studentId,
      });
      await Notification.findByIdAndUpdate(notifications[0]._id, {
        isRead: true,
      });

      const response = await request(app)
        .get("/notifications?unreadOnly=true")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.notifications[0].isRead).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/notifications");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /notifications/unread-count", () => {
    beforeEach(async () => {
      // Create test notifications
      await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "like",
        fromStudentId: testUser2.studentId,
        meta: {
          postId: "post-123",
          fromStudentId: testUser2.studentId,
          fromDisplayName: testUser2.displayName,
        },
      });

      await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "comment",
        fromStudentId: testUser2.studentId,
        meta: {
          postId: "post-456",
          fromStudentId: testUser2.studentId,
          fromDisplayName: testUser2.displayName,
        },
      });
    });

    it("should return correct unread count", async () => {
      const response = await request(app)
        .get("/notifications/unread-count")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.unreadCount).toBe(2);
    });

    it("should return zero for user with no notifications", async () => {
      const response = await request(app)
        .get("/notifications/unread-count")
        .set("Authorization", `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.unreadCount).toBe(0);
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/notifications/unread-count");

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /notifications/read", () => {
    let testNotification1, testNotification2;

    beforeEach(async () => {
      testNotification1 = await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "like",
        fromStudentId: testUser2.studentId,
        meta: {
          postId: "post-123",
          fromStudentId: testUser2.studentId,
          fromDisplayName: testUser2.displayName,
        },
      });

      testNotification2 = await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "comment",
        fromStudentId: testUser2.studentId,
        meta: {
          postId: "post-456",
          fromStudentId: testUser2.studentId,
          fromDisplayName: testUser2.displayName,
        },
      });
    });

    it("should mark all notifications as read when no IDs provided", async () => {
      const response = await request(app)
        .put("/notifications/read")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.modifiedCount).toBe(2);

      // Verify notifications are marked as read
      const notifications = await Notification.find({
        toStudentId: testUser1.studentId,
      });
      expect(notifications.every((n) => n.isRead)).toBe(true);
    });

    it("should mark specific notifications as read", async () => {
      const response = await request(app)
        .put("/notifications/read")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          notificationIds: [testNotification1._id.toString()],
        });

      expect(response.status).toBe(200);
      expect(response.body.modifiedCount).toBe(1);

      // Verify only specified notification is marked as read
      const notification1 = await Notification.findById(testNotification1._id);
      const notification2 = await Notification.findById(testNotification2._id);

      expect(notification1.isRead).toBe(true);
      expect(notification2.isRead).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app).put("/notifications/read").send({});

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /notifications/:notificationId/read", () => {
    let testNotification;

    beforeEach(async () => {
      testNotification = await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "like",
        fromStudentId: testUser2.studentId,
        meta: {
          postId: "post-123",
          fromStudentId: testUser2.studentId,
          fromDisplayName: testUser2.displayName,
        },
      });
    });

    it("should mark specific notification as read", async () => {
      const response = await request(app)
        .put(`/notifications/${testNotification._id}/read`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Notification marked as read");
      expect(response.body.modifiedCount).toBe(1);

      // Verify notification is marked as read
      const updatedNotification = await Notification.findById(
        testNotification._id
      );
      expect(updatedNotification.isRead).toBe(true);
    });

    it("should return 404 for non-existent notification", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const response = await request(app)
        .put(`/notifications/${fakeId}/read`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
    });

    it("should reject invalid notification ID", async () => {
      const response = await request(app)
        .put("/notifications/invalid-id/read")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should require authentication", async () => {
      const response = await request(app).put(
        `/notifications/${testNotification._id}/read`
      );

      expect(response.status).toBe(401);
    });
  });

  describe("POST /notifications/test (development only)", () => {
    it("should create test notification in development environment", async () => {
      // This test only runs if NODE_ENV is development or test
      if (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test"
      ) {
        const response = await request(app)
          .post("/notifications/test")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({
            type: "like",
            message: "Test like notification",
            meta: {
              postId: "test-post-123",
            },
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe("Test notification created");
        expect(response.body.notification.type).toBe("like");
        expect(response.body.notification.message).toBe(
          "Test like notification"
        );
      }
    });

    it("should reject invalid notification type", async () => {
      if (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test"
      ) {
        const response = await request(app)
          .post("/notifications/test")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({
            type: "invalid-type",
            message: "Test notification",
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});

describe("NotificationService Unit Tests", () => {
  let notificationService;
  let testUser1, testUser2;

  beforeAll(async () => {
    notificationService = new NotificationService();

    // Create test users
    testUser1 = new User({
      studentId: "2025CS1001",
      email: "user1@college.edu",
      displayName: "Test User 1",
      year: 3,
      department: "CS",
      section: "A",
    });

    testUser2 = new User({
      studentId: "2025CS1002",
      email: "user2@college.edu",
      displayName: "Test User 2",
      year: 3,
      department: "CS",
      section: "A",
    });

    await Promise.all([testUser1.save(), testUser2.save()]);
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ studentId: { $in: ["2025CS1001", "2025CS1002"] } }),
      Notification.deleteMany({}),
    ]);
  });

  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  describe("createNotification", () => {
    it("should create a notification successfully", async () => {
      const notificationData = {
        toStudentId: testUser1.studentId,
        type: "like",
        fromStudentId: testUser2.studentId,
        meta: {
          entityId: "507f1f77bcf86cd799439011", // Valid ObjectId
          fromDisplayName: testUser2.displayName,
        },
      };

      const notification = await notificationService.createNotification(
        notificationData
      );

      expect(notification).toBeDefined();
      expect(notification.toStudentId).toBe(testUser1.studentId);
      expect(notification.type).toBe("like");
      expect(notification.meta.fromStudentId).toBe(testUser2.studentId);
      expect(notification.isRead).toBe(false);
    });

    it("should generate appropriate message for different notification types", async () => {
      const likeNotification = await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "like",
        meta: { fromDisplayName: testUser2.displayName },
      });

      const commentNotification = await notificationService.createNotification({
        toStudentId: testUser1.studentId,
        type: "comment",
        meta: { fromDisplayName: testUser2.displayName },
      });

      expect(likeNotification.message).toBe(
        `${testUser2.displayName} liked your post`
      );
      expect(commentNotification.message).toBe(
        `${testUser2.displayName} commented on your post`
      );
    });
  });

  describe("sendLikeNotification", () => {
    it("should create like notification", async () => {
      await notificationService.sendLikeNotification({
        postId: "post-123",
        postAuthorStudentId: testUser1.studentId,
        likerStudentId: testUser2.studentId,
        likerDisplayName: testUser2.displayName,
      });

      const notifications = await Notification.find({
        toStudentId: testUser1.studentId,
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("like");
      expect(notifications[0].meta.postId).toBe("post-123");
    });

    it("should not create notification for self-like", async () => {
      await notificationService.sendLikeNotification({
        postId: "post-123",
        postAuthorStudentId: testUser1.studentId,
        likerStudentId: testUser1.studentId,
        likerDisplayName: testUser1.displayName,
      });

      const notifications = await Notification.find({
        toStudentId: testUser1.studentId,
      });
      expect(notifications).toHaveLength(0);
    });
  });

  describe("sendCommentNotification", () => {
    it("should create comment notification", async () => {
      await notificationService.sendCommentNotification({
        postId: "post-123",
        postAuthorStudentId: testUser1.studentId,
        commenterStudentId: testUser2.studentId,
        commenterDisplayName: testUser2.displayName,
        commentId: "comment-456",
        commentText: "Great post! Really enjoyed reading it.",
      });

      const notifications = await Notification.find({
        toStudentId: testUser1.studentId,
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("comment");
      expect(notifications[0].meta.commentText).toBe(
        "Great post! Really enjoyed reading it."
      );
    });

    it("should truncate long comment text", async () => {
      const longComment = "A".repeat(150);

      await notificationService.sendCommentNotification({
        postId: "post-123",
        postAuthorStudentId: testUser1.studentId,
        commenterStudentId: testUser2.studentId,
        commenterDisplayName: testUser2.displayName,
        commentId: "comment-456",
        commentText: longComment,
      });

      const notifications = await Notification.find({
        toStudentId: testUser1.studentId,
      });
      expect(notifications[0].meta.commentText).toHaveLength(100);
    });

    it("should not create notification for self-comment", async () => {
      await notificationService.sendCommentNotification({
        postId: "post-123",
        postAuthorStudentId: testUser1.studentId,
        commenterStudentId: testUser1.studentId,
        commenterDisplayName: testUser1.displayName,
        commentId: "comment-456",
        commentText: "My own comment",
      });

      const notifications = await Notification.find({
        toStudentId: testUser1.studentId,
      });
      expect(notifications).toHaveLength(0);
    });
  });

  describe("markNotificationsAsRead", () => {
    let testNotifications;

    beforeEach(async () => {
      testNotifications = await Promise.all([
        notificationService.createNotification({
          toStudentId: testUser1.studentId,
          type: "like",
          meta: { fromDisplayName: testUser2.displayName },
        }),
        notificationService.createNotification({
          toStudentId: testUser1.studentId,
          type: "comment",
          meta: { fromDisplayName: testUser2.displayName },
        }),
      ]);
    });

    it("should mark all notifications as read when no IDs provided", async () => {
      const result = await notificationService.markNotificationsAsRead(
        testUser1.studentId
      );

      expect(result.modifiedCount).toBe(2);

      const notifications = await Notification.find({
        toStudentId: testUser1.studentId,
      });
      expect(notifications.every((n) => n.isRead)).toBe(true);
    });

    it("should mark specific notifications as read", async () => {
      const result = await notificationService.markNotificationsAsRead(
        testUser1.studentId,
        [testNotifications[0]._id.toString()]
      );

      expect(result.modifiedCount).toBe(1);

      const notification1 = await Notification.findById(
        testNotifications[0]._id
      );
      const notification2 = await Notification.findById(
        testNotifications[1]._id
      );

      expect(notification1.isRead).toBe(true);
      expect(notification2.isRead).toBe(false);
    });
  });

  describe("getUnreadCount", () => {
    it("should return correct unread count", async () => {
      await Promise.all([
        notificationService.createNotification({
          toStudentId: testUser1.studentId,
          type: "like",
          meta: { fromDisplayName: testUser2.displayName },
        }),
        notificationService.createNotification({
          toStudentId: testUser1.studentId,
          type: "comment",
          meta: { fromDisplayName: testUser2.displayName },
        }),
      ]);

      const unreadCount = await notificationService.getUnreadCount(
        testUser1.studentId
      );
      expect(unreadCount).toBe(2);
    });

    it("should return zero for user with no notifications", async () => {
      const unreadCount = await notificationService.getUnreadCount(
        testUser2.studentId
      );
      expect(unreadCount).toBe(0);
    });
  });
});
