const Conversation = require("../../src/models/Conversation");

describe("Conversation Model", () => {
  beforeEach(async () => {
    await Conversation.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validDirectConversationData = {
      participants: ["2025CS1001", "2025CS1002"],
      type: "direct",
    };

    const validGroupConversationData = {
      participants: ["2025CS1001", "2025CS1002", "2025ECE1001"],
      type: "group",
      title: "Study Group",
      createdBy: "2025CS1001",
    };

    test("should create a valid direct conversation", async () => {
      const conversation = new Conversation(validDirectConversationData);
      const savedConversation = await conversation.save();

      expect(savedConversation._id).toBeDefined();
      expect(savedConversation.participants).toEqual([
        "2025CS1001",
        "2025CS1002",
      ]);
      expect(savedConversation.type).toBe("direct");
      expect(savedConversation.messagesCount).toBe(0);
      expect(savedConversation.isActive).toBe(true);
      expect(savedConversation.createdAt).toBeDefined();
      expect(savedConversation.updatedAt).toBeDefined();
      expect(savedConversation.admins).toHaveLength(0);
    });

    test("should create a valid group conversation", async () => {
      const conversation = new Conversation(validGroupConversationData);
      const savedConversation = await conversation.save();

      expect(savedConversation.type).toBe("group");
      expect(savedConversation.title).toBe("Study Group");
      expect(savedConversation.createdBy).toBe("2025CS1001");
      expect(savedConversation.admins).toContain("2025CS1001");
      expect(savedConversation.participants).toHaveLength(3);
    });

    test("should require participants", async () => {
      const conversationData = { ...validDirectConversationData };
      delete conversationData.participants;

      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).rejects.toThrow(
        "Conversation must have at least one participant"
      );
    });

    test("should validate participant student ID format", async () => {
      const invalidIds = ["invalid", "2025CS", "CS1001", "25CS1001"];

      for (const invalidId of invalidIds) {
        const conversation = new Conversation({
          ...validDirectConversationData,
          participants: [invalidId, "2025CS1002"],
        });
        await expect(conversation.save()).rejects.toThrow(
          "Participant student ID must follow format"
        );
      }
    });

    test("should validate direct conversation has exactly 2 participants", async () => {
      const conversation1 = new Conversation({
        type: "direct",
        participants: ["2025CS1001"],
      });
      await expect(conversation1.save()).rejects.toThrow(
        "Direct conversations must have exactly 2 participants"
      );

      const conversation2 = new Conversation({
        type: "direct",
        participants: ["2025CS1001", "2025CS1002", "2025ECE1001"],
      });
      await expect(conversation2.save()).rejects.toThrow(
        "Direct conversations must have exactly 2 participants"
      );
    });

    test("should validate group conversation has at least 2 participants", async () => {
      const conversation = new Conversation({
        type: "group",
        participants: ["2025CS1001"],
      });
      await expect(conversation.save()).rejects.toThrow(
        "Group conversations must have at least 2 participants"
      );
    });

    test("should validate title length", async () => {
      const conversation = new Conversation({
        ...validGroupConversationData,
        title: "A".repeat(101),
      });
      await expect(conversation.save()).rejects.toThrow(
        "Conversation title cannot exceed 100 characters"
      );
    });

    test("should validate creator student ID format", async () => {
      const conversation = new Conversation({
        ...validGroupConversationData,
        createdBy: "invalid-id",
      });
      await expect(conversation.save()).rejects.toThrow(
        "Creator student ID must follow format"
      );
    });

    test("should validate admin student ID format", async () => {
      const conversation = new Conversation({
        ...validGroupConversationData,
        admins: ["invalid-id"],
      });
      await expect(conversation.save()).rejects.toThrow(
        "Admin student ID must follow format"
      );
    });

    test("should remove duplicate participants", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025CS1001"],
        type: "direct",
      });

      // This should fail because after deduplication, there's only 2 participants but we have 3 initially
      // Let's test with a group instead
      const groupConversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025CS1001", "2025ECE1001"],
        type: "group",
      });
      const savedConversation = await groupConversation.save();

      expect(savedConversation.participants).toHaveLength(3);
      expect(savedConversation.participants).toEqual([
        "2025CS1001",
        "2025CS1002",
        "2025ECE1001",
      ]);
    });

    test("should ensure admins are participants", async () => {
      const conversation = new Conversation({
        ...validGroupConversationData,
        admins: ["2025CS1001", "2025ME1001"], // ME1001 is not a participant
      });
      const savedConversation = await conversation.save();

      expect(savedConversation.admins).toContain("2025CS1001");
      expect(savedConversation.admins).not.toContain("2025ME1001");
    });

    test("should set creator as admin for group conversations", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025ECE1001"],
        type: "group",
        createdBy: "2025CS1002",
        admins: [], // Empty admins array
      });
      const savedConversation = await conversation.save();

      expect(savedConversation.admins).toContain("2025CS1002");
    });

    test("should trim title and last message content", async () => {
      const conversation = new Conversation({
        ...validGroupConversationData,
        title: "  Trimmed Title  ",
        lastMessage: {
          content: "  Trimmed content  ",
          senderStudentId: "2025CS1001",
        },
      });
      const savedConversation = await conversation.save();

      expect(savedConversation.title).toBe("Trimmed Title");
      expect(savedConversation.lastMessage.content).toBe("Trimmed content");
    });
  });

  describe("Instance Methods", () => {
    let conversationId;

    beforeEach(async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025ECE1001"],
        type: "group",
        title: "Test Group",
        createdBy: "2025CS1001",
      });
      const saved = await conversation.save();
      conversationId = saved._id;
    });

    test("should add participant", async () => {
      const conversation = await Conversation.findById(conversationId);
      await conversation.addParticipant("2025ME1001");
      expect(conversation.participants).toContain("2025ME1001");
      expect(conversation.participants).toHaveLength(4);
    });

    test("should not add duplicate participant", async () => {
      const conversation = await Conversation.findById(conversationId);
      const originalLength = conversation.participants.length;
      await conversation.addParticipant("2025CS1001");
      expect(conversation.participants).toHaveLength(originalLength); // No change
    });

    test("should remove participant", async () => {
      await conversation.removeParticipant("2025ECE1001");
      expect(conversation.participants).not.toContain("2025ECE1001");
      expect(conversation.participants).toHaveLength(2);
    });

    test("should remove participant from admins when removing from conversation", async () => {
      await conversation.addAdmin("2025ECE1001");
      expect(conversation.admins).toContain("2025ECE1001");

      await conversation.removeParticipant("2025ECE1001");
      expect(conversation.admins).not.toContain("2025ECE1001");
    });

    test("should add admin", async () => {
      await conversation.addAdmin("2025CS1002");
      expect(conversation.admins).toContain("2025CS1002");
    });

    test("should not add admin if not participant", async () => {
      await conversation.addAdmin("2025ME1001");
      expect(conversation.admins).not.toContain("2025ME1001");
    });

    test("should remove admin", async () => {
      conversation.admins.push("2025CS1002");
      await conversation.save();

      await conversation.removeAdmin("2025CS1002");
      expect(conversation.admins).not.toContain("2025CS1002");
    });

    test("should check if user is participant", () => {
      expect(conversation.isParticipant("2025CS1001")).toBe(true);
      expect(conversation.isParticipant("2025ME1001")).toBe(false);
    });

    test("should check if user is admin", () => {
      expect(conversation.isAdmin("2025CS1001")).toBe(true);
      expect(conversation.isAdmin("2025CS1002")).toBe(false);
    });

    test("should update last message", async () => {
      const messageData = {
        content: "Hello everyone!",
        senderStudentId: "2025CS1002",
        createdAt: new Date(),
        type: "text",
      };

      await conversation.updateLastMessage(messageData);
      expect(conversation.lastMessage.content).toBe("Hello everyone!");
      expect(conversation.lastMessage.senderStudentId).toBe("2025CS1002");
      expect(conversation.lastMessage.messageType).toBe("text");
    });

    test("should increment message count", async () => {
      const originalCount = conversation.messagesCount;
      await conversation.incrementMessageCount();
      expect(conversation.messagesCount).toBe(originalCount + 1);
    });

    test("should decrement message count", async () => {
      // First increment to have a count > 0
      await conversation.incrementMessageCount();
      await conversation.incrementMessageCount();
      expect(conversation.messagesCount).toBe(2);

      await conversation.decrementMessageCount();
      expect(conversation.messagesCount).toBe(1);
    });

    test("should not decrement message count below zero", async () => {
      expect(conversation.messagesCount).toBe(0);
      await conversation.decrementMessageCount();
      expect(conversation.messagesCount).toBe(0);
    });

    test("should mark as inactive", async () => {
      await conversation.markAsInactive();
      expect(conversation.isActive).toBe(false);
    });

    test("should get other participant in direct conversation", async () => {
      const directConversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002"],
        type: "direct",
      });

      expect(directConversation.getOtherParticipant("2025CS1001")).toBe(
        "2025CS1002"
      );
      expect(directConversation.getOtherParticipant("2025CS1002")).toBe(
        "2025CS1001"
      );
    });

    test("should return null for other participant in group conversation", () => {
      expect(conversation.getOtherParticipant("2025CS1001")).toBeNull();
    });
  });

  describe("Virtuals", () => {
    test("should check if conversation is direct message", async () => {
      const directConversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002"],
        type: "direct",
      });

      expect(directConversation.isDirectMessage).toBe(true);
      expect(directConversation.isGroup).toBe(false);
    });

    test("should check if conversation is group", async () => {
      const groupConversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025ECE1001"],
        type: "group",
      });

      expect(groupConversation.isGroup).toBe(true);
      expect(groupConversation.isDirectMessage).toBe(false);
    });

    test("should get participant count", async () => {
      const conversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025ECE1001"],
        type: "group",
      });

      expect(conversation.participantCount).toBe(3);
    });

    test("should get display title", async () => {
      const groupWithTitle = new Conversation({
        participants: ["2025CS1001", "2025CS1002"],
        type: "group",
        title: "My Group",
      });
      expect(groupWithTitle.displayTitle).toBe("My Group");

      const directConversation = new Conversation({
        participants: ["2025CS1001", "2025CS1002"],
        type: "direct",
      });
      expect(directConversation.displayTitle).toBe("Direct Message");

      const groupWithoutTitle = new Conversation({
        participants: ["2025CS1001", "2025CS1002", "2025ECE1001"],
        type: "group",
      });
      expect(groupWithoutTitle.displayTitle).toBe("Group (3 members)");
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const conversations = [
        {
          participants: ["2025CS1001", "2025CS1002"],
          type: "direct",
          messagesCount: 5,
          updatedAt: new Date(Date.now() - 1000),
        },
        {
          participants: ["2025CS1001", "2025ECE1001"],
          type: "direct",
          messagesCount: 2,
          updatedAt: new Date(Date.now() - 2000),
        },
        {
          participants: ["2025CS1001", "2025CS1002", "2025ECE1001"],
          type: "group",
          title: "Study Group",
          createdBy: "2025CS1001",
          messagesCount: 10,
          updatedAt: new Date(Date.now() - 500),
        },
        {
          participants: ["2025ME1001", "2025ME1002"],
          type: "direct",
          messagesCount: 1,
          isActive: false,
        },
      ];

      await Conversation.insertMany(conversations);
    });

    test("should find conversations by participant", async () => {
      const conversations = await Conversation.findByParticipant("2025CS1001");
      expect(conversations.length).toBeGreaterThanOrEqual(2); // At least 2 active conversations

      // Check that all returned conversations include the participant
      conversations.forEach((conv) => {
        expect(conv.participants).toContain("2025CS1001");
        expect(conv.isActive).toBe(true);
      });
    });

    test("should find direct conversation between two participants", async () => {
      const conversation = await Conversation.findDirectConversation(
        "2025CS1001",
        "2025CS1002"
      );
      expect(conversation).toBeTruthy();
      expect(conversation.type).toBe("direct");
      expect(conversation.participants).toContain("2025CS1001");
      expect(conversation.participants).toContain("2025CS1002");
    });

    test("should find or create direct conversation", async () => {
      // Find existing conversation
      const existing = await Conversation.findOrCreateDirectConversation(
        "2025CS1001",
        "2025CS1002"
      );
      expect(existing).toBeTruthy();

      // Create new conversation
      const newConversation = await Conversation.findOrCreateDirectConversation(
        "2025CS1001",
        "2025ME1001"
      );
      expect(newConversation).toBeTruthy();
      expect(newConversation.participants).toContain("2025CS1001");
      expect(newConversation.participants).toContain("2025ME1001");
    });

    test("should find group conversations", async () => {
      const conversations = await Conversation.findGroupConversations(
        "2025CS1001"
      );
      expect(conversations).toHaveLength(1);
      expect(conversations[0].type).toBe("group");
    });

    test("should create group conversation", async () => {
      const conversation = await Conversation.createGroupConversation(
        "2025CS1001",
        ["2025CS1002", "2025ECE1001"],
        "New Study Group"
      );

      expect(conversation.type).toBe("group");
      expect(conversation.title).toBe("New Study Group");
      expect(conversation.createdBy).toBe("2025CS1001");
      expect(conversation.participants).toContain("2025CS1001");
      expect(conversation.admins).toContain("2025CS1001");
    });

    test("should search conversations", async () => {
      const conversations = await Conversation.searchConversations(
        "2025CS1001",
        "Study"
      );
      expect(conversations).toHaveLength(1);
      expect(conversations[0].title).toBe("Study Group");
    });

    test("should get conversation stats", async () => {
      const stats = await Conversation.getConversationStats("2025CS1001");
      expect(stats).toHaveLength(2); // direct and group

      const directStats = stats.find((s) => s._id === "direct");
      const groupStats = stats.find((s) => s._id === "group");

      expect(directStats.count).toBeGreaterThanOrEqual(1);
      expect(groupStats.count).toBeGreaterThanOrEqual(1);
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
