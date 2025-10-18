const Conversation = require("../../src/models/Conversation");
const Message = require("../../src/models/Message");

describe("Conversation Model", () => {
  beforeEach(async () => {
    await Conversation.deleteMany({});
    await Message.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validConversationData = {
      participants: ["2025CS1001", "2025CS1002"],
      type: "direct",
    };

    test("should create a valid conversation", async () => {
      const conversation = new Conversation(validConversationData);
      const savedConversation = await conversation.save();

      expect(savedConversation._id).toBeDefined();
      expect(savedConversation.participants).toEqual([
        "2025CS1001",
        "2025CS1002",
      ]);
      expect(savedConversation.type).toBe("direct");
      expect(savedConversation.isActive).toBe(true);
      expect(savedConversation.createdAt).toBeDefined();
      expect(savedConversation.updatedAt).toBeDefined();
    });

    test("should require participants", async () => {
      const conversationData = { ...validConversationData };
      delete conversationData.participants;

      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).rejects.toThrow(
        "Participants are required"
      );
    });

    test("should require at least 2 participants", async () => {
      const conversation = new Conversation({
        ...validConversationData,
        participants: ["2025CS1001"],
      });
      await expect(conversation.save()).rejects.toThrow(
        "At least 2 participants are required"
      );
    });

    test("should validate participant studentId format", async () => {
      const conversation = new Conversation({
        ...validConversationData,
        participants: ["2025CS1001", "invalid-id"],
      });
      await expect(conversation.save()).rejects.toThrow(
        "All participants must have valid student ID format"
      );
    });

    test("should not allow duplicate participants", async () => {
      const conversation = new Conversation({
        ...validConversationData,
        participants: ["2025CS1001", "2025CS1001"],
      });
      await expect(conversation.save()).rejects.toThrow(
        "Participants must be unique"
      );
    });

    test("should validate conversation type", async () => {
      const conversation = new Conversation({
        ...validConversationData,
        type: "invalid",
      });
      await expect(conversation.save()).rejects.toThrow(
        "Conversation type must be either direct or group"
      );
    });

    test("should validate group name for group conversations", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025CS1003"],
        type: "group",
        groupName: "",
      });
      await expect(conversation.save()).rejects.toThrow(
        "Group name is required for group conversations"
      );
    });

    test("should validate group name length", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025CS1003"],
        type: "group",
        groupName: "A".repeat(101),
      });
      await expect(conversation.save()).rejects.toThrow(
        "Group name cannot exceed 100 characters"
      );
    });

    test("should auto-sort participants", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1002", "2025CS1001"],
        type: "direct",
      });
      const savedConversation = await conversation.save();

      expect(savedConversation.participants).toEqual([
        "2025CS1001",
        "2025CS1002",
      ]);
    });

    test("should trim group name", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025CS1003"],
        type: "group",
        groupName: "  Test Group  ",
      });
      const savedConversation = await conversation.save();

      expect(savedConversation.groupName).toBe("Test Group");
    });
  });

  describe("Instance Methods", () => {
    let conversation;

    beforeEach(async () => {
      conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002"],
        type: "direct",
      });
      await conversation.save();
    });

    test("should add participant to group conversation", async () => {
      // Convert to group conversation
      conversation.type = "group";
      conversation.groupName = "Test Group";
      await conversation.save();

      await conversation.addParticipant("2025CS1003");
      expect(conversation.participants).toContain("2025CS1003");
      expect(conversation.participants).toHaveLength(3);
    });

    test("should not add duplicate participant", async () => {
      conversation.type = "group";
      conversation.groupName = "Test Group";
      await conversation.save();

      await conversation.addParticipant("2025CS1001");
      expect(conversation.participants).toHaveLength(2);
    });

    test("should not add participant to direct conversation", async () => {
      await expect(conversation.addParticipant("2025CS1003")).rejects.toThrow(
        "Cannot add participants to direct conversations"
      );
    });

    test("should remove participant from group conversation", async () => {
      conversation.type = "group";
      conversation.groupName = "Test Group";
      conversation.participants = ["2025CS1001", "2025CS1002", "2025CS1003"];
      await conversation.save();

      await conversation.removeParticipant("2025CS1003");
      expect(conversation.participants).not.toContain("2025CS1003");
      expect(conversation.participants).toHaveLength(2);
    });

    test("should not remove participant from direct conversation", async () => {
      await expect(
        conversation.removeParticipant("2025CS1001")
      ).rejects.toThrow("Cannot remove participants from direct conversations");
    });

    test("should update last message", async () => {
      const messageText = "Hello, how are you?";
      await conversation.updateLastMessage(messageText, "2025CS1001");

      expect(conversation.lastMessage.text).toBe(messageText);
      expect(conversation.lastMessage.senderStudentId).toBe("2025CS1001");
      expect(conversation.lastMessage.timestamp).toBeDefined();
      expect(conversation.updatedAt).toBeDefined();
    });

    test("should mark as read for user", async () => {
      await conversation.markAsRead("2025CS1001");
      expect(conversation.readBy).toContain("2025CS1001");
    });

    test("should not add duplicate read status", async () => {
      await conversation.markAsRead("2025CS1001");
      await conversation.markAsRead("2025CS1001");
      expect(
        conversation.readBy.filter((id) => id === "2025CS1001")
      ).toHaveLength(1);
    });

    test("should check if user is participant", () => {
      expect(conversation.isParticipant("2025CS1001")).toBe(true);
      expect(conversation.isParticipant("2025CS1003")).toBe(false);
    });

    test("should get other participant in direct conversation", () => {
      const otherParticipant = conversation.getOtherParticipant("2025CS1001");
      expect(otherParticipant).toBe("2025CS1002");
    });

    test("should return null for other participant in group conversation", () => {
      conversation.type = "group";
      const otherParticipant = conversation.getOtherParticipant("2025CS1001");
      expect(otherParticipant).toBeNull();
    });

    test("should mark as inactive", async () => {
      await conversation.markAsInactive();
      expect(conversation.isActive).toBe(false);
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const conversations = [
        {
          participants: ["2025CS1001", "2025CS1002"],
          type: "direct",
          lastMessage: {
            text: "Hello",
            senderStudentId: "2025CS1001",
            timestamp: new Date(),
          },
        },
        {
          participants: ["2025CS1001", "2025CS1003"],
          type: "direct",
          lastMessage: {
            text: "Hi there",
            senderStudentId: "2025CS1003",
            timestamp: new Date(Date.now() - 1000),
          },
        },
        {
          participants: ["2025CS1001", "2025CS1002", "2025CS1003"],
          type: "group",
          groupName: "Study Group",
          lastMessage: {
            text: "Group message",
            senderStudentId: "2025CS1002",
            timestamp: new Date(Date.now() - 2000),
          },
        },
        {
          participants: ["2025CS1004", "2025CS1005"],
          type: "direct",
          isActive: false,
        },
      ];

      await Conversation.insertMany(conversations);
    });

    test("should find conversations for user", async () => {
      const conversations = await Conversation.findForUser("2025CS1001");
      expect(conversations).toHaveLength(3); // Only active conversations
    });

    test("should find direct conversation between users", async () => {
      const conversation = await Conversation.findDirectConversation(
        "2025CS1001",
        "2025CS1002"
      );
      expect(conversation).toBeTruthy();
      expect(conversation.type).toBe("direct");
    });

    test("should return null if no direct conversation exists", async () => {
      const conversation = await Conversation.findDirectConversation(
        "2025CS1001",
        "2025CS1006"
      );
      expect(conversation).toBeNull();
    });

    test("should create or find direct conversation", async () => {
      // Should find existing conversation
      const existing = await Conversation.createOrFindDirect(
        "2025CS1001",
        "2025CS1002"
      );
      expect(existing.participants).toEqual(["2025CS1001", "2025CS1002"]);

      // Should create new conversation
      const newConv = await Conversation.createOrFindDirect(
        "2025CS1001",
        "2025CS1006"
      );
      expect(newConv.participants).toEqual(["2025CS1001", "2025CS1006"]);
      expect(newConv.type).toBe("direct");
    });

    test("should get conversation stats", async () => {
      const stats = await Conversation.getConversationStats("2025CS1001");
      expect(stats.totalConversations).toBe(3);
      expect(stats.directConversations).toBe(2);
      expect(stats.groupConversations).toBe(1);
    });
  });

  describe("Virtuals", () => {
    test("should check if conversation is group", async () => {
      const directConv = new Conversation({
        participants: ["2025CS1001", "2025CS1002"],
        type: "direct",
      });
      expect(directConv.isGroup).toBe(false);

      const groupConv = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025CS1003"],
        type: "group",
        groupName: "Test Group",
      });
      expect(groupConv.isGroup).toBe(true);
    });

    test("should get participant count", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025CS1003"],
        type: "group",
        groupName: "Test Group",
      });
      expect(conversation.participantCount).toBe(3);
    });

    test("should check if conversation has unread messages", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002"],
        type: "direct",
        lastMessage: {
          text: "Hello",
          senderStudentId: "2025CS1002",
          timestamp: new Date(),
        },
        readBy: ["2025CS1002"],
      });

      expect(conversation.hasUnreadMessages("2025CS1001")).toBe(true);
      expect(conversation.hasUnreadMessages("2025CS1002")).toBe(false);
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Conversation.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames.some((name) => name.includes("participants_1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("updatedAt_-1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("isActive_1"))).toBe(true);
    });
  });
});
