const Comment = require("../../src/models/Comment");
const Post = require("../../src/models/Post");
const Topic = require("../../src/models/Topic");

describe("Comment Model", () => {
  beforeEach(async () => {
    await Comment.deleteMany({});
    await Post.deleteMany({});
    await Topic.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validCommentData = {
      authorStudentId: "2025CS1001",
      entityType: "Post",
      entityId: "507f1f77bcf86cd799439011",
      text: "This is a test comment",
    };

    test("should create a valid comment", async () => {
      const comment = new Comment(validCommentData);
      const savedComment = await comment.save();

      expect(savedComment._id).toBeDefined();
      expect(savedComment.authorStudentId).toBe("2025CS1001");
      expect(savedComment.entityType).toBe("Post");
      expect(savedComment.text).toBe("This is a test comment");
      expect(savedComment.likesCount).toBe(0);
      expect(savedComment.repliesCount).toBe(0);
      expect(savedComment.isActive).toBe(true);
      expect(savedComment.createdAt).toBeDefined();
    });

    test("should require authorStudentId", async () => {
      const commentData = { ...validCommentData };
      delete commentData.authorStudentId;

      const comment = new Comment(commentData);
      await expect(comment.save()).rejects.toThrow(
        "Author student ID is required"
      );
    });

    test("should validate authorStudentId format", async () => {
      const invalidIds = ["invalid", "2025CS", "CS1001", "25CS1001"];

      for (const invalidId of invalidIds) {
        const comment = new Comment({
          ...validCommentData,
          authorStudentId: invalidId,
        });
        await expect(comment.save()).rejects.toThrow(
          "Author student ID must follow format"
        );
      }
    });

    test("should require entityType", async () => {
      const commentData = { ...validCommentData };
      delete commentData.entityType;

      const comment = new Comment(commentData);
      await expect(comment.save()).rejects.toThrow("Entity type is required");
    });

    test("should validate entityType enum", async () => {
      const comment = new Comment({
        ...validCommentData,
        entityType: "Invalid",
      });
      await expect(comment.save()).rejects.toThrow(
        "Entity type must be either Post or Topic"
      );
    });

    test("should require entityId", async () => {
      const commentData = { ...validCommentData };
      delete commentData.entityId;

      const comment = new Comment(commentData);
      await expect(comment.save()).rejects.toThrow("Entity ID is required");
    });

    test("should validate entityId format", async () => {
      const comment = new Comment({
        ...validCommentData,
        entityId: "invalid-id",
      });
      await expect(comment.save()).rejects.toThrow(
        "Entity ID must be a valid ObjectId"
      );
    });

    test("should require text", async () => {
      const commentData = { ...validCommentData };
      delete commentData.text;

      const comment = new Comment(commentData);
      await expect(comment.save()).rejects.toThrow("Comment text is required");
    });

    test("should validate text length", async () => {
      const comment = new Comment({
        ...validCommentData,
        text: "A".repeat(1001),
      });
      await expect(comment.save()).rejects.toThrow(
        "Comment text cannot exceed 1000 characters"
      );
    });

    test("should validate parentId format when provided", async () => {
      const comment = new Comment({
        ...validCommentData,
        parentId: "invalid-id",
      });
      await expect(comment.save()).rejects.toThrow(
        "Parent ID must be a valid ObjectId"
      );
    });

    test("should trim text content", async () => {
      const comment = new Comment({
        ...validCommentData,
        text: "  This is trimmed text  ",
      });
      const savedComment = await comment.save();

      expect(savedComment.text).toBe("This is trimmed text");
    });
  });

  describe("Instance Methods", () => {
    let comment;

    beforeEach(async () => {
      comment = new Comment({
        authorStudentId: "2025CS1001",
        entityType: "Post",
        entityId: "507f1f77bcf86cd799439011",
        text: "Test comment",
      });
      await comment.save();
    });

    test("should increment likes", async () => {
      await comment.incrementLikes();
      expect(comment.likesCount).toBe(1);

      await comment.incrementLikes();
      expect(comment.likesCount).toBe(2);
    });

    test("should decrement likes", async () => {
      comment.likesCount = 5;
      await comment.save();

      await comment.decrementLikes();
      expect(comment.likesCount).toBe(4);
    });

    test("should not decrement likes below zero", async () => {
      await comment.decrementLikes();
      expect(comment.likesCount).toBe(0);
    });

    test("should increment replies", async () => {
      await comment.incrementReplies();
      expect(comment.repliesCount).toBe(1);
    });

    test("should decrement replies", async () => {
      comment.repliesCount = 3;
      await comment.save();

      await comment.decrementReplies();
      expect(comment.repliesCount).toBe(2);
    });

    test("should not decrement replies below zero", async () => {
      await comment.decrementReplies();
      expect(comment.repliesCount).toBe(0);
    });

    test("should mark as inactive", async () => {
      await comment.markAsInactive();
      expect(comment.isActive).toBe(false);
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const comments = [
        {
          authorStudentId: "2025CS1001",
          entityType: "Post",
          entityId: "507f1f77bcf86cd799439011",
          text: "First comment",
        },
        {
          authorStudentId: "2025CS1002",
          entityType: "Post",
          entityId: "507f1f77bcf86cd799439011",
          text: "Second comment",
        },
        {
          authorStudentId: "2025CS1001",
          entityType: "Topic",
          entityId: "507f1f77bcf86cd799439012",
          text: "Topic comment",
        },
        {
          authorStudentId: "2025CS1001",
          entityType: "Post",
          entityId: "507f1f77bcf86cd799439011",
          text: "Inactive comment",
          isActive: false,
        },
      ];

      await Comment.insertMany(comments);
    });

    test("should find comments by entity", async () => {
      const comments = await Comment.findByEntity(
        "Post",
        "507f1f77bcf86cd799439011"
      );
      expect(comments).toHaveLength(2); // Only active comments
      const commentTexts = comments.map((c) => c.text);
      expect(commentTexts).toContain("First comment");
      expect(commentTexts).toContain("Second comment");
    });

    test("should find comments by author", async () => {
      const comments = await Comment.findByAuthor("2025CS1001");
      expect(comments).toHaveLength(2); // Only active comments
    });

    test("should get comment thread", async () => {
      // Create parent comment
      const parentComment = new Comment({
        authorStudentId: "2025CS1001",
        entityType: "Post",
        entityId: "507f1f77bcf86cd799439013",
        text: "Parent comment",
      });
      await parentComment.save();

      // Create replies
      const reply1 = new Comment({
        authorStudentId: "2025CS1002",
        entityType: "Post",
        entityId: "507f1f77bcf86cd799439013",
        text: "Reply 1",
        parentId: parentComment._id,
      });
      await reply1.save();

      const reply2 = new Comment({
        authorStudentId: "2025CS1003",
        entityType: "Post",
        entityId: "507f1f77bcf86cd799439013",
        text: "Reply 2",
        parentId: parentComment._id,
      });
      await reply2.save();

      const thread = await Comment.getCommentThread(
        "Post",
        "507f1f77bcf86cd799439013"
      );
      expect(thread).toHaveLength(3);
    });

    test("should get comment stats", async () => {
      const stats = await Comment.getCommentStats("2025CS1001");
      expect(stats.totalComments).toBe(2);
      expect(stats.totalLikes).toBe(0);
    });
  });

  describe("Virtuals", () => {
    test("should check if comment is reply", async () => {
      const parentComment = new Comment({
        authorStudentId: "2025CS1001",
        entityType: "Post",
        entityId: "507f1f77bcf86cd799439011",
        text: "Parent comment",
      });
      expect(parentComment.isReply).toBe(false);

      const replyComment = new Comment({
        authorStudentId: "2025CS1002",
        entityType: "Post",
        entityId: "507f1f77bcf86cd799439011",
        text: "Reply comment",
        parentId: "507f1f77bcf86cd799439014",
      });
      expect(replyComment.isReply).toBe(true);
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Comment.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(
        indexNames.some((name) => name.includes("entityType_1_entityId_1"))
      ).toBe(true);
      expect(
        indexNames.some((name) => name.includes("authorStudentId_1"))
      ).toBe(true);
      expect(indexNames.some((name) => name.includes("createdAt_-1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("parentId_1"))).toBe(true);
    });
  });
});
