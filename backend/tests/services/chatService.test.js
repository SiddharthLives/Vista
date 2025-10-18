const chatService = require("../../src/services/chatService");
const Conversation = require("../../src/models/Conversation");
const Message = require("../../src/models/Message");
const User = require("../../src/models/User");

// Mock the models
jest.mock("../../src/models/Conversation");
jest.mock("../../src/models/Message");
jest.mock("../../src/models/User");

describe("ChatService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createDirectConversation", () => {
    it("should create a new direct conversation", async () => {
      const mockConversation = {
        _id: "conv123",
        participants: ["2025CS1001", "2025CS1002"],
        type: "direct",
        save: jest.fn().mockResolvedValue(true),
      };

      Conversation.findDirectConversation = jest.fn().mockResolvedValue(null);
      Conversation.prototype.constructor = jest
        .fn()
        .mockReturnValue(mockConversation);

      const result = await chatService.createDirectConversation(
        "2025CS1001",
        "2025CS1002"
      );

      expect(Conversation.findDirectConversation).toHaveBeenCalledWith(
        "2025CS1001",
        "2025CS1002"
      );
      expect(result).toEqual(mockConversation);
    });

    it("should return existing conversation if found", async () => {
      const existingConversation = {
        _id: "conv123",
        participants: ["2025CS1001", "2025CS1002"],
        type: "direct",
      };

      Conversation.findDirectConversation = jest
        .fn()
        .mockResolvedValue(existingConversation);

      const result = await chatService.createDirectConversation(
        "2025CS1001",
        "2025CS1002"
      );

      expect(result).toEqual(existingConversation);
    });

    it("should throw error for invalid student IDs", async () => {
      await expect(
        chatService.createDirectConversation("invalid", "2025CS1002")
      ).rejects.toThrow("Invalid student ID format");

      await expect(
        chatService.createDirectConversation("2025CS1001", "invalid")
      ).rejects.toThrow("Invalid student ID format");
    });

    it("should throw error when trying to create conversation with self", async () => {
      await expect(
        chatService.createDirectConversation("2025CS1001", "2025CS1001")
      ).rejects.toThrow("Cannot create conversation with yourself");
    });
  });

  describe("createGroupConversation", () => {
    it("should create a new group conversation", async () => {
      const mockConversation = {
        _id: "conv123",
        participants: ["2025CS1001", "2025CS1002", "2025CS1003"],
        type: "group",
        groupName: "Study Group",
        save: jest.fn().mockResolvedValue(true),
      };

      Conversation.prototype.constructor = jest
        .fn()
        .mockReturnValue(mockConversation);

      const result = await chatService.createGroupConversation(
        "2025CS1001",
        ["2025CS1002", "2025CS1003"],
        "Study Group"
      );

      expect(result.participants).toContain("2025CS1001");
      expect(result.participants).toContain("2025CS1002");
      expect(result.participants).toContain("2025CS1003");
      expect(result.groupName).toBe("Study Group");
    });

    it("should throw error for insufficient participants", async () => {
      await expect(
        chatService.createGroupConversation("2025CS1001", [], "Study Group")
      ).rejects.toThrow("Group conversation requires at least 2 participants");

      await expect(
        chatService.createGroupConversation(
          "2025CS1001",
          ["2025CS1002"],
          "Study Group"
        )
      ).rejects.toThrow("Group conversation requires at least 2 participants");
    });

    it("should throw error for missing group name", async () => {
      await expect(
        chatService.createGroupConversation("2025CS1001", [
          "2025CS1002",
          "2025CS1003",
        ])
      ).rejects.toThrow("Group name is required");
    });

    it("should remove duplicate participants", async () => {
      const mockConversation = {
        _id: "conv123",
        participants: ["2025CS1001", "2025CS1002", "2025CS1003"],
        type: "group",
        groupName: "Study Group",
        save: jest.fn().mockResolvedValue(true),
      };

      Conversation.prototype.constructor = jest
        .fn()
        .mockReturnValue(mockConversation);

      const result = await chatService.createGroupConversation(
        "2025CS1001",
        ["2025CS1002", "2025CS1003", "2025CS1002"], // Duplicate
        "Study Group"
      );

      expect(result.participants).toHaveLength(3);
    });
  });

  describe("sendMessage", () => {
    const mockConversation = {
      _id: "conv123",
      participants: ["2025CS1001", "2025CS1002"],
      isParticipant: jest.fn().mockReturnValue(true),
      updateLastMessage: jest.fn().mockResolvedValue(true),
    };

    const mockMessage = {
      _id: "msg123",
      conversationId: "conv123",
      senderStudentId: "2025CS1001",
      text: "Hello",
      save: jest.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
      Conversation.findById = jest.fn().mockResolvedValue(mockConversation);
      Message.prototype.constructor = jest.fn().mockReturnValue(mockMessage);
    });

    it("should send a text message", async () => {
      const result = await chatService.sendMessage(
        "conv123",
        "2025CS1001",
        "Hello",
        "text"
      );

      expect(Conversation.findById).toHaveBeenCalledWith("conv123");
      expect(mockConversation.isParticipant).toHaveBeenCalledWith("2025CS1001");
      expect(mockConversation.updateLastMessage).toHaveBeenCalledWith(
        "Hello",
        "2025CS1001"
      );
      expect(result).toEqual(mockMessage);
    });

    it("should send a media message", async () => {
      const mediaData = {
        url: "https://example.com/image.jpg",
        cloudinaryPublicId:
          "college/2025-CS/dept-CS/section-A/student-2025CS1001/image",
        mediaType: "image",
      };

      const mediaMessage = {
        ...mockMessage,
        type: "media",
        media: mediaData,
      };

      Message.prototype.constructor = jest.fn().mockReturnValue(mediaMessage);

      const result = await chatService.sendMessage(
        "conv123",
        "2025CS1001",
        null,
        "media",
        mediaData
      );

      expect(result.type).toBe("media");
      expect(result.media).toEqual(mediaData);
    });

    it("should throw error for non-existent conversation", async () => {
      Conversation.findById = jest.fn().mockResolvedValue(null);

      await expect(
        chatService.sendMessage("invalid", "2025CS1001", "Hello")
      ).rejects.toThrow("Conversation not found");
    });

    it("should throw error for non-participant", async () => {
      mockConversation.isParticipant.mockReturnValue(false);

      await expect(
        chatService.sendMessage("conv123", "2025CS1003", "Hello")
      ).rejects.toThrow("User is not a participant in this conversation");
    });

    it("should throw error for missing text in text message", async () => {
      await expect(
        chatService.sendMessage("conv123", "2025CS1001", "", "text")
      ).rejects.toThrow("Text is required for text messages");
    });

    it("should throw error for missing media in media message", async () => {
      await expect(
        chatService.sendMessage("conv123", "2025CS1001", null, "media")
      ).rejects.toThrow("Media data is required for media messages");
    });
  });

  describe("getConversationMessages", () => {
    it("should get messages for a conversation", async () => {
      const mockMessages = [
        { _id: "msg1", text: "Hello" },
        { _id: "msg2", text: "Hi there" },
      ];

      Message.getConversationMessages = jest.fn().mockResolvedValue({
        messages: mockMessages,
        hasMore: false,
        totalCount: 2,
      });

      const result = await chatService.getConversationMessages("conv123", {
        limit: 20,
        page: 1,
      });

      expect(Message.getConversationMessages).toHaveBeenCalledWith("conv123", {
        limit: 20,
        page: 1,
      });
      expect(result.messages).toEqual(mockMessages);
      expect(result.hasMore).toBe(false);
    });

    it("should use default pagination options", async () => {
      Message.getConversationMessages = jest.fn().mockResolvedValue({
        messages: [],
        hasMore: false,
        totalCount: 0,
      });

      await chatService.getConversationMessages("conv123");

      expect(Message.getConversationMessages).toHaveBeenCalledWith("conv123", {
        limit: 50,
        page: 1,
      });
    });
  });

  describe("getUserConversations", () => {
    it("should get conversations for a user", async () => {
      const mockConversations = [
        { _id: "conv1", participants: ["2025CS1001", "2025CS1002"] },
        { _id: "conv2", participants: ["2025CS1001", "2025CS1003"] },
      ];

      Conversation.findForUser = jest.fn().mockResolvedValue(mockConversations);

      const result = await chatService.getUserConversations("2025CS1001");

      expect(Conversation.findForUser).toHaveBeenCalledWith("2025CS1001");
      expect(result).toEqual(mockConversations);
    });

    it("should throw error for invalid student ID", async () => {
      await expect(chatService.getUserConversations("invalid")).rejects.toThrow(
        "Invalid student ID format"
      );
    });
  });

  describe("markMessageAsRead", () => {
    it("should mark message as read", async () => {
      const mockMessage = {
        _id: "msg123",
        markAsRead: jest.fn().mockResolvedValue(true),
      };

      Message.findById = jest.fn().mockResolvedValue(mockMessage);

      await chatService.markMessageAsRead("msg123", "2025CS1001");

      expect(Message.findById).toHaveBeenCalledWith("msg123");
      expect(mockMessage.markAsRead).toHaveBeenCalledWith("2025CS1001");
    });

    it("should throw error for non-existent message", async () => {
      Message.findById = jest.fn().mockResolvedValue(null);

      await expect(
        chatService.markMessageAsRead("invalid", "2025CS1001")
      ).rejects.toThrow("Message not found");
    });
  });

  describe("markConversationAsRead", () => {
    it("should mark conversation as read", async () => {
      const mockConversation = {
        _id: "conv123",
        markAsRead: jest.fn().mockResolvedValue(true),
      };

      Conversation.findById = jest.fn().mockResolvedValue(mockConversation);

      await chatService.markConversationAsRead("conv123", "2025CS1001");

      expect(Conversation.findById).toHaveBeenCalledWith("conv123");
      expect(mockConversation.markAsRead).toHaveBeenCalledWith("2025CS1001");
    });

    it("should throw error for non-existent conversation", async () => {
      Conversation.findById = jest.fn().mockResolvedValue(null);

      await expect(
        chatService.markConversationAsRead("invalid", "2025CS1001")
      ).rejects.toThrow("Conversation not found");
    });
  });

  describe("addParticipantToGroup", () => {
    it("should add participant to group conversation", async () => {
      const mockConversation = {
        _id: "conv123",
        type: "group",
        addParticipant: jest.fn().mockResolvedValue(true),
      };

      Conversation.findById = jest.fn().mockResolvedValue(mockConversation);

      await chatService.addParticipantToGroup("conv123", "2025CS1003");

      expect(Conversation.findById).toHaveBeenCalledWith("conv123");
      expect(mockConversation.addParticipant).toHaveBeenCalledWith(
        "2025CS1003"
      );
    });

    it("should throw error for direct conversation", async () => {
      const mockConversation = {
        _id: "conv123",
        type: "direct",
      };

      Conversation.findById = jest.fn().mockResolvedValue(mockConversation);

      await expect(
        chatService.addParticipantToGroup("conv123", "2025CS1003")
      ).rejects.toThrow("Can only add participants to group conversations");
    });
  });

  describe("removeParticipantFromGroup", () => {
    it("should remove participant from group conversation", async () => {
      const mockConversation = {
        _id: "conv123",
        type: "group",
        removeParticipant: jest.fn().mockResolvedValue(true),
      };

      Conversation.findById = jest.fn().mockResolvedValue(mockConversation);

      await chatService.removeParticipantFromGroup("conv123", "2025CS1003");

      expect(Conversation.findById).toHaveBeenCalledWith("conv123");
      expect(mockConversation.removeParticipant).toHaveBeenCalledWith(
        "2025CS1003"
      );
    });

    it("should throw error for direct conversation", async () => {
      const mockConversation = {
        _id: "conv123",
        type: "direct",
      };

      Conversation.findById = jest.fn().mockResolvedValue(mockConversation);

      await expect(
        chatService.removeParticipantFromGroup("conv123", "2025CS1003")
      ).rejects.toThrow(
        "Can only remove participants from group conversations"
      );
    });
  });

  describe("searchMessages", () => {
    it("should search messages by text", async () => {
      const mockMessages = [
        { _id: "msg1", text: "Hello world" },
        { _id: "msg2", text: "Hello there" },
      ];

      Message.searchMessages = jest.fn().mockResolvedValue(mockMessages);

      const result = await chatService.searchMessages("Hello", "2025CS1001");

      expect(Message.searchMessages).toHaveBeenCalledWith(
        "Hello",
        "2025CS1001"
      );
      expect(result).toEqual(mockMessages);
    });

    it("should throw error for empty search query", async () => {
      await expect(
        chatService.searchMessages("", "2025CS1001")
      ).rejects.toThrow("Search query is required");
    });
  });

  describe("getUnreadMessageCount", () => {
    it("should get unread message count for user", async () => {
      Message.getUnreadCount = jest.fn().mockResolvedValue(5);

      const result = await chatService.getUnreadMessageCount("2025CS1001");

      expect(Message.getUnreadCount).toHaveBeenCalledWith("2025CS1001");
      expect(result).toBe(5);
    });
  });

  describe("deleteMessage", () => {
    it("should delete message by author", async () => {
      const mockMessage = {
        _id: "msg123",
        senderStudentId: "2025CS1001",
        markAsInactive: jest.fn().mockResolvedValue(true),
      };

      Message.findById = jest.fn().mockResolvedValue(mockMessage);

      await chatService.deleteMessage("msg123", "2025CS1001");

      expect(Message.findById).toHaveBeenCalledWith("msg123");
      expect(mockMessage.markAsInactive).toHaveBeenCalled();
    });

    it("should throw error when non-author tries to delete", async () => {
      const mockMessage = {
        _id: "msg123",
        senderStudentId: "2025CS1001",
      };

      Message.findById = jest.fn().mockResolvedValue(mockMessage);

      await expect(
        chatService.deleteMessage("msg123", "2025CS1002")
      ).rejects.toThrow("Only the message author can delete this message");
    });
  });

  describe("validateStudentId", () => {
    it("should validate correct student ID format", () => {
      expect(() => chatService.validateStudentId("2025CS1001")).not.toThrow();
    });

    it("should throw error for invalid student ID format", () => {
      expect(() => chatService.validateStudentId("invalid")).toThrow(
        "Invalid student ID format"
      );
      expect(() => chatService.validateStudentId("2025CS")).toThrow(
        "Invalid student ID format"
      );
      expect(() => chatService.validateStudentId("CS1001")).toThrow(
        "Invalid student ID format"
      );
    });
  });
});
