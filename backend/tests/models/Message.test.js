const Message = require("../../src/models/Message");
const Conversation = require("../../src/models/Conversation");
const mongoose = require("mongoose");

describe("Message Model", () => {
  let conversationId;

  beforeEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});

    // Create a test conversation
    const conversation = new Conversation({
      participants: ["2025CS1001", "2025CS1002"],
      type: "direct",
    });
    const savedConversation = await conversation.save();
    conversationId = savedConversation._id;
  });

  describe("Schema Validation", () => {
    const validTextMessageData = {
      conversationId: null, // Will be set in tests
      senderStudentId: "2025CS1001",
      type: "text",
      content: {
        text: "Hello, how are you?",
      },
    };

    const validImageMessageData = {
      conversationId: null,
      senderStudentId: "2025CS1001",
      type: "image",
      content: {
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/image.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/image",
          filename: "image.jpg",
          mimeType: "image/jpeg",
          width: 800,
          height: 600,
        },
      },
    };

    const validSystemMessageData = {
      conversationId: null,
      senderStudentId: "system",
      type: "system",
      content: {
        system: {
          action: "user_joined",
          metadata: { userName: "John Doe" },
        },
      },
    };

    test("should create a valid text message", async () => {
      const messageData = { ...validTextMessageData, conversationId };
      const message = new Message(messageData);
      const savedMessage = await message.save();

      expect(savedMessage._id).toBeDefined();
      expect(savedMessage.conversationId).toEqual(conversationId);
      expect(savedMessage.senderStudentId).toBe("2025CS1001");
      expect(savedMessage.type).toBe("text");
      expect(savedMessage.content.text).toBe("Hello, how are you?");
      expect(savedMessage.readBy).toHaveLength(0);
      expect(savedMessage.deliveredTo).toHaveLength(0);
      expect(savedMessage.isDeleted).toBe(false);
      expect(savedMessage.createdAt).toBeDefined();
    });

    test("should create a valid image message", async () => {
      const messageData = { ...validImageMessageData, conversationId };
      const message = new Message(messageData);
      const savedMessage = await message.save();

      expect(savedMessage.type).toBe("image");
      expect(savedMessage.content.media.url).toBe(
        validImageMessageData.content.media.url
      );
      expect(savedMessage.content.media.filename).toBe("image.jpg");
      expect(savedMessage.content.media.width).toBe(800);
      expect(savedMessage.content.media.height).toBe(600);
    });

    test("should create a valid system message", async () => {
      const messageData = { ...validSystemMessageData, conversationId };
      const message = new Message(messageData);
      const savedMessage = await message.save();

      expect(savedMessage.type).toBe("system");
      expect(savedMessage.senderStudentId).toBe("system");
      expect(savedMessage.content.system.action).toBe("user_joined");
      expect(savedMessage.content.system.metadata.userName).toBe("John Doe");
    });

    test("should require conversationId", async () => {
      const messageData = { ...validTextMessageData };
      delete messageData.conversationId;

      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(
        "Conversation ID is required"
      );
    });

    test("should require senderStudentId", async () => {
      const messageData = { ...validTextMessageData, conversationId };
      delete messageData.senderStudentId;

      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(
        "Sender student ID is required"
      );
    });

    test("should validate senderStudentId format", async () => {
      const invalidIds = ["invalid", "2025CS", "CS1001", "25CS1001"];

      for (const invalidId of invalidIds) {
        const message = new Message({
          ...validTextMessageData,
          conversationId,
          senderStudentId: invalidId,
        });
        await expect(message.save()).rejects.toThrow(
          "Sender student ID must follow format"
        );
      }
    });

    test("should validate message type enum", async () => {
      const message = new Message({
        ...validTextMessageData,
        conversationId,
        type: "invalid",
      });
      await expect(message.save()).rejects.toThrow(
        "Message type must be one of"
      );
    });

    test("should validate text message length", async () => {
      const message = new Message({
        ...validTextMessageData,
        conversationId,
        content: { text: "A".repeat(2001) },
      });
      await expect(message.save()).rejects.toThrow(
        "Message text cannot exceed 2000 characters"
      );
    });

    test("should validate media URL format", async () => {
      const messageData = {
        ...validImageMessageData,
        conversationId,
        content: {
          media: {
            ...validImageMessageData.content.media,
            url: "invalid-url",
          },
        },
      };

      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(
        "Media URL must be a valid HTTP/HTTPS URL"
      );
    });

    test("should validate cloudinary public ID format", async () => {
      const messageData = {
        ...validImageMessageData,
        conversationId,
        content: {
          media: {
            ...validImageMessageData.content.media,
            cloudinaryPublicId: "invalid/path",
          },
        },
      };

      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(
        "Cloudinary public ID must follow college folder structure"
      );
    });

    test("should require text content for text messages", async () => {
      const message = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "" },
      });
      await expect(message.save()).rejects.toThrow(
        "Text messages must have text content"
      );
    });

    test("should require media content for image messages", async () => {
      const message = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "image",
        content: {},
      });
      await expect(message.save()).rejects.toThrow(
        "image messages must have media content"
      );
    });

    test("should require action for system messages", async () => {
      const message = new Message({
        conversationId,
        senderStudentId: "system",
        type: "system",
        content: { system: {} },
      });
      await expect(message.save()).rejects.toThrow(
        "System messages must have action"
      );
    });

    test("should validate readBy student IDs", async () => {
      const message = new Message({
        ...validTextMessageData,
        conversationId,
        readBy: [{ studentId: "invalid-id" }],
      });

      await expect(message.save()).rejects.toThrow(
        "Student ID must follow format"
      );
    });

    test("should trim text content and filename", async () => {
      const message = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "  Trimmed message  " },
      });
      const savedMessage = await message.save();

      expect(savedMessage.content.text).toBe("Trimmed message");
    });
  });

  describe("Instance Methods", () => {
    let message;

    beforeEach(async () => {
      message = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "Test message" },
      });
      await message.save();
    });

    test("should mark message as read", async () => {
      await message.markAsRead("2025CS1002");

      expect(message.readBy).toHaveLength(1);
      expect(message.readBy[0].studentId).toBe("2025CS1002");
      expect(message.readBy[0].readAt).toBeDefined();
    });

    test("should not add duplicate read receipts", async () => {
      await message.markAsRead("2025CS1002");
      await message.markAsRead("2025CS1002");

      expect(message.readBy).toHaveLength(1);
    });

    test("should mark message as delivered", async () => {
      await message.markAsDelivered("2025CS1002");

      expect(message.deliveredTo).toHaveLength(1);
      expect(message.deliveredTo[0].studentId).toBe("2025CS1002");
      expect(message.deliveredTo[0].deliveredAt).toBeDefined();
    });

    test("should not add duplicate delivery receipts", async () => {
      await message.markAsDelivered("2025CS1002");
      await message.markAsDelivered("2025CS1002");

      expect(message.deliveredTo).toHaveLength(1);
    });

    test("should edit text message content", async () => {
      await message.editContent("Edited message");

      expect(message.content.text).toBe("Edited message");
      expect(message.editedAt).toBeDefined();
      expect(message.isEdited).toBe(true);
    });

    test("should not allow editing non-text messages", async () => {
      const imageMessage = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "image",
        content: {
          media: {
            url: "https://example.com/image.jpg",
            cloudinaryPublicId:
              "college/2025-CS/dept-CS/section-A/student-2025CS1001/image",
          },
        },
      });

      await expect(imageMessage.editContent("New text")).rejects.toThrow(
        "Only text messages can be edited"
      );
    });

    test("should soft delete message for specific user", async () => {
      await message.softDelete("2025CS1002");

      expect(message.deletedFor).toContain("2025CS1002");
      expect(message.isDeleted).toBe(false);
    });

    test("should soft delete message for everyone", async () => {
      await message.softDelete();

      expect(message.isDeleted).toBe(true);
      expect(message.deletedAt).toBeDefined();
    });

    test("should restore deleted message", async () => {
      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedFor = ["2025CS1002"];
      await message.save();

      await message.restore();
      expect(message.isDeleted).toBe(false);
      expect(message.deletedAt).toBeNull();
      expect(message.deletedFor).toHaveLength(0);
    });

    test("should generate system message text", async () => {
      const systemMessage = new Message({
        conversationId,
        senderStudentId: "system",
        type: "system",
        content: {
          system: {
            action: "user_joined",
            metadata: { userName: "John Doe" },
          },
        },
      });

      expect(systemMessage.getSystemMessageText()).toBe(
        "John Doe joined the conversation"
      );
    });

    test("should check if message can be edited by user", () => {
      expect(message.canBeEditedBy("2025CS1001")).toBe(true);
      expect(message.canBeEditedBy("2025CS1002")).toBe(false);

      // Test time limit (15 minutes) - create a new message with old timestamp
      const oldMessage = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "Old message" },
        createdAt: new Date(Date.now() - 16 * 60 * 1000),
      });
      expect(oldMessage.canBeEditedBy("2025CS1001")).toBe(false);
    });

    test("should check if message can be deleted by user", () => {
      expect(message.canBeDeletedBy("2025CS1001")).toBe(true);
      expect(message.canBeDeletedBy("2025CS1002")).toBe(false);

      message.isDeleted = true;
      expect(message.canBeDeletedBy("2025CS1001")).toBe(false);
    });

    test("should check if message is visible to user", () => {
      expect(message.isVisibleTo("2025CS1001")).toBe(true);
      expect(message.isVisibleTo("2025CS1002")).toBe(true);

      message.deletedFor.push("2025CS1002");
      expect(message.isVisibleTo("2025CS1002")).toBe(false);

      message.isDeleted = true;
      expect(message.isVisibleTo("2025CS1001")).toBe(false);
    });
  });

  describe("Virtuals", () => {
    test("should check if message is edited", async () => {
      const message = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "Test message" },
      });

      expect(message.isEdited).toBe(false);

      message.editedAt = new Date();
      expect(message.isEdited).toBe(true);
    });

    test("should check if message has media", async () => {
      const textMessage = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "Test message" },
      });
      expect(textMessage.hasMedia).toBe(false);

      const imageMessage = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "image",
        content: {
          media: {
            url: "https://example.com/image.jpg",
            cloudinaryPublicId:
              "college/2025-CS/dept-CS/section-A/student-2025CS1001/image",
          },
        },
      });
      expect(imageMessage.hasMedia).toBe(true);
    });

    test("should get display content", async () => {
      const textMessage = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "Hello world" },
      });
      expect(textMessage.displayContent).toBe("Hello world");

      const imageMessage = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "image",
        content: { media: { url: "https://example.com/image.jpg" } },
      });
      expect(imageMessage.displayContent).toBe("[Image]");

      const deletedMessage = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "Deleted content" },
        isDeleted: true,
      });
      expect(deletedMessage.displayContent).toBe("[deleted]");
    });

    test("should check read and delivery status", async () => {
      const message = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "Test message" },
        readBy: [{ studentId: "2025CS1002" }],
        deliveredTo: [{ studentId: "2025CS1002" }],
      });

      const isReadBy = message.isReadBy;
      const isDeliveredTo = message.isDeliveredTo;

      expect(isReadBy("2025CS1002")).toBe(true);
      expect(isReadBy("2025ECE1001")).toBe(false);
      expect(isDeliveredTo("2025CS1002")).toBe(true);
      expect(isDeliveredTo("2025ECE1001")).toBe(false);
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const messages = [
        {
          conversationId,
          senderStudentId: "2025CS1001",
          type: "text",
          content: { text: "First message" },
          createdAt: new Date(Date.now() - 3000),
        },
        {
          conversationId,
          senderStudentId: "2025CS1002",
          type: "text",
          content: { text: "Second message" },
          createdAt: new Date(Date.now() - 2000),
        },
        {
          conversationId,
          senderStudentId: "2025CS1001",
          type: "image",
          content: {
            media: {
              url: "https://example.com/image.jpg",
              cloudinaryPublicId:
                "college/2025-CS/dept-CS/section-A/student-2025CS1001/image",
            },
          },
          createdAt: new Date(Date.now() - 1000),
        },
        {
          conversationId,
          senderStudentId: "2025CS1001",
          type: "text",
          content: { text: "Deleted message" },
          isDeleted: true,
        },
      ];

      await Message.insertMany(messages);
    });

    test("should find messages by conversation", async () => {
      const messages = await Message.findByConversation(conversationId);
      expect(messages).toHaveLength(3); // Only non-deleted messages

      // Should be sorted by createdAt desc (newest first)
      expect(messages[0].type).toBe("image");
      expect(messages[1].content.text).toBe("Second message");
      expect(messages[2].content.text).toBe("First message");
    });

    test("should find messages by sender", async () => {
      const messages = await Message.findBySender("2025CS1001");
      expect(messages).toHaveLength(2); // Only non-deleted messages from CS1001
    });

    test("should search messages in conversation", async () => {
      const messages = await Message.searchMessages(conversationId, "First");
      expect(messages).toHaveLength(1);
      expect(messages[0].content.text).toBe("First message");
    });

    test("should find unread messages", async () => {
      const messages = await Message.findUnreadMessages(
        conversationId,
        "2025CS1001"
      );
      expect(messages).toHaveLength(1); // Only message from CS1002
      expect(messages[0].senderStudentId).toBe("2025CS1002");
    });

    test("should mark conversation as read", async () => {
      const result = await Message.markConversationAsRead(
        conversationId,
        "2025CS1001"
      );
      expect(result.modifiedCount).toBeGreaterThan(0);

      // Verify messages are marked as read
      const unreadMessages = await Message.findUnreadMessages(
        conversationId,
        "2025CS1001"
      );
      expect(unreadMessages).toHaveLength(0);
    });

    test("should get message stats", async () => {
      const stats = await Message.getMessageStats(conversationId);
      expect(stats).toHaveLength(2); // text and image types

      const textStats = stats.find((s) => s._id === "text");
      const imageStats = stats.find((s) => s._id === "image");

      expect(textStats.count).toBe(2);
      expect(imageStats.count).toBe(1);
    });

    test("should create system message", async () => {
      const systemMessage = await Message.createSystemMessage(
        conversationId,
        "user_joined",
        { userName: "John Doe" }
      );

      expect(systemMessage.type).toBe("system");
      expect(systemMessage.senderStudentId).toBe("system");
      expect(systemMessage.content.system.action).toBe("user_joined");
      expect(systemMessage.content.system.metadata.userName).toBe("John Doe");
    });
  });

  describe("JSON Transform", () => {
    test("should hide content for deleted messages", async () => {
      const message = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "This will be deleted" },
        isDeleted: true,
      });

      const json = message.toJSON();
      expect(json.content.text).toBe("[deleted]");
    });

    test("should show content for non-deleted messages", async () => {
      const message = new Message({
        conversationId,
        senderStudentId: "2025CS1001",
        type: "text",
        content: { text: "This is visible content" },
      });

      const json = message.toJSON();
      expect(json.content.text).toBe("This is visible content");
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Message.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames.some((name) => name.includes("conversationId_1"))).toBe(
        true
      );
      expect(
        indexNames.some((name) => name.includes("senderStudentId_1"))
      ).toBe(true);
      expect(indexNames.some((name) => name.includes("createdAt_-1"))).toBe(
        true
      );
    });
  });
});
