const request = require("supertest");
const app = require("../../src/server");
const Post = require("../../src/models/Post");
const User = require("../../src/models/User");
const jwtService = require("../../src/services/jwtService");

describe("Posts API Integration", () => {
  let authToken1, authToken2;
  let testUser1, testUser2;

  beforeEach(async () => {
    // Clean up database
    await Post.deleteMany({});
    await User.deleteMany({});

    // Create test users
    testUser1 = new User({
      studentId: "2025CS1001",
      email: "user1@college.edu",
      displayName: "Test User 1",
      year: 3,
      department: "CS",
      section: "A",
    });
    await testUser1.save();

    testUser2 = new User({
      studentId: "2025CS1002",
      email: "user2@college.edu",
      displayName: "Test User 2",
      year: 3,
      department: "CS",
      section: "B",
    });
    await testUser2.save();

    // Generate auth tokens
    authToken1 = jwtService.generateToken({
      studentId: testUser1.studentId,
      email: testUser1.email,
    });
    authToken2 = jwtService.generateToken({
      studentId: testUser2.studentId,
      email: testUser2.email,
    });
  });

  describe("POST /posts", () => {
    it("should create a text post", async () => {
      const postData = {
        type: "text",
        text: "This is a test post",
        visibility: "public",
        tags: ["test", "post"],
      };

      const response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(postData)
        .expect(201);

      expect(response.body.message).toBe("Post created successfully");
      expect(response.body.post.authorStudentId).toBe(testUser1.studentId);
      expect(response.body.post.text).toBe(postData.text);
      expect(response.body.post.type).toBe("text");
      expect(response.body.post.visibility).toBe("public");
      expect(response.body.post.tags).toEqual(["test", "post"]);
    });

    it("should create an image post", async () => {
      const postData = {
        type: "image",
        text: "Check out this image!",
        media: [
          {
            url: "https://res.cloudinary.com/test/image/upload/v123/college/year-3/dept-CS/section-A/student-2025CS1001/photo.jpg",
            cloudinaryPublicId:
              "college/year-3/dept-CS/section-A/student-2025CS1001/photo",
            width: 800,
            height: 600,
          },
        ],
        visibility: "year",
      };

      const response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(postData)
        .expect(201);

      expect(response.body.post.type).toBe("image");
      expect(response.body.post.media).toHaveLength(1);
      expect(response.body.post.media[0].url).toBe(postData.media[0].url);
      expect(response.body.post.visibility).toBe("year");
    });

    it("should require authentication", async () => {
      const postData = {
        type: "text",
        text: "This should fail",
      };

      await request(app).post("/posts").send(postData).expect(401);
    });

    it("should validate post data", async () => {
      // Missing type
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ text: "Missing type" })
        .expect(400);

      // Invalid visibility
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "Invalid visibility",
          visibility: "invalid",
        })
        .expect(400);

      // Text post without text
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ type: "text" })
        .expect(400);
    });

    it("should validate media for image posts", async () => {
      // Image post without media
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ type: "image", text: "No media" })
        .expect(400);

      // Invalid cloudinary public ID
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "image",
          media: [
            {
              url: "https://example.com/image.jpg",
              cloudinaryPublicId: "invalid/path",
            },
          ],
        })
        .expect(400);
    });
  });

  describe("GET /posts", () => {
    beforeEach(async () => {
      // Create test posts
      const posts = [
        {
          authorStudentId: testUser1.studentId,
          type: "text",
          text: "Public post 1",
          visibility: "public",
          tags: ["test"],
          createdAt: new Date(Date.now() - 1000),
        },
        {
          authorStudentId: testUser2.studentId,
          type: "text",
          text: "Public post 2",
          visibility: "public",
          tags: ["test"],
          createdAt: new Date(Date.now() - 2000),
        },
        {
          authorStudentId: testUser1.studentId,
          type: "text",
          text: "Year-only post",
          visibility: "year",
          createdAt: new Date(Date.now() - 3000),
        },
        {
          authorStudentId: testUser1.studentId,
          type: "text",
          text: "Inactive post",
          visibility: "public",
          isActive: false,
        },
      ];

      await Post.insertMany(posts);
    });

    it("should get all public posts without authentication", async () => {
      const response = await request(app).get("/posts").expect(200);

      expect(response.body.posts).toHaveLength(2);
      expect(response.body.posts[0].text).toBe("Public post 1"); // Newest first
      expect(response.body.posts[1].text).toBe("Public post 2");
      expect(response.body.pagination.totalCount).toBe(2);
    });

    it("should get posts with authentication and visibility filtering", async () => {
      const response = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(3); // Public + year posts
      const postTexts = response.body.posts.map((p) => p.text);
      expect(postTexts).toContain("Public post 1");
      expect(postTexts).toContain("Public post 2");
      expect(postTexts).toContain("Year-only post");
    });

    it("should filter posts by author", async () => {
      const response = await request(app)
        .get(`/posts?author=${testUser1.studentId}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(1); // Only public post from user1
      expect(response.body.posts[0].authorStudentId).toBe(testUser1.studentId);
    });

    it("should filter posts by tags", async () => {
      const response = await request(app).get("/posts?tags=test").expect(200);

      expect(response.body.posts).toHaveLength(2);
      response.body.posts.forEach((post) => {
        expect(post.tags).toContain("test");
      });
    });

    it("should implement cursor-based pagination", async () => {
      const firstResponse = await request(app)
        .get("/posts?limit=1")
        .expect(200);

      expect(firstResponse.body.posts).toHaveLength(1);
      expect(firstResponse.body.pagination.hasMore).toBe(true);

      const cursor = firstResponse.body.pagination.nextCursor;
      const secondResponse = await request(app)
        .get(`/posts?cursor=${cursor}&limit=1`)
        .expect(200);

      expect(secondResponse.body.posts).toHaveLength(1);
      expect(secondResponse.body.posts[0]._id).not.toBe(
        firstResponse.body.posts[0]._id
      );
    });

    it("should search posts by text", async () => {
      const response = await request(app)
        .get("/posts?search=post 1")
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].text).toBe("Public post 1");
    });
  });

  describe("GET /posts/:id", () => {
    let testPost;

    beforeEach(async () => {
      testPost = new Post({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post for viewing",
        visibility: "public",
      });
      await testPost.save();
    });

    it("should get a specific post", async () => {
      const response = await request(app)
        .get(`/posts/${testPost._id}`)
        .expect(200);

      expect(response.body.post._id).toBe(testPost._id.toString());
      expect(response.body.post.text).toBe("Test post for viewing");
      expect(response.body.post.authorStudentId).toBe(testUser1.studentId);
    });

    it("should return 404 for non-existent post", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      await request(app).get(`/posts/${fakeId}`).expect(404);
    });

    it("should return 400 for invalid post ID", async () => {
      await request(app).get("/posts/invalid-id").expect(400);
    });

    it("should respect visibility settings", async () => {
      // Create a year-only post
      const yearPost = new Post({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Year-only post",
        visibility: "year",
      });
      await yearPost.save();

      // Should be accessible with authentication from same year
      await request(app)
        .get(`/posts/${yearPost._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      // Should not be accessible without authentication
      await request(app).get(`/posts/${yearPost._id}`).expect(403);
    });
  });

  describe("POST /posts/:id/like", () => {
    let testPost;

    beforeEach(async () => {
      testPost = new Post({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post for liking",
        visibility: "public",
      });
      await testPost.save();
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

    it("should unlike a post if already liked", async () => {
      // First like
      await request(app)
        .post(`/posts/${testPost._id}/like`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      // Unlike
      const response = await request(app)
        .post(`/posts/${testPost._id}/like`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.message).toBe("Post unliked successfully");
      expect(response.body.likesCount).toBe(0);
    });

    it("should require authentication", async () => {
      await request(app).post(`/posts/${testPost._id}/like`).expect(401);
    });

    it("should return 404 for non-existent post", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      await request(app)
        .post(`/posts/${fakeId}/like`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);
    });
  });

  describe("POST /posts/:id/comment", () => {
    let testPost;

    beforeEach(async () => {
      testPost = new Post({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post for commenting",
        visibility: "public",
      });
      await testPost.save();
    });

    it("should add a comment to a post", async () => {
      const commentData = {
        text: "This is a test comment",
      };

      const response = await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send(commentData)
        .expect(201);

      expect(response.body.message).toBe("Comment added successfully");
      expect(response.body.comment.text).toBe("This is a test comment");
      expect(response.body.comment.authorStudentId).toBe(testUser2.studentId);

      // Verify post comment count updated
      const updatedPost = await Post.findById(testPost._id);
      expect(updatedPost.commentsCount).toBe(1);
    });

    it("should require comment text", async () => {
      await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({})
        .expect(400);
    });

    it("should validate comment text length", async () => {
      const longComment = {
        text: "A".repeat(1001),
      };

      await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send(longComment)
        .expect(400);
    });

    it("should require authentication", async () => {
      await request(app)
        .post(`/posts/${testPost._id}/comment`)
        .send({ text: "Comment" })
        .expect(401);
    });
  });

  describe("GET /posts/:id/comments", () => {
    let testPost;

    beforeEach(async () => {
      testPost = new Post({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post with comments",
        visibility: "public",
      });
      await testPost.save();

      // Add some comments
      const Comment = require("../../src/models/Comment");
      const comments = [
        {
          authorStudentId: testUser1.studentId,
          entityType: "Post",
          entityId: testPost._id,
          text: "First comment",
          createdAt: new Date(Date.now() - 2000),
        },
        {
          authorStudentId: testUser2.studentId,
          entityType: "Post",
          entityId: testPost._id,
          text: "Second comment",
          createdAt: new Date(Date.now() - 1000),
        },
      ];
      await Comment.insertMany(comments);
    });

    it("should get comments for a post", async () => {
      const response = await request(app)
        .get(`/posts/${testPost._id}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(2);
      expect(response.body.comments[0].text).toBe("Second comment"); // Newest first
      expect(response.body.comments[1].text).toBe("First comment");
    });

    it("should implement pagination for comments", async () => {
      const response = await request(app)
        .get(`/posts/${testPost._id}/comments?limit=1`)
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.pagination.hasMore).toBe(true);
    });
  });

  describe("DELETE /posts/:id", () => {
    let testPost;

    beforeEach(async () => {
      testPost = new Post({
        authorStudentId: testUser1.studentId,
        type: "text",
        text: "Test post for deletion",
        visibility: "public",
      });
      await testPost.save();
    });

    it("should delete own post", async () => {
      const response = await request(app)
        .delete(`/posts/${testPost._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.message).toBe("Post deleted successfully");

      // Verify post is marked as inactive
      const deletedPost = await Post.findById(testPost._id);
      expect(deletedPost.isActive).toBe(false);
    });

    it("should not allow deleting other user's post", async () => {
      await request(app)
        .delete(`/posts/${testPost._id}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(403);
    });

    it("should require authentication", async () => {
      await request(app).delete(`/posts/${testPost._id}`).expect(401);
    });

    it("should return 404 for non-existent post", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      await request(app)
        .delete(`/posts/${fakeId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits on post creation", async () => {
      const postData = {
        type: "text",
        text: "Rate limit test post",
        visibility: "public",
      };

      // Make multiple requests quickly
      const promises = Array(6)
        .fill()
        .map(() =>
          request(app)
            .post("/posts")
            .set("Authorization", `Bearer ${authToken1}`)
            .send(postData)
        );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(
        (res) => res.status === 429
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock a database error
      jest
        .spyOn(Post.prototype, "save")
        .mockRejectedValueOnce(new Error("Database connection failed"));

      const response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "This should fail",
        })
        .expect(500);

      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("should validate ObjectId format", async () => {
      await request(app).get("/posts/invalid-object-id").expect(400);
    });
  });
});
