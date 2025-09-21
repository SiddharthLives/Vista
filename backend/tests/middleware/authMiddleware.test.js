const {
  authenticateToken,
  optionalAuth,
  requireAdmin,
} = require("../../src/middleware/authMiddleware");
const jwtService = require("../../src/services/jwtService");
const User = require("../../src/models/User");

// Mock dependencies
jest.mock("../../src/services/jwtService");
jest.mock("../../src/models/User");

describe("Authentication Middleware", () => {
  let req, res, next;
  const originalEnv = process.env;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    jest.clearAllMocks();

    process.env = {
      ...originalEnv,
      VERIFY_USER_EXISTS: "true",
      ADMIN_EMAILS: "admin@college.edu,super@college.edu",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("authenticateToken", () => {
    const mockUser = {
      studentId: "2025CS1001",
      email: "student@college.edu",
      displayName: "Test Student",
      year: 3,
      department: "Computer Science",
      section: "A",
      photoUrl: "https://example.com/photo.jpg",
    };

    const mockDecodedToken = {
      studentId: "2025CS1001",
      email: "student@college.edu",
      uid: "firebase-uid-123",
    };

    it("should authenticate valid token and set user context", async () => {
      req.headers.authorization = "Bearer valid-token";
      jwtService.extractTokenFromHeader.mockReturnValue("valid-token");
      jwtService.verifyToken.mockReturnValue(mockDecodedToken);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });

      await authenticateToken(req, res, next);

      expect(jwtService.extractTokenFromHeader).toHaveBeenCalledWith(
        "Bearer valid-token"
      );
      expect(jwtService.verifyToken).toHaveBeenCalledWith("valid-token");
      expect(User.findOne).toHaveBeenCalledWith({ studentId: "2025CS1001" });
      expect(req.user).toEqual({
        studentId: "2025CS1001",
        email: "student@college.edu",
        displayName: "Test Student",
        year: 3,
        department: "Computer Science",
        section: "A",
        photoUrl: "https://example.com/photo.jpg",
        uid: "firebase-uid-123",
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 when no token provided", async () => {
      jwtService.extractTokenFromHeader.mockReturnValue(null);

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "MISSING_TOKEN",
          message: "Access token is required",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for invalid token", async () => {
      req.headers.authorization = "Bearer invalid-token";
      jwtService.extractTokenFromHeader.mockReturnValue("invalid-token");
      jwtService.verifyToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid access token",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for expired token", async () => {
      req.headers.authorization = "Bearer expired-token";
      jwtService.extractTokenFromHeader.mockReturnValue("expired-token");
      jwtService.verifyToken.mockImplementation(() => {
        throw new Error("Token has expired");
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "TOKEN_EXPIRED",
          message: "Access token has expired",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for token not active", async () => {
      req.headers.authorization = "Bearer not-active-token";
      jwtService.extractTokenFromHeader.mockReturnValue("not-active-token");
      jwtService.verifyToken.mockImplementation(() => {
        throw new Error("Token not active");
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "TOKEN_NOT_ACTIVE",
          message: "Access token is not yet active",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when token missing studentId", async () => {
      req.headers.authorization = "Bearer invalid-payload-token";
      jwtService.extractTokenFromHeader.mockReturnValue(
        "invalid-payload-token"
      );
      jwtService.verifyToken.mockReturnValue({ email: "test@college.edu" }); // Missing studentId

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "INVALID_TOKEN_PAYLOAD",
          message: "Token does not contain required user information",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user not found in database", async () => {
      req.headers.authorization = "Bearer valid-token";
      jwtService.extractTokenFromHeader.mockReturnValue("valid-token");
      jwtService.verifyToken.mockReturnValue(mockDecodedToken);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "USER_NOT_FOUND",
          message: "User account no longer exists",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      req.headers.authorization = "Bearer valid-token";
      jwtService.extractTokenFromHeader.mockReturnValue("valid-token");
      jwtService.verifyToken.mockReturnValue(mockDecodedToken);
      User.findOne.mockReturnValue({
        lean: jest
          .fn()
          .mockRejectedValue(new Error("Database connection failed")),
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "DATABASE_ERROR",
          message: "Authentication verification failed",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should skip database lookup when VERIFY_USER_EXISTS is false", async () => {
      process.env.VERIFY_USER_EXISTS = "false";
      req.headers.authorization = "Bearer valid-token";
      jwtService.extractTokenFromHeader.mockReturnValue("valid-token");
      jwtService.verifyToken.mockReturnValue(mockDecodedToken);

      await authenticateToken(req, res, next);

      expect(User.findOne).not.toHaveBeenCalled();
      expect(req.user).toEqual({
        studentId: "2025CS1001",
        email: "student@college.edu",
        uid: "firebase-uid-123",
      });
      expect(next).toHaveBeenCalled();
    });

    it("should handle unexpected errors", async () => {
      req.headers.authorization = "Bearer valid-token";
      jwtService.extractTokenFromHeader.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "AUTHENTICATION_ERROR",
          message: "Authentication process failed",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuth", () => {
    const mockUser = {
      studentId: "2025CS1001",
      email: "student@college.edu",
      displayName: "Test Student",
      year: 3,
      department: "Computer Science",
      section: "A",
      photoUrl: "https://example.com/photo.jpg",
    };

    const mockDecodedToken = {
      studentId: "2025CS1001",
      email: "student@college.edu",
      uid: "firebase-uid-123",
    };

    it("should set user context for valid token", async () => {
      req.headers.authorization = "Bearer valid-token";
      jwtService.extractTokenFromHeader.mockReturnValue("valid-token");
      jwtService.verifyToken.mockReturnValue(mockDecodedToken);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });

      await optionalAuth(req, res, next);

      expect(req.user).toEqual({
        studentId: "2025CS1001",
        email: "student@college.edu",
        displayName: "Test Student",
        year: 3,
        department: "Computer Science",
        section: "A",
        photoUrl: "https://example.com/photo.jpg",
        uid: "firebase-uid-123",
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should continue without user context when no token provided", async () => {
      jwtService.extractTokenFromHeader.mockReturnValue(null);

      await optionalAuth(req, res, next);

      expect(req.user).toBe(null);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should continue without user context for invalid token", async () => {
      req.headers.authorization = "Bearer invalid-token";
      jwtService.extractTokenFromHeader.mockReturnValue("invalid-token");
      jwtService.verifyToken.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await optionalAuth(req, res, next);

      expect(req.user).toBe(null);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should continue without user context when user not found", async () => {
      req.headers.authorization = "Bearer valid-token";
      jwtService.extractTokenFromHeader.mockReturnValue("valid-token");
      jwtService.verifyToken.mockReturnValue(mockDecodedToken);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await optionalAuth(req, res, next);

      expect(req.user).toBe(null);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    const mockAdminUser = {
      studentId: "2025CS1001",
      email: "admin@college.edu",
      displayName: "Admin User",
      year: 4,
      department: "Computer Science",
      section: "A",
      photoUrl: "https://example.com/photo.jpg",
    };

    const mockDecodedToken = {
      studentId: "2025CS1001",
      email: "admin@college.edu",
      uid: "firebase-uid-123",
    };

    it("should allow access for admin user", async () => {
      req.headers.authorization = "Bearer admin-token";
      jwtService.extractTokenFromHeader.mockReturnValue("admin-token");
      jwtService.verifyToken.mockReturnValue(mockDecodedToken);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockAdminUser),
      });

      await requireAdmin(req, res, next);

      expect(req.user.email).toBe("admin@college.edu");
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should allow access for admin domain user", async () => {
      const adminDomainUser = {
        ...mockAdminUser,
        email: "test@admin.college.edu",
      };
      const adminDomainToken = {
        ...mockDecodedToken,
        email: "test@admin.college.edu",
      };

      req.headers.authorization = "Bearer admin-domain-token";
      jwtService.extractTokenFromHeader.mockReturnValue("admin-domain-token");
      jwtService.verifyToken.mockReturnValue(adminDomainToken);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(adminDomainUser),
      });

      await requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should deny access for non-admin user", async () => {
      const regularUser = { ...mockAdminUser, email: "student@college.edu" };
      const regularToken = {
        ...mockDecodedToken,
        email: "student@college.edu",
      };

      req.headers.authorization = "Bearer regular-token";
      jwtService.extractTokenFromHeader.mockReturnValue("regular-token");
      jwtService.verifyToken.mockReturnValue(regularToken);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(regularUser),
      });

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: "Admin access required",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
