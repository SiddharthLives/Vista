const {
  socketAuthMiddleware,
} = require("../../src/middleware/socketAuthMiddleware");
const jwtService = require("../../src/services/jwtService");
const User = require("../../src/models/User");

// Mock dependencies
jest.mock("../../src/services/jwtService");
jest.mock("../../src/models/User");

describe("Socket Authentication Middleware", () => {
  let mockSocket;
  let mockNext;

  beforeEach(() => {
    mockSocket = {
      handshake: {
        auth: {},
        query: {},
        headers: {},
      },
      join: jest.fn(),
      user: null,
    };
    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("Token Extraction", () => {
    it("should extract token from handshake auth", async () => {
      const token = "valid-jwt-token";
      mockSocket.handshake.auth.token = token;

      const mockUser = {
        studentId: "2025CS1001",
        email: "student@college.edu",
        displayName: "Test Student",
        year: 3,
        department: "Computer Science",
        section: "A",
      };

      jwtService.verifyToken.mockReturnValue({
        studentId: "2025CS1001",
        email: "student@college.edu",
        uid: "firebase-uid",
      });

      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(jwtService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockSocket.join).toHaveBeenCalledWith("user:2025CS1001");
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should extract token from query parameters", async () => {
      const token = "valid-jwt-token";
      mockSocket.handshake.query.token = token;

      const mockUser = {
        studentId: "2025CS1001",
        email: "student@college.edu",
        displayName: "Test Student",
        year: 3,
        department: "Computer Science",
        section: "A",
      };

      jwtService.verifyToken.mockReturnValue({
        studentId: "2025CS1001",
        email: "student@college.edu",
        uid: "firebase-uid",
      });

      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(jwtService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should extract token from authorization header", async () => {
      const token = "valid-jwt-token";
      mockSocket.handshake.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        studentId: "2025CS1001",
        email: "student@college.edu",
        displayName: "Test Student",
        year: 3,
        department: "Computer Science",
        section: "A",
      };

      jwtService.verifyToken.mockReturnValue({
        studentId: "2025CS1001",
        email: "student@college.edu",
        uid: "firebase-uid",
      });

      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(jwtService.verifyToken).toHaveBeenCalledWith(token);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("Authentication Failures", () => {
    it("should reject connection when no token provided", async () => {
      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        new Error("Authentication token required")
      );
    });

    it("should reject connection when token is invalid", async () => {
      mockSocket.handshake.auth.token = "invalid-token";
      jwtService.verifyToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        new Error("Invalid authentication token")
      );
    });

    it("should reject connection when token is expired", async () => {
      mockSocket.handshake.auth.token = "expired-token";
      jwtService.verifyToken.mockImplementation(() => {
        throw new Error("Token has expired");
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        new Error("Authentication token has expired")
      );
    });

    it("should reject connection when token is not active", async () => {
      mockSocket.handshake.auth.token = "not-active-token";
      jwtService.verifyToken.mockImplementation(() => {
        throw new Error("Token not active");
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        new Error("Authentication token is not yet active")
      );
    });

    it("should reject connection when token lacks studentId", async () => {
      mockSocket.handshake.auth.token = "token-without-studentid";
      jwtService.verifyToken.mockReturnValue({
        email: "student@college.edu",
        uid: "firebase-uid",
        // Missing studentId
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        new Error("Token does not contain required user information")
      );
    });

    it("should reject connection when user not found in database", async () => {
      mockSocket.handshake.auth.token = "valid-token";
      jwtService.verifyToken.mockReturnValue({
        studentId: "2025CS1001",
        email: "student@college.edu",
        uid: "firebase-uid",
      });

      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        new Error("User account no longer exists")
      );
    });

    it("should handle database errors gracefully", async () => {
      mockSocket.handshake.auth.token = "valid-token";
      jwtService.verifyToken.mockReturnValue({
        studentId: "2025CS1001",
        email: "student@college.edu",
        uid: "firebase-uid",
      });

      User.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        new Error("Authentication verification failed")
      );
    });
  });

  describe("Successful Authentication", () => {
    it("should attach user data to socket and join user room", async () => {
      const token = "valid-jwt-token";
      mockSocket.handshake.auth.token = token;

      const mockUser = {
        studentId: "2025CS1001",
        email: "student@college.edu",
        displayName: "Test Student",
        year: 3,
        department: "Computer Science",
        section: "A",
        photoUrl: "https://example.com/photo.jpg",
      };

      jwtService.verifyToken.mockReturnValue({
        studentId: "2025CS1001",
        email: "student@college.edu",
        uid: "firebase-uid-123",
      });

      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockSocket.user).toEqual({
        studentId: "2025CS1001",
        email: "student@college.edu",
        displayName: "Test Student",
        year: 3,
        department: "Computer Science",
        section: "A",
        photoUrl: "https://example.com/photo.jpg",
        uid: "firebase-uid-123",
      });

      expect(mockSocket.join).toHaveBeenCalledWith("user:2025CS1001");
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
