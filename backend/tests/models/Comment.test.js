const Comment = require("../../src/models/Comment");
const mongoose = require("mongoose");

describe("Comment Model", () => {
  beforeEach(async () => {
    await Comment.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validCommentData = {
      authorStudentId: "2025CS1001",
      content: "This is a test comment",
      parentType: "Post",
      parentId: new mongoose.Types.ObjectId(),
    };

    test("should create a valid comment", async () => {
      const comment = new Comment(validCommentData);
      const savedComment = await comment.save();

      expect(savedComment._id).toBeDefined();
      expect(savedComment.authorStudentId).toBe("2025CS1001");
      expect(savedComment.content).toBe("This is a test comment");
      expect(savedComment.parentType).toBe("Post");
      expect(savedComment.parentId).toEqual(validCommentData.parentId);
      expect(savedComment.level).toBe(0);
      expect(savedComment.votes).toBe(0);
      expect(savedComment.upvotes).toBe(0);
      expect(savedComment.downvotes).toBe(0);
      expect(savedComment.repliesCount).toBe(0);
      expect(savedComment.isActive).toBe(true);
      expect(savedComment.isDeleted).toBe(false);
      expect(savedComment.path).toBe(savedComment._id.toString());
    });

    test("should create a valid reply comment", async () => {
      // First create a parent comment
      const parentComment = new Comment(validCommentData);
      const savedParentComment = await parentComment.save();

      // Create a reply
      const replyData = {
        ...validCommentData,
        content: "This is a reply",
        parentCommentId: savedParentComment._id,
      };

      const reply = new Comment(replyData);
      const savedReply = await reply.save();

      expect(savedReply.level).toBe(1);
      expect(savedReply.parentCommentId).toEqual(savedParentComment._id);
      expect(savedReply.path).toBe(
        `${savedParentComment._id}/${savedReply._id}`
      );
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

    test("should require content", async () => {
      const commentData = { ...validCommentData };
      delete commentData.content;

      const comment = new Comment(commentData);
      await expect(comment.save()).rejects.toThrow(
        "Comment content is required"
      );
    });

    test("should validate content length", async () => {
      const emptyContent = new Comment({ ...validCommentData, content: "" });
      await expect(emptyContent.save()).rejects.toThrow(
        "Comment content is required"
      );

      const longContent = new Comment({
        ...validCommentData,
        content: "A".repeat(1001),
      });
      await expect(longContent.save()).rejects.toThrow(
        "Comment cannot exceed 1000 characters"
      );
    });

    test("should require parentType", async () => {
      const commentData = { ...validCommentData };
      delete commentData.parentType;

      const comment = new Comment(commentData);
      await expect(comment.save()).rejects.toThrow("Parent type is required");
    });

    test("should validate parentType enum", async () => {
      const comment = new Comment({
        ...validCommentData,
        parentType: "Invalid",
      });
      await expect(comment.save()).rejects.toThrow(
        "Parent type must be either Post or Topic"
      );
    });

    test("should require parentId", async () => {
      const commentData = { ...validCommentData };
      delete commentData.parentId;

      const comment = new Comment(commentData);
      await expect(comment.save()).rejects.toThrow("Parent ID is required");
    });

    test("should validate level limits", async () => {
      const comment = new Comment({ ...validCommentData, level: 6 });
      await expect(comment.save()).rejects.toThrow(
        "Maximum nesting level is 5"
      );
    });

    test("should trim content", async () => {
      const comment = new Comment({
        ...validCommentData,
        content: "  This is trimmed content  ",
      });
      const savedComment = await comment.save();

      expect(savedComment.content).toBe("This is trimmed content");
    });
  });

  describe("Instance Methods", () => {
    let comment;

    beforeEach(async () => {
      comment = new Comment({
        authorStudentId: "2025CS1001",
        content: "Test comment",
        parentType: "Post",
        parentId: new mongoose.Types.ObjectId(),
      });
      await comment.save();
    });

    test("should upvote comment", async () => {
      await comment.upvote();
      expect(comment.upvotes).toBe(1);
      expect(comment.votes).toBe(1);
    });

    test("should downvote comment", async () => {
      await comment.downvote();
      expect(comment.downvotes).toBe(1);
      expect(comment.votes).toBe(-1);
    });

    test("should remove upvote", async () => {
      comment.upvotes = 3;
      await comment.save();

      await comment.removeUpvote();
      expect(comment.upvotes).toBe(2);
      expect(comment.votes).toBe(2);
    });

    test("should not remove upvote below zero", async () => {
      await comment.removeUpvote();
      expect(comment.upvotes).toBe(0);
    });

    test("should remove downvote", async () => {
      comment.downvotes = 2;
      await comment.save();

      await comment.removeDownvote();
      expect(comment.downvotes).toBe(1);
      expect(comment.votes).toBe(-1);
    });

    test("should increment replies", async () => {
      await comment.incrementReplies();
      expect(comment.repliesCount).toBe(1);
    });

    test("should decrement replies", async () => {
      comment.repliesCount = 5;
      await comment.save();

      await comment.decrementReplies();
      expect(comment.repliesCount).toBe(4);
    });

    test("should not decrement replies below zero", async () => {
      await comment.decrementReplies();
      expect(comment.repliesCount).toBe(0);
    });

    test("should edit content", async () => {
      const newContent = "This is edited content";
      await comment.editContent(newContent);

      expect(comment.content).toBe(newContent);
      expect(comment.editedAt).toBeDefined();
      expect(comment.isEdited).toBe(true);
    });

    test("should soft delete comment", async () => {
      await comment.softDelete();

      expect(comment.isDeleted).toBe(true);
      expect(comment.deletedAt).toBeDefined();
      expect(comment.content).toBe("[deleted]");
    });

    test("should restore deleted comment", async () => {
      comment.isDeleted = true;
      comment.deletedAt = new Date();
      await comment.save();

      await comment.restore();
      expect(comment.isDeleted).toBe(false);
      expect(comment.deletedAt).toBeNull();
    });

    test("should get replies", async () => {
      // Create a reply to the comment
      const reply = new Comment({
        authorStudentId: "2025CS1002",
        content: "This is a reply",
        parentType: "Post",
        parentId: comment.parentId,
        parentCommentId: comment._id,
      });
      await reply.save();

      const replies = await comment.getReplies();
      expect(replies).toHaveLength(1);
      expect(replies[0].content).toBe("This is a reply");
    });
  });

  describe("Virtuals", () => {
    test("should calculate vote score", async () => {
      const comment = new Comment({
        authorStudentId: "2025CS1001",
        content: "Test comment",
        parentType: "Post",
        parentId: new mongoose.Types.ObjectId(),
        upvotes: 10,
        downvotes: 3,
      });

      expect(comment.voteScore).toBe(7);
    });

    test("should check if comment is edited", async () => {
      const comment = new Comment({
        authorStudentId: "2025CS1001",
        content: "Test comment",
        parentType: "Post",
        parentId: new mongoose.Types.ObjectId(),
      });

      expect(comment.isEdited).toBe(false);

      comment.editedAt = new Date();
      expect(comment.isEdited).toBe(true);
    });

    test("should check if comment has replies", async () => {
      const comment = new Comment({
        authorStudentId: "2025CS1001",
        content: "Test comment",
        parentType: "Post",
        parentId: new mongoose.Types.ObjectId(),
      });

      expect(comment.hasReplies).toBe(false);

      comment.repliesCount = 3;
      expect(comment.hasReplies).toBe(true);
    });
  });

  describe("Static Methods", () => {
    let postId, topicId;

    beforeEach(async () => {
      postId = new mongoose.Types.ObjectId();
      topicId = new mongoose.Types.ObjectId();

      const comments = [
        {
          authorStudentId: "2025CS1001",
          content: "First comment on post",
          parentType: "Post",
          parentId: postId,
          votes: 5,
        },
        {
          authorStudentId: "2025CS1001",
          content: "Second comment on post",
          parentType: "Post",
          parentId: postId,
          votes: 2,
        },
        {
          authorStudentId: "2025ECE1001",
          content: "Comment on topic",
          parentType: "Topic",
          parentId: topicId,
          votes: 8,
        },
        {
          authorStudentId: "2025CS1001",
          content: "Deleted comment",
          parentType: "Post",
          parentId: postId,
          isDeleted: true,
        },
        {
          authorStudentId: "2025CS1001",
          content: "Inactive comment",
          parentType: "Post",
          parentId: postId,
          isActive: false,
        },
      ];

      await Comment.insertMany(comments);
    });

    test("should find comments by parent", async () => {
      const comments = await Comment.findByParent("Post", postId);
      expect(comments).toHaveLength(2); // Only active, non-deleted comments

      const commentContents = comments.map((c) => c.content);
      expect(commentContents).toContain("First comment on post");
      expect(commentContents).toContain("Second comment on post");
      expect(commentContents).not.toContain("Deleted comment");
      expect(commentContents).not.toContain("Inactive comment");
    });

    test("should find comments by parent with popular sort", async () => {
      const comments = await Comment.findByParent("Post", postId, {
        sortBy: "popular",
      });
      expect(comments).toHaveLength(2);
      expect(comments[0].content).toBe("First comment on post"); // Higher votes first
    });

    test("should find comments by author", async () => {
      const comments = await Comment.findByAuthor("2025CS1001");
      expect(comments).toHaveLength(2); // Only active, non-deleted comments
    });

    test("should find top-level comments", async () => {
      const comments = await Comment.findTopLevel("Post", postId);
      expect(comments).toHaveLength(2);

      // All should be level 0
      comments.forEach((comment) => {
        expect(comment.level).toBe(0);
      });
    });

    test("should search comments by text", async () => {
      const comments = await Comment.searchComments("First");
      expect(comments).toHaveLength(1);
      expect(comments[0].content).toBe("First comment on post");
    });

    test("should get comment stats", async () => {
      const stats = await Comment.getCommentStats("2025CS1001");
      expect(stats).toHaveLength(1);
      expect(stats[0].totalComments).toBe(2);
      expect(stats[0].totalVotes).toBe(7); // 5 + 2
      expect(stats[0].averageVotes).toBe(3.5);
    });
  });

  describe("Threading", () => {
    let parentComment, reply1, reply2, nestedReply;

    beforeEach(async () => {
      const postId = new mongoose.Types.ObjectId();

      // Create parent comment
      parentComment = new Comment({
        authorStudentId: "2025CS1001",
        content: "Parent comment",
        parentType: "Post",
        parentId: postId,
      });
      await parentComment.save();

      // Create first reply
      reply1 = new Comment({
        authorStudentId: "2025CS1002",
        content: "First reply",
        parentType: "Post",
        parentId: postId,
        parentCommentId: parentComment._id,
      });
      await reply1.save();

      // Create second reply
      reply2 = new Comment({
        authorStudentId: "2025CS1003",
        content: "Second reply",
        parentType: "Post",
        parentId: postId,
        parentCommentId: parentComment._id,
      });
      await reply2.save();

      // Create nested reply (reply to reply1)
      nestedReply = new Comment({
        authorStudentId: "2025CS1004",
        content: "Nested reply",
        parentType: "Post",
        parentId: postId,
        parentCommentId: reply1._id,
      });
      await nestedReply.save();
    });

    test("should set correct levels for threaded comments", async () => {
      expect(parentComment.level).toBe(0);
      expect(reply1.level).toBe(1);
      expect(reply2.level).toBe(1);
      expect(nestedReply.level).toBe(2);
    });

    test("should set correct paths for threaded comments", async () => {
      expect(parentComment.path).toBe(parentComment._id.toString());
      expect(reply1.path).toBe(`${parentComment._id}/${reply1._id}`);
      expect(reply2.path).toBe(`${parentComment._id}/${reply2._id}`);
      expect(nestedReply.path).toBe(
        `${parentComment._id}/${reply1._id}/${nestedReply._id}`
      );
    });

    test("should find threaded comments", async () => {
      const comments = await Comment.findThreaded(
        "Post",
        parentComment.parentId
      );
      expect(comments).toHaveLength(4);

      // Should be sorted by path and creation time
      expect(comments[0]._id).toEqual(parentComment._id);
    });

    test("should get thread for a comment", async () => {
      const thread = await parentComment.getThread();
      expect(thread).toHaveLength(4); // Parent + all replies in the thread
    });
  });

  describe("JSON Transform", () => {
    test("should hide content for deleted comments", async () => {
      const comment = new Comment({
        authorStudentId: "2025CS1001",
        content: "This will be deleted",
        parentType: "Post",
        parentId: new mongoose.Types.ObjectId(),
        isDeleted: true,
      });

      const json = comment.toJSON();
      expect(json.content).toBe("[deleted]");
    });

    test("should show content for non-deleted comments", async () => {
      const comment = new Comment({
        authorStudentId: "2025CS1001",
        content: "This is visible content",
        parentType: "Post",
        parentId: new mongoose.Types.ObjectId(),
      });

      const json = comment.toJSON();
      expect(json.content).toBe("This is visible content");
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Comment.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(
        indexNames.some((name) => name.includes("parentType_1_parentId_1"))
      ).toBe(true);
      expect(
        indexNames.some((name) => name.includes("authorStudentId_1"))
      ).toBe(true);
      expect(
        indexNames.some((name) => name.includes("parentCommentId_1"))
      ).toBe(true);
      expect(indexNames.some((name) => name.includes("path_1"))).toBe(true);
    });
  });
});
