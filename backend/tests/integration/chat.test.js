const request = require("supertest");
const { app } = require("../../src/server");
const User = require("../../src/models/User");
const Conversation = require("../../src/models/Conversation");
const Message = require("../../src/models/Message");
const jwtService = require("../../src/services/jwtService");
const mongoose = require("mongoose");

describe("Chat API Integration Tests", () => {
  let testUser1, testUser2, testUser3;
  let user1Token, user2Token, user3Token;
  let testConversation;

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

    testUser3 = new User({
      studentId: "2025CS1003",
      email: "user3@college.edu",
      displayName: "Test User 3",
      year: 2,
      department: "EE",
      section: "B",
    });

    await Promise.all([testUser1.save(), testUser2.save(), testUser3.save()]);

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

    user3Token = jwtService.generateToken({
      studentId: testUser3.studentId,
      email: testUser3.email,
      uid: "firebase-uid-3",
    });
  });

  afterAll(async () => {
    // Clean up test data
    await Promise.all([
      User.deleteMany({
        studentId: { $in: ["2025CS1001", "2025CS1002", "2025CS1003"] },
      }),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
    ]);
  });

  beforeEach(async () => {
    // Clean up conversations and messages before each test
    await Promise.all([Conversation.deleteMany({}), Message.deleteMany({})]);
  });

  describe("POST /chat/conversations", () => {
    it("should create a new conversation between two users", async () => {
      const response = await request(app)
        .post("/chat/conversations")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          participants: [testUser2.studentId],
        });

      expect(response.status).toBe(201);
      expect(response.body.conversation).toBeDefined();
      expect(response.body.conversation.participants).toContain(
        testUser1.studentId
      );
      expect(response.body.conversation.participants).toContain(
        testUser2.studentId
      );
      expect(response.body.conversation.participants).toHaveLength(2);
    });

    it("should return existing conversation if it already exists", async () => {
      // Create conversation first
      const firstResponse = await request(app)
        .post("/chat/conversations")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          participants: [testUser2.studentId],
        });

      // Try to create same conversation again
      const secondResponse = await request(app)
        .post("/chat/conversations")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          participants: [testUser2.studentId],
        });

      expect(secondResponse.status).toBe(201);
      expect(secondResponse.body.conversation._id).toBe(
        firstResponse.body.conversation._id
      );
    });

    it("should create group conversation with multiple participants", async () => {
      const response = await request(app)
        .post("/chat/conversations")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          participants: [testUser2.studentId, testUser3.studentId],
        });

      expect(response.status).toBe(201);
      expect(response.body.conversation.participants).toHaveLength(3);
      expect(response.body.conversation.participants).toContain(
        testUser1.studentId
      );
      expect(response.body.conversation.participants).toContain(
        testUser2.studentId
      );
      expect(response.body.conversation.participants).toContain(
        testUser3.studentId
      );
    });

    it("should reject invalid participant student IDs", async () => {
      const response = await request(app)
        .post("/chat/conversations")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          participants: ["invalid-id"],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/chat/conversations")
        .send({
          participants: [testUser2.studentId],
        });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /chat/conversations", () => {
    beforeEach(async () => {
      // Create test conversations
      const conv1 = new Conversation({
        participants: [testUser1.studentId, testUser2.studentId],
        type: "direct",
        lastMessage: {
          content: "Hello from conversation 1",
          senderStudentId: testUser1.studentId,
          timestamp: new Date(Date.now() - 1000),
          messageType: "text",
        },
        updatedAt: new Date(Date.now() - 1000),
      });

      const conv2 = new Conversation({
        participants: [testUser1.studentId, testUser3.studentId],
        type: "direct",
        lastMessage: {
          content: "Hello from conversation 2",
          senderStudentId: testUser1.studentId,
          timestamp: new Date(),
          messageType: "text",
        },
        updatedAt: new Date(),
      });

      await Promise.all([conv1.save(), conv2.save()]);
    });

    it("should return user conversations with pagination", async () => {
      const response = await request(app)
        .get("/chat/conversations")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it("should return conversations ordered by most recent", async () => {
      const response = await request(app)
        .get("/chat/conversations")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations[0].lastMessage.content).toBe(
        "Hello from conversation 2"
      );
      expect(response.body.conversations[1].lastMessage.content).toBe(
        "Hello from conversation 1"
      );
    });

    it("should support pagination with limit and offset", async () => {
      const response = await request(app)
        .get("/chat/conversations?limit=1&offset=0")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.pagination.hasMore).toBe(true);
      expect(response.body.pagination.nextOffset).toBe(1);
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/chat/conversations");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /chat/conversations/:conversationId/messages", () => {
    beforeEach(async () => {
      testConversation = new Conversation({
        participants: [testUser1.studentId, testUser2.studentId],
        type: "direct",
        updatedAt: new Date(),
      });
      await testConversation.save();
    });

    it("should send a text message", async () => {
      const response = await request(app)
        .post(`/chat/conversations/${testConversation._id}/messages`)
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          text: "Hello, this is a test message!",
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBeDefined();
      expect(response.body.message.text).toBe("Hello, this is a test message!");
      expect(response.body.message.senderStudentId).toBe(testUser1.studentId);
      expect(
        response.body.message.readBy.some(
          (r) => r.studentId === testUser1.studentId
        )
      ).toBe(true);
    });

    it("should send a media message", async () => {
      const response = await request(app)
        .post(`/chat/conversations/${testConversation._id}/messages`)
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          media: {
            url: "https://example.com/image.jpg",
            cloudinaryPublicId: "test-image-id",
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.message.media).toBeDefined();
      expect(response.body.message.media.url).toBe(
        "https://example.com/image.jpg"
      );
    });

    it("should reject message without text or media", async () => {
      const response = await request(app)
        .post(`/chat/conversations/${testConversation._id}/messages`)
        .set("Authorization", `Bearer ${user1Token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject message from non-participant", async () => {
      const response = await request(app)
        .post(`/chat/conversations/${testConversation._id}/messages`)
        .set("Authorization", `Bearer ${user3Token}`)
        .send({
          text: "This should fail",
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("CONVERSATION_NOT_FOUND");
    });

    it("should update conversation last message", async () => {
      await request(app)
        .post(`/chat/conversations/${testConversation._id}/messages`)
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          text: "Hello, this is a test message!",
        });

      const updatedConversation = await Conversation.findById(
        testConversation._id
      );
      expect(updatedConversation.lastMessage.content).toBe(
        "Hello, this is a test message!"
      );
    });
  });

  describe("GET /chat/conversations/:conversationId/messages", () => {
    beforeEach(async () => {
      testConversation = new Conversation({
        participants: [testUser1.studentId, testUser2.studentId],
        type: "direct",
        updatedAt: new Date(),
      });
      await testConversation.save();

      // Create test messages
      const messages = [];
      for (let i = 1; i <= 5; i++) {
        messages.push(
          new Message({
            conversationId: testConversation._id,
            senderStudentId:
              i % 2 === 1 ? testUser1.studentId : testUser2.studentId,
            text: `Test message ${i}`,
            createdAt: new Date(Date.now() + i * 1000),
            readBy: [
              {
                studentId:
                  i % 2 === 1 ? testUser1.studentId : testUser2.studentId,
                readAt: new Date(),
              },
            ],
          })
        );
      }
      await Message.insertMany(messages);
    });

    it("should return messages for conversation participant", async () => {
      const response = await request(app)
        .get(`/chat/conversations/${testConversation._id}/messages`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(5);
      expect(response.body.messages[0].text).toBe("Test message 1");
      expect(response.body.messages[4].text).toBe("Test message 5");
    });

    it("should support pagination with limit", async () => {
      const response = await request(app)
        .get(`/chat/conversations/${testConversation._id}/messages?limit=3`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(3);
      expect(response.body.pagination.hasMore).toBe(true);
    });

    it("should reject access from non-participant", async () => {
      const response = await request(app)
        .get(`/chat/conversations/${testConversation._id}/messages`)
        .set("Authorization", `Bearer ${user3Token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("CONVERSATION_NOT_FOUND");
    });
  });

  describe("PUT /chat/conversations/:conversationId/read", () => {
    let testMessage;

    beforeEach(async () => {
      testConversation = new Conversation({
        participants: [testUser1.studentId, testUser2.studentId],
        type: "direct",
        updatedAt: new Date(),
      });
      await testConversation.save();

      testMessage = new Message({
        conversationId: testConversation._id,
        senderStudentId: testUser1.studentId,
        text: "Test message",
        createdAt: new Date(),
        readBy: [{ studentId: testUser1.studentId, readAt: new Date() }],
      });
      await testMessage.save();
    });

    it("should mark messages as read", async () => {
      const response = await request(app)
        .put(`/chat/conversations/${testConversation._id}/read`)
        .set("Authorization", `Bearer ${user2Token}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.modifiedCount).toBe(1);

      // Verify message was marked as read
      const updatedMessage = await Message.findById(testMessage._id);
      expect(
        updatedMessage.readBy.some((r) => r.studentId === testUser2.studentId)
      ).toBe(true);
    });

    it("should mark specific messages as read", async () => {
      const response = await request(app)
        .put(`/chat/conversations/${testConversation._id}/read`)
        .set("Authorization", `Bearer ${user2Token}`)
        .send({
          messageIds: [testMessage._id.toString()],
        });

      expect(response.status).toBe(200);
      expect(response.body.modifiedCount).toBe(1);
    });

    it("should reject access from non-participant", async () => {
      const response = await request(app)
        .put(`/chat/conversations/${testConversation._id}/read`)
        .set("Authorization", `Bearer ${user3Token}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("CONVERSATION_NOT_FOUND");
    });
  });

  describe("GET /chat/search", () => {
    beforeEach(async () => {
      testConversation = new Conversation({
        participants: [testUser1.studentId, testUser2.studentId],
        type: "direct",
        updatedAt: new Date(),
      });
      await testConversation.save();

      const searchableMessage = new Message({
        conversationId: testConversation._id,
        senderStudentId: testUser1.studentId,
        text: "This is a searchable message about JavaScript",
        createdAt: new Date(),
        readBy: [{ studentId: testUser1.studentId, readAt: new Date() }],
      });
      await searchableMessage.save();
    });

    it("should search messages across user conversations", async () => {
      const response = await request(app)
        .get("/chat/search?q=JavaScript")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(1);
      expect(response.body.messages[0].text).toContain("JavaScript");
      expect(response.body.query).toBe("JavaScript");
    });

    it("should return empty results for non-matching search", async () => {
      const response = await request(app)
        .get("/chat/search?q=Python")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.messages).toHaveLength(0);
    });

    it("should require search query", async () => {
      const response = await request(app)
        .get("/chat/search")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
