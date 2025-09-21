const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../src/server");
const Topic = require("../../src/models/Topic");
const User = require("../../src/models/User");
const Comment = require("../../src/models/Comment");
const jwtService = require("../../src/services/jwtService");

describe("Topics API", () => {
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
    await Topic.deleteMany({});
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
    });

    authToken2 = jwtService.generateToken({
      studentId: testUser2.studentId,
      email: testUser2.email,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("GET /topics", () => {
    beforeEach(async () => {
      // Create test topics
      await Topic.create([
        {
          title: "First Topic",
          body: "This is the first topic for testing",
          authorStudentId: testUser1.studentId,
          tags: ["test", "first"],
          votes: 5,
          upvotes: 7,
          downvotes: 2,
        },
        {
          title: "Second Topic",
          body: "This is the second topic for testing",
          authorStudentId: testUser2.studentId,
          tags: ["test", "second"],
          votes: 10,
          upvotes: 12,
          downvotes: 2,
        },
        {
          title: "Third Topic",
          body: "This is the third topic for testing",
          authorStudentId: testUser1.studentId,
          tags: ["discussion"],
          votes: 2,
          upvotes: 3,
          downvotes: 1,
        },
      ]);
    });

    it("should get topics with default pagination", async () => {
      const response = await request(app).get("/topics").expect(200);

      expect(response.body).toHaveProperty("topics");
      expect(response.body).toHaveProperty("pagination");
      expect(response.body.topics).toHaveLength(3);
      expect(response.body.pagination).toMatchObject({
        hasMore: false,
        limit: 20,
      });

      // Check topic structure
      const topic = response.body.topics[0];
      expect(topic).toHaveProperty("_id");
      expect(topic).toHaveProperty("title");
      expect(topic).toHaveProperty("body");
      expect(topic).toHaveProperty("authorStudentId");
      expect(topic).toHaveProperty("votes");
      expect(topic).toHaveProperty("tags");
      expect(topic).toHaveProperty("author");
      expect(topic.author).toHaveProperty("displayName");
    });

    it("should filter topics by tags", async () => {
      const response = await request(app)
        .get("/topics")
        .query({ tags: "test" })
        .expect(200);

      expect(response.body.topics).toHaveLength(2);
      response.body.topics.forEach((topic) => {
        expect(topic.tags).toContain("test");
      });
    });

    it("should filter topics by multiple tags", async () => {
      const response = await request(app)
        .get("/topics")
        .query({ tags: "test,first" })
        .expect(200);

      expect(response.body.topics).toHaveLength(2); // Both topics with "test" tag should be returned
      response.body.topics.forEach((topic) => {
        expect(topic.tags).toEqual(
          expect.arrayContaining(["test"]) // Each should contain at least "test"
        );
      });
    });

    it("should filter topics by author", async () => {
      const response = await request(app)
        .get("/topics")
        .query({ authorStudentId: testUser1.studentId })
        .expect(200);

      expect(response.body.topics).toHaveLength(2);
      response.body.topics.forEach((topic) => {
        expect(topic.authorStudentId).toBe(testUser1.studentId);
      });
    });

    it("should sort topics by popularity", async () => {
      const response = await request(app)
        .get("/topics")
        .query({ sortBy: "popular" })
        .expect(200);

      const votes = response.body.topics.map((topic) => topic.votes);
      expect(votes).toEqual([10, 5, 2]); // Descending order
    });

    it("should search topics by text", async () => {
      const response = await request(app)
        .get("/topics")
        .query({ search: "second" })
        .expect(200);

      expect(response.body.topics).toHaveLength(1);
      expect(response.body.topics[0].title).toContain("Second");
    });

    it("should limit results", async () => {
      const response = await request(app)
        .get("/topics")
        .query({ limit: 2 })
        .expect(200);

      expect(response.body.topics).toHaveLength(2);
      expect(response.body.pagination.limit).toBe(2);
    });

    it("should validate query parameters", async () => {
      await request(app).get("/topics").query({ limit: 0 }).expect(400);

      await request(app)
        .get("/topics")
        .query({ sortBy: "invalid" })
        .expect(400);

      await request(app)
        .get("/topics")
        .query({ authorStudentId: "invalid" })
        .expect(400);
    });
  });

  describe("POST /topics", () => {
    it("should create a new topic", async () => {
      const topicData = {
        title: "New Topic",
        body: "This is a new topic for testing creation",
        tags: ["new", "test"],
      };

      const response = await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(topicData)
        .expect(201);

      expect(response.body).toHaveProperty(
        "message",
        "Topic created successfully"
      );
      expect(response.body).toHaveProperty("topic");
      expect(response.body.topic.title).toBe(topicData.title);
      expect(response.body.topic.body).toBe(topicData.body);
      expect(response.body.topic.authorStudentId).toBe(testUser1.studentId);
      expect(response.body.topic.tags).toEqual(topicData.tags);
      expect(response.body.topic.author).toHaveProperty(
        "displayName",
        testUser1.displayName
      );

      // Verify in database
      const savedTopic = await Topic.findById(response.body.topic._id);
      expect(savedTopic).toBeTruthy();
      expect(savedTopic.title).toBe(topicData.title);
    });

    it("should create a topic without tags", async () => {
      const topicData = {
        title: "Topic Without Tags",
        body: "This topic has no tags",
      };

      const response = await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(topicData)
        .expect(201);

      expect(response.body.topic.tags).toEqual([]);
    });

    it("should require authentication", async () => {
      const topicData = {
        title: "Unauthorized Topic",
        body: "This should fail without auth",
      };

      await request(app).post("/topics").send(topicData).expect(401);
    });

    it("should validate required fields", async () => {
      await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({})
        .expect(400);

      await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ title: "Only Title" })
        .expect(400);

      await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ body: "Only Body" })
        .expect(400);
    });

    it("should validate field lengths", async () => {
      // Title too short
      await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          title: "Hi",
          body: "This body is long enough for validation",
        })
        .expect(400);

      // Title too long
      await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          title: "A".repeat(201),
          body: "This body is long enough for validation",
        })
        .expect(400);

      // Body too short
      await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          title: "Valid Title",
          body: "Short",
        })
        .expect(400);

      // Body too long
      await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          title: "Valid Title",
          body: "A".repeat(5001),
        })
        .expect(400);
    });

    it("should validate tags format", async () => {
      await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          title: "Valid Title",
          body: "This body is long enough for validation",
          tags: ["valid-tag", "INVALID TAG"], // Space not allowed
        })
        .expect(400);
    });
  });

  describe("GET /topics/:id", () => {
    let testTopic;

    beforeEach(async () => {
      testTopic = await Topic.create({
        title: "Test Topic",
        body: "This is a test topic",
        authorStudentId: testUser1.studentId,
        tags: ["test"],
      });
    });

    it("should get a topic by ID", async () => {
      const response = await request(app)
        .get(`/topics/${testTopic._id}`)
        .expect(200);

      expect(response.body).toHaveProperty("topic");
      expect(response.body.topic._id).toBe(testTopic._id.toString());
      expect(response.body.topic.title).toBe(testTopic.title);
      expect(response.body.topic.author).toHaveProperty(
        "displayName",
        testUser1.displayName
      );
    });

    it("should return 404 for non-existent topic", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app).get(`/topics/${nonExistentId}`).expect(404);
    });

    it("should validate topic ID format", async () => {
      await request(app).get("/topics/invalid-id").expect(400);
    });
  });

  describe("POST /topics/:id/vote", () => {
    let testTopic;

    beforeEach(async () => {
      testTopic = await Topic.create({
        title: "Test Topic",
        body: "This is a test topic",
        authorStudentId: testUser1.studentId,
        votes: 0,
        upvotes: 0,
        downvotes: 0,
      });
    });

    it("should upvote a topic", async () => {
      const response = await request(app)
        .post(`/topics/${testTopic._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ voteType: "up" })
        .expect(200);

      expect(response.body.message).toBe("Vote recorded successfully");
      expect(response.body.votes).toBe(1);
      expect(response.body.upvotes).toBe(1);
      expect(response.body.downvotes).toBe(0);

      // Verify in database
      const updatedTopic = await Topic.findById(testTopic._id);
      expect(updatedTopic.votes).toBe(1);
      expect(updatedTopic.upvotes).toBe(1);
    });

    it("should downvote a topic", async () => {
      const response = await request(app)
        .post(`/topics/${testTopic._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ voteType: "down" })
        .expect(200);

      expect(response.body.votes).toBe(-1);
      expect(response.body.upvotes).toBe(0);
      expect(response.body.downvotes).toBe(1);
    });

    it("should remove upvote", async () => {
      // First upvote
      await testTopic.upvote();

      const response = await request(app)
        .post(`/topics/${testTopic._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ voteType: "remove_up" })
        .expect(200);

      expect(response.body.votes).toBe(0);
      expect(response.body.upvotes).toBe(0);
    });

    it("should remove downvote", async () => {
      // First downvote
      await testTopic.downvote();

      const response = await request(app)
        .post(`/topics/${testTopic._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ voteType: "remove_down" })
        .expect(200);

      expect(response.body.votes).toBe(0);
      expect(response.body.downvotes).toBe(0);
    });

    it("should require authentication", async () => {
      await request(app)
        .post(`/topics/${testTopic._id}/vote`)
        .send({ voteType: "up" })
        .expect(401);
    });

    it("should validate vote type", async () => {
      await request(app)
        .post(`/topics/${testTopic._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ voteType: "invalid" })
        .expect(400);
    });

    it("should return 404 for non-existent topic", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/topics/${nonExistentId}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ voteType: "up" })
        .expect(404);
    });
  });

  describe("POST /topics/:id/comment", () => {
    let testTopic;

    beforeEach(async () => {
      testTopic = await Topic.create({
        title: "Test Topic",
        body: "This is a test topic",
        authorStudentId: testUser1.studentId,
        commentsCount: 0,
      });
    });

    it("should add a comment to a topic", async () => {
      const commentData = {
        content: "This is a test comment on the topic",
      };

      const response = await request(app)
        .post(`/topics/${testTopic._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send(commentData)
        .expect(201);

      expect(response.body.message).toBe("Comment added successfully");
      expect(response.body.comment.content).toBe(commentData.content);
      expect(response.body.comment.authorStudentId).toBe(testUser2.studentId);
      expect(response.body.comment.parentType).toBe("Topic");
      expect(response.body.comment.parentId).toBe(testTopic._id.toString());
      expect(response.body.comment.author).toHaveProperty(
        "displayName",
        testUser2.displayName
      );
      expect(response.body.topic.commentsCount).toBe(1);

      // Verify in database
      const savedComment = await Comment.findById(response.body.comment._id);
      expect(savedComment).toBeTruthy();
      expect(savedComment.content).toBe(commentData.content);

      const updatedTopic = await Topic.findById(testTopic._id);
      expect(updatedTopic.commentsCount).toBe(1);
    });

    it("should add a reply to a comment", async () => {
      // First create a parent comment
      const parentComment = await Comment.create({
        authorStudentId: testUser1.studentId,
        content: "Parent comment",
        parentType: "Topic",
        parentId: testTopic._id,
      });

      const replyData = {
        content: "This is a reply to the comment",
        parentCommentId: parentComment._id.toString(),
      };

      const response = await request(app)
        .post(`/topics/${testTopic._id}/comment`)
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
        .post(`/topics/${testTopic._id}/comment`)
        .send({ content: "Unauthorized comment" })
        .expect(401);
    });

    it("should validate comment content", async () => {
      await request(app)
        .post(`/topics/${testTopic._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ content: "" })
        .expect(400);

      await request(app)
        .post(`/topics/${testTopic._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ content: "A".repeat(1001) })
        .expect(400);
    });

    it("should return 404 for non-existent topic", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/topics/${nonExistentId}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ content: "Comment on non-existent topic" })
        .expect(404);
    });

    it("should return 404 for non-existent parent comment", async () => {
      const nonExistentCommentId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/topics/${testTopic._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          content: "Reply to non-existent comment",
          parentCommentId: nonExistentCommentId.toString(),
        })
        .expect(404);
    });
  });

  describe("GET /topics/:id/comments", () => {
    let testTopic, comment1, comment2, reply1;

    beforeEach(async () => {
      testTopic = await Topic.create({
        title: "Test Topic",
        body: "This is a test topic",
        authorStudentId: testUser1.studentId,
      });

      comment1 = await Comment.create({
        authorStudentId: testUser1.studentId,
        content: "First comment",
        parentType: "Topic",
        parentId: testTopic._id,
        votes: 5,
      });

      comment2 = await Comment.create({
        authorStudentId: testUser2.studentId,
        content: "Second comment",
        parentType: "Topic",
        parentId: testTopic._id,
        votes: 2,
      });

      reply1 = await Comment.create({
        authorStudentId: testUser2.studentId,
        content: "Reply to first comment",
        parentType: "Topic",
        parentId: testTopic._id,
        parentCommentId: comment1._id,
        level: 1,
      });
    });

    it("should get top-level comments for a topic", async () => {
      const response = await request(app)
        .get(`/topics/${testTopic._id}/comments`)
        .expect(200);

      expect(response.body.comments).toHaveLength(2); // Only top-level comments
      expect(response.body.comments[0].level).toBe(0);
      expect(response.body.comments[1].level).toBe(0);

      // Check comment structure
      const comment = response.body.comments[0];
      expect(comment).toHaveProperty("content");
      expect(comment).toHaveProperty("authorStudentId");
      expect(comment).toHaveProperty("author");
      expect(comment.author).toHaveProperty("displayName");
    });

    it("should get replies to a specific comment", async () => {
      const response = await request(app)
        .get(`/topics/${testTopic._id}/comments`)
        .query({ parentCommentId: comment1._id.toString() })
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].parentCommentId).toBe(
        comment1._id.toString()
      );
      expect(response.body.comments[0].level).toBe(1);
    });

    it("should sort comments by popularity", async () => {
      const response = await request(app)
        .get(`/topics/${testTopic._id}/comments`)
        .query({ sortBy: "popular" })
        .expect(200);

      const votes = response.body.comments.map((comment) => comment.votes);
      expect(votes[0]).toBeGreaterThanOrEqual(votes[1]);
    });

    it("should limit comment results", async () => {
      const response = await request(app)
        .get(`/topics/${testTopic._id}/comments`)
        .query({ limit: 1 })
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it("should return 404 for non-existent topic", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      await request(app).get(`/topics/${nonExistentId}/comments`).expect(404);
    });

    it("should validate query parameters", async () => {
      await request(app)
        .get(`/topics/${testTopic._id}/comments`)
        .query({ limit: 0 })
        .expect(400);

      await request(app)
        .get(`/topics/${testTopic._id}/comments`)
        .query({ sortBy: "invalid" })
        .expect(400);
    });
  });
});
