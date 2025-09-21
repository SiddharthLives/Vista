const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../src/server");
const Post = require("../../src/models/Post");
const User = require("../../src/models/User");
const Comment = require("../../src/models/Comment");
const jwtService = require("../../src/services/jwtService");

describe("Posts API", () => {
  let testUser1, testUser2, authToken1, authToken2;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri =
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/college-social-media-test";
    await mongoose.connect(mongoUri);
  });

  beforeEach(async () => {
    // Clean up database
    await Post.deleteMany({});
    await User.deleteMany({});
    await Comment.deleteMany({});

    // Create test users
    testUser1 = await User.create({
      studentId: "2025CS1001",
      email: "student1@college.edu",
      displayName: "Test Student 1",
      year: 3,
      department: "CS",
      section: "A",
      bio: "Test bio 1",
    });

    testUser2 = await User.create({
      studentId: "2025CS1002",
      email: "student2@college.edu",
      displayName: "Test Student 2",
      year: 3,
      department: "CS",
      section: "B",
      bio: "Test bio 2",
    });

    // Generate auth tokens
    authToken1 = jwtService.generateToken({
      studentId: testUser1.studentId,
      email: testUser1.email,
      uid: "firebase-uid-1",
    });

    authToken2 = jwtService.generateToken({
      studentId: testUser2.studentId,
      email: testUser2.email,
      uid: "firebase-uid-2",
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("GET /posts", () => {
    beforeEach(async () => {
      // Create test posts
      await Post.create([
        {
          authorStudentId: testUser1.studentId,
          type: "text",
          text: "First post",
          visibility: "public",
          tags: ["test", "first"],
        },
        {
          authorStudentId: testUser2.studentId,
          type: "image",
          text: "Second post with image",
          media: [
            {
              url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
              cloudinaryPublicId:
                "college/3-CS/dept-CS/section-B/student-2025CS1002/test.jpg",
              width: 800,
              height: 600,
            },
          ],
          visibility: "public",
          tags: ["test", "image"],
        },
        {
          authorStudentId: testUser1.studentId,
          type: "text",
          text: "Private post",
          visibility: "section",
          tags: ["private"],
        },
      ]);
    });

    it("should get public posts without authentication", async () => {
      const response = await request(app).get("/posts").expect(200);

      expect(response.body.posts).toHaveLength(2);
      expect(response.body.posts[0].text).toBe("Second post with image");
      expect(response.body.posts[1].text).toBe("First post");
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it("should get posts with authentication and visibility filtering", async () => {
      const response = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(3);
      expect(response.body.posts.some((p) => p.text === "Private post")).toBe(
        true
      );
    });

    it("should filter posts by author", async () => {
      const response = await request(app)
        .get("/posts")
        .query({ authorStudentId: testUser1.studentId })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].authorStudentId).toBe(testUser1.studentId);
    });

    it("should filter posts by tags", async () => {
      const response = await request(app)
        .get("/posts")
        .query({ tags: "image" })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].tags).toContain("image");
    });

    it("should implement cursor-based pagination", async () => {
      // Create additional posts to ensure we have enough for pagination
      await Post.create({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Fourth post for pagination",
        visibility: "public",
        tags: ["pagination"],
      });

      await Post.create({
        authorStudentId: testUser2.studentId,
        type: "text",
        text: "Fifth post for pagination",
        visibility: "public",
        tags: ["pagination"],
      });

      const firstResponse = await request(app)
        .get("/posts")
        .query({ limit: 2 })
        .expect(200);

      expect(firstResponse.body.posts).toHaveLength(2);
      expect(firstResponse.body.pagination.hasMore).toBe(true);
      expect(firstResponse.body.pagination.nextCursor).toBeDefined();

      const secondResponse = await request(app)
        .get("/posts")
        .query({
          limit: 2,
          cursor: firstResponse.body.pagination.nextCursor,
        })
        .expect(200);

      expect(secondResponse.body.posts.length).toBeGreaterThan(0);
      expect(secondResponse.body.posts[0]._id).not.toBe(
        firstResponse.body.posts[0]._id
      );
    });

    it("should search posts by text", async () => {
      const response = await request(app)
        .get("/posts")
        .query({ search: "image" })
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].text).toContain("image");
    });

    it("should validate query parameters", async () => {
      await request(app).get("/posts").query({ limit: 100 }).expect(400);

      await request(app)
        .get("/posts")
        .query({ visibility: "invalid" })
        .expect(400);

      await request(app)
        .get("/posts")
        .query({ authorStudentId: "invalid" })
        .expect(400);
    });
  });

  describe("POST /posts", () => {
    it("should create a text post", async () => {
      const postData = {
        type: "text",
        text: "This is a test post",
        visibility: "public",
        tags: ["test", "new"],
      };

      const response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(postData)
        .expect(201);

      expect(response.body.message).toBe("Post created successfully");
      expect(response.body.post.text).toBe(postData.text);
      expect(response.body.post.authorStudentId).toBe(testUser1.studentId);
      expect(response.body.post.author.displayName).toBe(testUser1.displayName);
    });

    it("should create an image post with media", async () => {
      const postData = {
        type: "image",
        text: "Check out this image",
        media: [
          {
            url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
            cloudinaryPublicId:
              "college/3-CS/dept-CS/section-A/student-2025CS1001/test.jpg",
            width: 800,
            height: 600,
          },
        ],
        visibility: "public",
      };

      const response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(postData)
        .expect(201);

      expect(response.body.post.type).toBe("image");
      expect(response.body.post.media).toHaveLength(1);
      expect(response.body.post.media[0].url).toBe(postData.media[0].url);
    });

    it("should reject post without authentication", async () => {
      const postData = {
        type: "text",
        text: "This should fail",
      };

      await request(app).post("/posts").send(postData).expect(401);
    });

    it("should validate media ownership", async () => {
      const postData = {
        type: "image",
        text: "Trying to use someone else's media",
        media: [
          {
            url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
            cloudinaryPublicId:
              "college/3-CS/dept-CS/section-B/student-2025CS1002/test.jpg", // Wrong user
            width: 800,
            height: 600,
          },
        ],
      };

      const response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(postData)
        .expect(403);

      expect(response.body.error.code).toBe("INVALID_MEDIA_OWNERSHIP");
    });

    it("should validate post data", async () => {
      // Invalid post type
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ type: "invalid" })
        .expect(400);

      // Text too long
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "a".repeat(2001),
        })
        .expect(400);

      // Invalid visibility
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "test",
          visibility: "invalid",
        })
        .expect(400);
    });

    it("should require media for image/video posts", async () => {
      const response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "image",
          text: "Image post without media",
        })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should require text for text posts", async () => {
      const response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
        })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /posts/:id", () => {
    let testPost;

    beforeEach(async () => {
      testPost = await Post.create({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post for individual fetch",
        visibility: "public",
      });
    });

    it("should get a specific post", async () => {
      const response = await request(app)
        .get(`/posts/${testPost._id}`)
        .expect(200);

      expect(response.body.post._id).toBe(testPost._id.toString());
      expect(response.body.post.text).toBe(testPost.text);
      expect(response.body.post.author.displayName).toBe(testUser1.displayName);
    });

    it("should return 404 for non-existent post", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app).get(`/posts/${fakeId}`).expect(404);
    });

    it("should validate post ID format", async () => {
      await request(app).get("/posts/invalid-id").expect(400);
    });

    it("should check visibility permissions", async () => {
      const privatePost = await Post.create({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Private post",
        visibility: "section",
      });

      // Should work with authentication from same section
      await request(app)
        .get(`/posts/${privatePost._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      // Should fail without authentication
      await request(app).get(`/posts/${privatePost._id}`).expect(403);

      // Should fail with authentication from different section
      await request(app)
        .get(`/posts/${privatePost._id}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(403);
    });
  });

  describe("POST /posts/:id/like", () => {
    let testPost;

    beforeEach(async () => {
      testPost = await Post.create({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post for liking",
        visibility: "public",
      });
    });

    it("should like a post", async () => {
      const response = await request(app)
        .post(`/posts/${testPost._id}/like`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.message).toBe("Post liked successfully");
      expect(response.body.likesCount).toBe(1);

      // Verify in database
      const updatedPost = await Post.findById(testPost._id);
      expect(updatedPost.likesCount).toBe(1);
    });

    it("should require authentication", async () => {
      await request(app).post(`/posts/${testPost._id}/like`).expect(401);
    });

    it("should return 404 for non-existent post", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/posts/${fakeId}/like`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);
    });

    it("should check visibility permissions", async () => {
      const privatePost = await Post.create({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Private post",
        visibility: "section",
      });

      await request(app)
        .post(`/posts/${privatePost._id}/like`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(403);
    });
  });

  describe("POST /posts/:id/comment", () => {
    let testPost;

    beforeEach(async () => {
      testPost = await Post.create({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post for commenting",
        visibility: "public",
      });
    });

    it("should add a comment to a post", async () => {
      const commentData = {
        content: "This is a test comment",
      };

      const response = await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send(commentData)
        .expect(201);

      expect(response.body.message).toBe("Comment added successfully");
      expect(response.body.comment.content).toBe(commentData.content);
      expect(response.body.comment.authorStudentId).toBe(testUser2.studentId);
      expect(response.body.comment.author.displayName).toBe(
        testUser2.displayName
      );
      expect(response.body.post.commentsCount).toBe(1);

      // Verify in database
      const updatedPost = await Post.findById(testPost._id);
      expect(updatedPost.commentsCount).toBe(1);
    });

    it("should add a reply to a comment", async () => {
      // First, create a comment
      const parentComment = await Comment.create({
        authorStudentId: testUser1.studentId,
        content: "Parent comment",
        parentType: "Post",
        parentId: testPost._id,
      });

      const replyData = {
        content: "This is a reply",
        parentCommentId: parentComment._id,
      };

      const response = await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send(replyData)
        .expect(201);

      expect(response.body.comment.parentCommentId).toBe(
        parentComment._id.toString()
      );
      expect(response.body.comment.level).toBe(1);
    });

    it("should require authentication", async () => {
      await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .send({ content: "Test comment" })
        .expect(401);
    });

    it("should validate comment content", async () => {
      // Empty content
      await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ content: "" })
        .expect(400);

      // Content too long
      await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ content: "a".repeat(1001) })
        .expect(400);
    });

    it("should return 404 for non-existent post", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/posts/${fakeId}/comment`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ content: "Test comment" })
        .expect(404);
    });

    it("should return 404 for non-existent parent comment", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          content: "Test reply",
          parentCommentId: fakeId,
        })
        .expect(404);
    });
  });

  describe("GET /posts/:id/comments", () => {
    let testPost, comment1, comment2, reply1;

    beforeEach(async () => {
      testPost = await Post.create({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post for comments",
        visibility: "public",
      });

      comment1 = await Comment.create({
        authorStudentId: testUser1.studentId,
        content: "First comment",
        parentType: "Post",
        parentId: testPost._id,
        upvotes: 5,
        downvotes: 0,
      });

      comment2 = await Comment.create({
        authorStudentId: testUser2.studentId,
        content: "Second comment",
        parentType: "Post",
        parentId: testPost._id,
        upvotes: 2,
        downvotes: 0,
      });

      // Create the reply manually with correct path and level
      const replyId = new mongoose.Types.ObjectId();
      reply1 = new Comment({
        _id: replyId,
        authorStudentId: testUser2.studentId,
        content: "Reply to first comment",
        parentType: "Post",
        parentId: testPost._id,
        parentCommentId: comment1._id,
        level: 1,
        path: `${comment1._id}/${replyId}`,
      });
      await reply1.save();
    });

    it("should get top-level comments for a post", async () => {
      const response = await request(app)
        .get(`/posts/${testPost._id}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(2);
      expect(response.body.comments[0].content).toBe("Second comment");
      expect(response.body.comments[1].content).toBe("First comment");
    });

    it("should get comments sorted by popularity", async () => {
      const response = await request(app)
        .get(`/posts/${testPost._id}/comments`)
        .query({ sortBy: "popular" })
        .expect(200);

      expect(response.body.comments).toHaveLength(2);
      expect(response.body.comments[0].content).toBe("First comment"); // Higher votes
      expect(response.body.comments[1].content).toBe("Second comment");
    });

    it("should get replies to a specific comment", async () => {
      // Verify the reply was created correctly
      const replyCheck = await Comment.findById(reply1._id);
      expect(replyCheck).toBeTruthy();
      expect(replyCheck.parentCommentId.toString()).toBe(
        comment1._id.toString()
      );
      expect(replyCheck.level).toBe(1);

      // Test the getReplies method directly
      const directReplies = await comment1.getReplies();
      expect(directReplies).toHaveLength(1);
      expect(directReplies[0].content).toBe("Reply to first comment");

      const response = await request(app)
        .get(`/posts/${testPost._id}/comments`)
        .query({ parentCommentId: comment1._id })
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].content).toBe("Reply to first comment");
      expect(response.body.comments[0].level).toBe(1);
    });

    it("should limit number of comments", async () => {
      const response = await request(app)
        .get(`/posts/${testPost._id}/comments`)
        .query({ limit: 1 })
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
    });

    it("should return 404 for non-existent post", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app).get(`/posts/${fakeId}/comments`).expect(404);
    });

    it("should check visibility permissions", async () => {
      const privatePost = await Post.create({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Private post",
        visibility: "section",
      });

      // Should fail without authentication
      await request(app).get(`/posts/${privatePost._id}/comments`).expect(403);

      // Should work with proper authentication
      await request(app)
        .get(`/posts/${privatePost._id}/comments`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);
    });
  });
});
