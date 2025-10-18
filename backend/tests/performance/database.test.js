const mongoose = require("mongoose");
const User = require("../../src/models/User");
const Post = require("../../src/models/Post");
const Topic = require("../../src/models/Topic");
const Comment = require("../../src/models/Comment");
const Notification = require("../../src/models/Notification");

describe("Database Performance Tests", () => {
  beforeAll(async () => {
    // Ensure indexes are created
    await User.createIndexes();
    await Post.createIndexes();
    await Topic.createIndexes();
    await Comment.createIndexes();
    await Notification.createIndexes();
  });

  beforeEach(async () => {
    // Clean up before each test
    await User.deleteMany({});
    await Post.deleteMany({});
    await Topic.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});
  });

  describe("User Queries", () => {
    beforeEach(async () => {
      // Create test data
      const users = [];
      for (let i = 1; i <= 1000; i++) {
        users.push({
          studentId: `2025CS${i.toString().padStart(4, "0")}`,
          email: `user${i}@college.edu`,
          displayName: `User ${i}`,
          year: (i % 4) + 1,
          department: ["CS", "ECE", "ME", "CE"][i % 4],
          section: ["A", "B", "C"][i % 3],
        });
      }
      await User.insertMany(users);
    });

    it("should find user by studentId efficiently", async () => {
      const startTime = Date.now();

      const user = await User.findByStudentId("2025CS0500");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(user).toBeTruthy();
      expect(user.studentId).toBe("2025CS0500");
      expect(queryTime).toBeLessThan(50); // Should complete in under 50ms
    });

    it("should find users by year/department/section efficiently", async () => {
      const startTime = Date.now();

      const users = await User.findByYearDeptSection(3, "CS", "A");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(users.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it("should search users by text efficiently", async () => {
      const startTime = Date.now();

      const users = await User.searchUsers("User 1");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(users.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(200); // Text search may take longer
    });

    it("should handle concurrent user lookups", async () => {
      const startTime = Date.now();

      const promises = [];
      for (let i = 1; i <= 50; i++) {
        const studentId = `2025CS${i.toString().padStart(4, "0")}`;
        promises.push(User.findByStudentId(studentId));
      }

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(50);
      expect(results.every((user) => user !== null)).toBe(true);
      expect(totalTime).toBeLessThan(500); // 50 concurrent queries in under 500ms
    });
  });

  describe("Post Queries", () => {
    beforeEach(async () => {
      // Create test users
      const users = [];
      for (let i = 1; i <= 100; i++) {
        users.push({
          studentId: `2025CS${i.toString().padStart(4, "0")}`,
          email: `user${i}@college.edu`,
          displayName: `User ${i}`,
          year: (i % 4) + 1,
          department: "CS",
          section: "A",
        });
      }
      await User.insertMany(users);

      // Create test posts
      const posts = [];
      for (let i = 1; i <= 5000; i++) {
        const authorIndex = (i % 100) + 1;
        posts.push({
          authorStudentId: `2025CS${authorIndex.toString().padStart(4, "0")}`,
          type: "text",
          text: `This is test post number ${i}`,
          visibility: ["public", "year", "dept", "section"][i % 4],
          tags: [`tag${i % 10}`, `category${i % 5}`],
          likesCount: Math.floor(Math.random() * 100),
          commentsCount: Math.floor(Math.random() * 50),
          createdAt: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
          ), // Random date within last 30 days
        });
      }
      await Post.insertMany(posts);
    });

    it("should get feed with pagination efficiently", async () => {
      const startTime = Date.now();

      const posts = await Post.getFeed({
        visibility: "public",
        limit: 20,
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(posts).toHaveLength(20);
      expect(queryTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it("should find posts by author efficiently", async () => {
      const startTime = Date.now();

      const posts = await Post.findByAuthor("2025CS0050");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(posts.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(50);
    });

    it("should find posts by tags efficiently", async () => {
      const startTime = Date.now();

      const posts = await Post.findByTags(["tag1", "tag2"]);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(posts.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100);
    });

    it("should search posts by text efficiently", async () => {
      const startTime = Date.now();

      const posts = await Post.searchPosts("test post");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(posts.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(200); // Text search may take longer
    });

    it("should handle cursor-based pagination efficiently", async () => {
      // Get first page
      const firstPageStart = Date.now();
      const firstPage = await Post.getFeed({ limit: 20 });
      const firstPageTime = Date.now() - firstPageStart;

      expect(firstPage).toHaveLength(20);
      expect(firstPageTime).toBeLessThan(100);

      // Get second page using cursor
      const cursor = firstPage[firstPage.length - 1].createdAt.toISOString();
      const secondPageStart = Date.now();
      const secondPage = await Post.getFeed({ cursor, limit: 20 });
      const secondPageTime = Date.now() - secondPageStart;

      expect(secondPage).toHaveLength(20);
      expect(secondPageTime).toBeLessThan(100);

      // Ensure no overlap
      const firstPageIds = firstPage.map((p) => p._id.toString());
      const secondPageIds = secondPage.map((p) => p._id.toString());
      const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe("Topic Queries", () => {
    beforeEach(async () => {
      // Create test topics
      const topics = [];
      for (let i = 1; i <= 2000; i++) {
        topics.push({
          title: `Topic ${i}: Discussion about subject ${i}`,
          body: `This is the body of topic ${i}. It contains detailed discussion about the subject matter.`,
          authorStudentId: `2025CS${((i % 100) + 1)
            .toString()
            .padStart(4, "0")}`,
          tags: [`subject${i % 20}`, `category${i % 10}`],
          votes: Math.floor(Math.random() * 200) - 100, // Random votes between -100 and 100
          commentsCount: Math.floor(Math.random() * 50),
          viewsCount: Math.floor(Math.random() * 1000),
          createdAt: new Date(
            Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000
          ), // Random date within last 60 days
        });
      }
      await Topic.insertMany(topics);
    });

    it("should find popular topics efficiently", async () => {
      const startTime = Date.now();

      const topics = await Topic.findPopular({ limit: 20 });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(topics).toHaveLength(20);
      expect(queryTime).toBeLessThan(100);

      // Verify sorting by votes (descending)
      for (let i = 1; i < topics.length; i++) {
        expect(topics[i - 1].votes).toBeGreaterThanOrEqual(topics[i].votes);
      }
    });

    it("should find recent topics efficiently", async () => {
      const startTime = Date.now();

      const topics = await Topic.findRecent({ limit: 20 });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(topics).toHaveLength(20);
      expect(queryTime).toBeLessThan(100);

      // Verify sorting by creation date (descending)
      for (let i = 1; i < topics.length; i++) {
        expect(topics[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          topics[i].createdAt.getTime()
        );
      }
    });

    it("should find topics by tags efficiently", async () => {
      const startTime = Date.now();

      const topics = await Topic.findByTags(["subject1", "subject2"]);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(topics.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100);
    });

    it("should search topics efficiently", async () => {
      const startTime = Date.now();

      const topics = await Topic.searchTopics("Discussion");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(topics.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(200);
    });
  });

  describe("Comment Queries", () => {
    let testPost, testTopic;

    beforeEach(async () => {
      // Create test post and topic
      testPost = new Post({
        authorStudentId: "2025CS0001",
        type: "text",
        text: "Test post for comments",
        visibility: "public",
      });
      await testPost.save();

      testTopic = new Topic({
        title: "Test Topic for Comments",
        body: "This is a test topic for comment performance testing",
        authorStudentId: "2025CS0001",
      });
      await testTopic.save();

      // Create many comments
      const comments = [];
      for (let i = 1; i <= 3000; i++) {
        const isPostComment = i % 2 === 0;
        comments.push({
          authorStudentId: `2025CS${((i % 100) + 1)
            .toString()
            .padStart(4, "0")}`,
          entityType: isPostComment ? "Post" : "Topic",
          entityId: isPostComment ? testPost._id : testTopic._id,
          text: `This is comment number ${i}`,
          likesCount: Math.floor(Math.random() * 20),
          createdAt: new Date(
            Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
          ), // Random date within last 7 days
        });
      }
      await Comment.insertMany(comments);
    });

    it("should find comments by entity efficiently", async () => {
      const startTime = Date.now();

      const comments = await Comment.findByEntity("Post", testPost._id);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(comments.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100);
    });

    it("should get comment thread efficiently", async () => {
      const startTime = Date.now();

      const thread = await Comment.getCommentThread("Post", testPost._id);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(thread.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(150);
    });

    it("should find comments by author efficiently", async () => {
      const startTime = Date.now();

      const comments = await Comment.findByAuthor("2025CS0050");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(comments.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100);
    });
  });

  describe("Notification Queries", () => {
    beforeEach(async () => {
      // Create test notifications
      const notifications = [];
      for (let i = 1; i <= 10000; i++) {
        const recipientIndex = (i % 100) + 1;
        const senderIndex = ((i + 50) % 100) + 1;
        notifications.push({
          toStudentId: `2025CS${recipientIndex.toString().padStart(4, "0")}`,
          type: ["like", "comment", "follow", "message"][i % 4],
          title: `Notification ${i}`,
          message: `This is notification number ${i}`,
          meta: {
            fromStudentId: `2025CS${senderIndex.toString().padStart(4, "0")}`,
            entityType: "Post",
            entityId: new mongoose.Types.ObjectId(),
          },
          isRead: Math.random() > 0.7, // 30% read
          createdAt: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
          ), // Random date within last 30 days
        });
      }
      await Notification.insertMany(notifications);
    });

    it("should find notifications for user efficiently", async () => {
      const startTime = Date.now();

      const notifications = await Notification.findForUser("2025CS0050");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(notifications.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100);
    });

    it("should find unread notifications efficiently", async () => {
      const startTime = Date.now();

      const notifications = await Notification.findUnreadForUser("2025CS0050");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(notifications.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100);
    });

    it("should get unread count efficiently", async () => {
      const startTime = Date.now();

      const count = await Notification.getUnreadCount("2025CS0050");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(typeof count).toBe("number");
      expect(queryTime).toBeLessThan(50);
    });

    it("should handle bulk mark as read efficiently", async () => {
      const startTime = Date.now();

      const result = await Notification.markAllAsReadForUser("2025CS0050");

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(result.modifiedCount).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(200);
    });
  });

  describe("Index Effectiveness", () => {
    it("should use indexes for user queries", async () => {
      // Create a user
      const user = new User({
        studentId: "2025CS9999",
        email: "test@college.edu",
        displayName: "Test User",
        year: 3,
        department: "CS",
        section: "A",
      });
      await user.save();

      // Explain query to check index usage
      const explanation = await User.collection
        .find({ studentId: "2025CS9999" })
        .explain("executionStats");

      expect(explanation.executionStats.executionSuccess).toBe(true);
      expect(explanation.executionStats.totalDocsExamined).toBeLessThanOrEqual(
        1
      );
    });

    it("should use indexes for post feed queries", async () => {
      // Create some posts
      const posts = [];
      for (let i = 1; i <= 100; i++) {
        posts.push({
          authorStudentId: "2025CS0001",
          type: "text",
          text: `Post ${i}`,
          visibility: "public",
          createdAt: new Date(Date.now() - i * 1000),
        });
      }
      await Post.insertMany(posts);

      // Explain query to check index usage
      const explanation = await Post.collection
        .find({ isActive: true, visibility: "public" })
        .sort({ createdAt: -1 })
        .limit(20)
        .explain("executionStats");

      expect(explanation.executionStats.executionSuccess).toBe(true);
      // Should use index for sorting
      expect(explanation.executionStats.totalDocsExamined).toBeLessThanOrEqual(
        20
      );
    });
  });

  describe("Memory Usage", () => {
    it("should handle large result sets without excessive memory usage", async () => {
      // Create many posts
      const posts = [];
      for (let i = 1; i <= 1000; i++) {
        posts.push({
          authorStudentId: "2025CS0001",
          type: "text",
          text: `Memory test post ${i}`,
          visibility: "public",
        });
      }
      await Post.insertMany(posts);

      const initialMemory = process.memoryUsage().heapUsed;

      // Query with cursor to avoid loading all into memory
      const cursor = Post.find({ authorStudentId: "2025CS0001" }).cursor();

      let count = 0;
      for (
        let doc = await cursor.next();
        doc != null;
        doc = await cursor.next()
      ) {
        count++;
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(count).toBe(1000);
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
