const Message = require("../../src/models/Message");
const Conversation = require("../../src/models/Conversation");

describe("Message Model", () => {
  beforeEach(async () => {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validMessageData = {
      conversationId: "507f1f77bcf86cd799439011",
      senderStudentId: "2025CS1001",
      text: "Hello, how are you?",
    };

    test("should create a valid text message", async () => {
      const message = new Message(validMessageData);
      const savedMessage = await message.save();

      expect(savedMessage._id).toBeDefined();
      expect(savedMessage.conversationId.toString()).toBe(
        "507f1f77bcf86cd799439011"
      );
      expect(savedMessage.senderStudentId).toBe("2025CS1001");
      expect(savedMessage.text).toBe("Hello, how are you?");
      expect(savedMessage.type).toBe("text");
      expect(savedMessage.isActive).toBe(true);
      expect(savedMessage.createdAt).toBeDefined();
      expect(savedMessage.readBy).toHaveLength(0);
    });

    test("should create a valid media message", async () => {
      const mediaMessageData = {
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        type: "media",
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/photo.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/photo",
          mediaType: "image",
          width: 800,
          height: 600,
        },
      };

      const message = new Message(mediaMessageData);
      const savedMessage = await message.save();

      expect(savedMessage.type).toBe("media");
      expect(savedMessage.media.url).toBe(mediaMessageData.media.url);
      expect(savedMessage.media.mediaType).toBe("image");
    });

    test("should require conversationId", async () => {
      const messageData = { ...validMessageData };
      delete messageData.conversationId;

      const message = new Message(messageData);
      await expect(message.save()).rejects.toThrow(
        "Conversation ID is required"
      );
    });

    test("should validate conversationId format", async () => {
      const message = new Message({
        ...validMessageData,
        conversationId: "invalid-id",
      });
      await expect(message.save()).rejects.toThrow(
        "Conversation ID must be a valid ObjectId"
      );
    });

    test("should require senderStudentId", async () => {
      const messageData = { ...validMessageData };
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
          ...validMessageData,
          senderStudentId: invalidId,
        });
        await expect(message.save()).rejects.toThrow(
          "Sender student ID must follow format"
        );
      }
    });

    test("should validate message type", async () => {
      const message = new Message({
        ...validMessageData,
        type: "invalid",
      });
      await expect(message.save()).rejects.toThrow(
        "Message type must be either text or media"
      );
    });

    test("should require text for text messages", async () => {
      const message = new Message({
        ...validMessageData,
        text: "",
      });
      await expect(message.save()).rejects.toThrow(
        "Text is required for text messages"
      );
    });

    test("should validate text length", async () => {
      const message = new Message({
        ...validMessageData,
        text: "A".repeat(2001),
      });
      await expect(message.save()).rejects.toThrow(
        "Message text cannot exceed 2000 characters"
      );
    });

    test("should require media for media messages", async () => {
      const message = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        type: "media",
      });
      await expect(message.save()).rejects.toThrow(
        "Media is required for media messages"
      );
    });

    test("should validate media URL format", async () => {
      const message = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        type: "media",
        media: {
          url: "invalid-url",
          cloudinaryPublicId: "test/path",
          mediaType: "image",
        },
      });
      await expect(message.save()).rejects.toThrow(
        "Media URL must be a valid HTTP/HTTPS URL"
      );
    });

    test("should validate cloudinary public ID format", async () => {
      const message = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        type: "media",
        media: {
          url: "https://example.com/image.jpg",
          cloudinaryPublicId: "invalid/path",
          mediaType: "image",
        },
      });
      await expect(message.save()).rejects.toThrow(
        "Cloudinary public ID must follow college folder structure"
      );
    });

    test("should validate media type", async () => {
      const message = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        type: "media",
        media: {
          url: "https://example.com/file.pdf",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/file",
          mediaType: "document",
        },
      });
      await expect(message.save()).rejects.toThrow(
        "Media type must be either image or video"
      );
    });

    test("should validate readBy student IDs", async () => {
      const message = new Message({
        ...validMessageData,
        readBy: [{ studentId: "invalid-id", readAt: new Date() }],
      });
      await expect(message.save()).rejects.toThrow(
        "Student ID must follow format"
      );
    });

    test("should trim text content", async () => {
      const message = new Message({
        ...validMessageData,
        text: "  This is trimmed text  ",
      });
      const savedMessage = await message.save();

      expect(savedMessage.text).toBe("This is trimmed text");
    });
  });

  describe("Instance Methods", () => {
    let message;

    beforeEach(async () => {
      message = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        text: "Test message",
      });
      await message.save();
    });

    test("should mark as read by user", async () => {
      await message.markAsRead("2025CS1002");

      expect(message.readBy).toHaveLength(1);
      expect(message.readBy[0].studentId).toBe("2025CS1002");
      expect(message.readBy[0].readAt).toBeDefined();
    });

    test("should not add duplicate read status", async () => {
      await message.markAsRead("2025CS1002");
      await message.markAsRead("2025CS1002");

      expect(message.readBy).toHaveLength(1);
    });

    test("should check if read by user", async () => {
      await message.markAsRead("2025CS1002");

      expect(message.isReadBy("2025CS1002")).toBe(true);
      expect(message.isReadBy("2025CS1003")).toBe(false);
    });

    test("should get read status for user", async () => {
      await message.markAsRead("2025CS1002");

      const readStatus = message.getReadStatus("2025CS1002");
      expect(readStatus).toBeTruthy();
      expect(readStatus.readAt).toBeDefined();

      const noReadStatus = message.getReadStatus("2025CS1003");
      expect(noReadStatus).toBeNull();
    });

    test("should mark as inactive", async () => {
      await message.markAsInactive();
      expect(message.isActive).toBe(false);
    });

    test("should update text content", async () => {
      const newText = "Updated message text";
      await message.updateText(newText);

      expect(message.text).toBe(newText);
      expect(message.isEdited).toBe(true);
      expect(message.editedAt).toBeDefined();
    });

    test("should not update text for media messages", async () => {
      const mediaMessage = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        type: "media",
        media: {
          url: "https://example.com/image.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/image",
          mediaType: "image",
        },
      });
      await mediaMessage.save();

      await expect(mediaMessage.updateText("New text")).rejects.toThrow(
        "Cannot update text for media messages"
      );
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const messages = [
        {
          conversationId: "507f1f77bcf86cd799439011",
          senderStudentId: "2025CS1001",
          text: "First message",
          createdAt: new Date(Date.now() - 3000),
        },
        {
          conversationId: "507f1f77bcf86cd799439011",
          senderStudentId: "2025CS1002",
          text: "Second message",
          createdAt: new Date(Date.now() - 2000),
        },
        {
          conversationId: "507f1f77bcf86cd799439012",
          senderStudentId: "2025CS1001",
          text: "Different conversation",
          createdAt: new Date(Date.now() - 1000),
        },
        {
          conversationId: "507f1f77bcf86cd799439011",
          senderStudentId: "2025CS1001",
          text: "Inactive message",
          isActive: false,
        },
      ];

      await Message.insertMany(messages);
    });

    test("should find messages by conversation", async () => {
      const messages = await Message.findByConversation(
        "507f1f77bcf86cd799439011"
      );
      expect(messages).toHaveLength(2); // Only active messages
      expect(messages[0].text).toBe("Second message"); // Newest first
      expect(messages[1].text).toBe("First message");
    });

    test("should find messages by sender", async () => {
      const messages = await Message.findBySender("2025CS1001");
      expect(messages).toHaveLength(2); // Only active messages
    });

    test("should get conversation messages with pagination", async () => {
      const result = await Message.getConversationMessages(
        "507f1f77bcf86cd799439011",
        { limit: 1 }
      );
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].text).toBe("Second message");
      expect(result.hasMore).toBe(true);
    });

    test("should search messages by text", async () => {
      const messages = await Message.searchMessages("First");
      expect(messages).toHaveLength(1);
      expect(messages[0].text).toBe("First message");
    });

    test("should get unread messages for user", async () => {
      // Mark one message as read
      const message = await Message.findOne({ text: "First message" });
      await message.markAsRead("2025CS1002");

      const unreadMessages = await Message.getUnreadMessages("2025CS1002");
      expect(unreadMessages).toHaveLength(1);
      expect(unreadMessages[0].text).toBe("Second message");
    });

    test("should get message stats", async () => {
      const stats = await Message.getMessageStats("2025CS1001");
      expect(stats.totalMessages).toBe(2);
      expect(stats.textMessages).toBe(2);
      expect(stats.mediaMessages).toBe(0);
    });
  });

  describe("Virtuals", () => {
    test("should check if message is media", async () => {
      const textMessage = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        text: "Text message",
      });
      expect(textMessage.isMedia).toBe(false);

      const mediaMessage = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        type: "media",
        media: {
          url: "https://example.com/image.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/image",
          mediaType: "image",
        },
      });
      expect(mediaMessage.isMedia).toBe(true);
    });

    test("should get read count", async () => {
      const message = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        text: "Test message",
        readBy: [
          { studentId: "2025CS1002", readAt: new Date() },
          { studentId: "2025CS1003", readAt: new Date() },
        ],
      });
      expect(message.readCount).toBe(2);
    });

    test("should check if message is recent", async () => {
      const recentMessage = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        text: "Recent message",
        createdAt: new Date(),
      });
      expect(recentMessage.isRecent).toBe(true);

      const oldMessage = new Message({
        conversationId: "507f1f77bcf86cd799439011",
        senderStudentId: "2025CS1001",
        text: "Old message",
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      });
      expect(oldMessage.isRecent).toBe(false);
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Message.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames.some((name) => name.includes("conversationId_1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("createdAt_-1"))).toBe(
        true
      );
      expect(
        indexNames.some((name) => name.includes("senderStudentId_1"))
      ).toBe(true);
      expect(indexNames.some((name) => name.includes("isActive_1"))).toBe(true);
    });
  });
});
