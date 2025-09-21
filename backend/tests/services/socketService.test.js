const SocketService = require("../../src/services/socketService");
const {
  socketAuthMiddleware,
} = require("../../src/middleware/socketAuthMiddleware");

// Mock dependencies
jest.mock("../../src/middleware/socketAuthMiddleware", () => ({
  socketAuthMiddleware: jest.fn(),
}));

describe("SocketService", () => {
  let mockIo;
  let socketService;
  let mockSocket;

  beforeEach(() => {
    mockIo = {
      use: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
    };

    mockSocket = {
      id: "socket-123",
      user: {
        studentId: "2025CS1001",
        email: "student@college.edu",
        displayName: "Test Student",
        year: 3,
        department: "Computer Science",
        section: "A",
        uid: "firebase-uid",
      },
      join: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
      handshake: {
        address: "127.0.0.1",
      },
    };

    socketService = new SocketService(mockIo);
    jest.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should set up middleware and connection handlers", () => {
      // Create a new instance to test initialization
      const newMockIo = {
        use: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        to: jest.fn(() => ({
          emit: jest.fn(),
        })),
      };

      new SocketService(newMockIo);

      expect(newMockIo.use).toHaveBeenCalledWith(socketAuthMiddleware);
      expect(newMockIo.use).toHaveBeenCalledWith(expect.any(Function));
      expect(newMockIo.on).toHaveBeenCalledWith(
        "connection",
        expect.any(Function)
      );
    });
  });

  describe("Connection Management", () => {
    it("should handle new connection correctly", () => {
      socketService.handleConnection(mockSocket);

      // Should track user connection
      expect(socketService.isUserOnline("2025CS1001")).toBe(true);
      expect(socketService.getUserConnectionCount("2025CS1001")).toBe(1);

      // Should join appropriate rooms
      expect(mockSocket.join).toHaveBeenCalledWith("user:2025CS1001");
      expect(mockSocket.join).toHaveBeenCalledWith("year:3");
      expect(mockSocket.join).toHaveBeenCalledWith("dept:Computer Science");
      expect(mockSocket.join).toHaveBeenCalledWith("section:A");

      // Should emit connection success
      expect(mockSocket.emit).toHaveBeenCalledWith("connected", {
        message: "Successfully connected to real-time server",
        user: {
          studentId: "2025CS1001",
          displayName: "Test Student",
        },
      });

      // Should set up event listeners
      expect(mockSocket.on).toHaveBeenCalledWith(
        "disconnect",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        "user_presence",
        expect.any(Function)
      );
    });

    it("should handle multiple connections from same user", () => {
      const mockSocket2 = {
        ...mockSocket,
        id: "socket-456",
      };

      socketService.handleConnection(mockSocket);
      socketService.handleConnection(mockSocket2);

      expect(socketService.getUserConnectionCount("2025CS1001")).toBe(2);
      expect(socketService.isUserOnline("2025CS1001")).toBe(true);
    });

    it("should handle disconnection correctly", () => {
      socketService.handleConnection(mockSocket);
      expect(socketService.isUserOnline("2025CS1001")).toBe(true);

      socketService.handleDisconnection(mockSocket, "client disconnect");

      expect(socketService.isUserOnline("2025CS1001")).toBe(false);
      expect(socketService.getUserConnectionCount("2025CS1001")).toBe(0);
    });

    it("should keep user online if they have multiple connections", () => {
      const mockSocket2 = {
        ...mockSocket,
        id: "socket-456",
      };

      socketService.handleConnection(mockSocket);
      socketService.handleConnection(mockSocket2);

      socketService.handleDisconnection(mockSocket, "client disconnect");

      expect(socketService.isUserOnline("2025CS1001")).toBe(true);
      expect(socketService.getUserConnectionCount("2025CS1001")).toBe(1);
    });
  });

  describe("User Presence", () => {
    beforeEach(() => {
      socketService.handleConnection(mockSocket);
    });

    it("should handle valid presence updates", () => {
      const presenceData = {
        status: "typing",
        context: { conversationId: "conv-123" },
      };

      socketService.handleUserPresence(mockSocket, presenceData);

      expect(mockSocket.to).toHaveBeenCalledWith("conversation:conv-123");
    });

    it("should reject invalid presence status", () => {
      const presenceData = {
        status: "invalid-status",
        context: { conversationId: "conv-123" },
      };

      socketService.handleUserPresence(mockSocket, presenceData);

      expect(mockSocket.emit).toHaveBeenCalledWith("error", {
        message: "Invalid presence status",
      });
    });

    it("should handle general presence updates without context", () => {
      const presenceData = {
        status: "active",
      };

      socketService.handleUserPresence(mockSocket, presenceData);

      expect(mockIo.emit).toHaveBeenCalledWith("user_status", {
        studentId: "2025CS1001",
        status: "active",
        timestamp: expect.any(String),
      });
    });
  });

  describe("Notification System", () => {
    beforeEach(() => {
      socketService.handleConnection(mockSocket);
    });

    it("should send notification to specific user", () => {
      const notification = {
        type: "like",
        message: "Someone liked your post",
      };

      socketService.sendNotificationToUser("2025CS1001", notification);

      expect(mockIo.to).toHaveBeenCalledWith("user:2025CS1001");
    });

    it("should send notification to multiple users", () => {
      const notification = {
        type: "comment",
        message: "New comment on post",
      };
      const studentIds = ["2025CS1001", "2025CS1002", "2025CS1003"];

      socketService.sendNotificationToUsers(studentIds, notification);

      expect(mockIo.to).toHaveBeenCalledTimes(3);
      expect(mockIo.to).toHaveBeenCalledWith("user:2025CS1001");
      expect(mockIo.to).toHaveBeenCalledWith("user:2025CS1002");
      expect(mockIo.to).toHaveBeenCalledWith("user:2025CS1003");
    });
  });

  describe("Broadcasting", () => {
    beforeEach(() => {
      socketService.handleConnection(mockSocket);
    });

    it("should broadcast to year group", () => {
      const eventData = { message: "Year announcement" };

      socketService.broadcastToYear(3, "announcement", eventData);

      expect(mockIo.to).toHaveBeenCalledWith("year:3");
    });

    it("should broadcast to department", () => {
      const eventData = { message: "Department announcement" };

      socketService.broadcastToDepartment(
        "Computer Science",
        "announcement",
        eventData
      );

      expect(mockIo.to).toHaveBeenCalledWith("dept:Computer Science");
    });

    it("should broadcast to section", () => {
      const eventData = { message: "Section announcement" };

      socketService.broadcastToSection("A", "announcement", eventData);

      expect(mockIo.to).toHaveBeenCalledWith("section:A");
    });
  });

  describe("Statistics", () => {
    it("should return correct connection statistics", () => {
      const mockSocket2 = {
        ...mockSocket,
        id: "socket-456",
        user: {
          ...mockSocket.user,
          studentId: "2025CS1002",
        },
      };

      socketService.handleConnection(mockSocket);
      socketService.handleConnection(mockSocket2);

      const stats = socketService.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 2,
        uniqueUsers: 2,
        onlineUsers: ["2025CS1001", "2025CS1002"],
      });
    });

    it("should return empty statistics when no connections", () => {
      const stats = socketService.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 0,
        uniqueUsers: 0,
        onlineUsers: [],
      });
    });
  });

  describe("Online User Management", () => {
    it("should correctly track online users", () => {
      expect(socketService.getOnlineUsers()).toEqual([]);

      socketService.handleConnection(mockSocket);
      expect(socketService.getOnlineUsers()).toEqual(["2025CS1001"]);

      const mockSocket2 = {
        ...mockSocket,
        id: "socket-456",
        user: {
          ...mockSocket.user,
          studentId: "2025CS1002",
        },
      };

      socketService.handleConnection(mockSocket2);
      expect(socketService.getOnlineUsers()).toContain("2025CS1001");
      expect(socketService.getOnlineUsers()).toContain("2025CS1002");
      expect(socketService.getOnlineUsers()).toHaveLength(2);
    });

    it("should handle user going offline", () => {
      socketService.handleConnection(mockSocket);
      expect(socketService.isUserOnline("2025CS1001")).toBe(true);

      socketService.handleDisconnection(mockSocket, "client disconnect");
      expect(socketService.isUserOnline("2025CS1001")).toBe(false);
      expect(socketService.getOnlineUsers()).toEqual([]);
    });
  });
});
