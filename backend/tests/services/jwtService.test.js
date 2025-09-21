const jwt = require("jsonwebtoken");
const jwtService = require("../../src/services/jwtService");

// Mock jsonwebtoken
jest.mock("jsonwebtoken");

describe("JWTService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: "test-secret",
      JWT_EXPIRES_IN: "1h",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("generateToken", () => {
    it("should generate token with correct payload and options", () => {
      const mockToken = "mock-jwt-token";
      jwt.sign.mockReturnValue(mockToken);

      const payload = { studentId: "2025CS1001", email: "test@college.edu" };
      const result = jwtService.generateToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(payload, "test-secret", {
        expiresIn: "1h",
        issuer: "college-social-media-api",
        audience: "college-social-media-app",
      });
      expect(result).toBe(mockToken);
    });

    it("should throw error for missing payload", () => {
      expect(() => jwtService.generateToken()).toThrow(
        "Payload is required and must be an object"
      );
      expect(() => jwtService.generateToken(null)).toThrow(
        "Payload is required and must be an object"
      );
      expect(() => jwtService.generateToken("string")).toThrow(
        "Payload is required and must be an object"
      );
    });

    it("should use default values when env vars are not set", () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;

      // Create new instance to pick up env changes
      const newJwtService = require("../../src/services/jwtService");
      const payload = { studentId: "2025CS1001" };

      newJwtService.generateToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        "default-secret-change-in-production",
        {
          expiresIn: "7d",
          issuer: "college-social-media-api",
          audience: "college-social-media-app",
        }
      );
    });
  });

  describe("verifyToken", () => {
    const mockPayload = { studentId: "2025CS1001", email: "test@college.edu" };

    it("should verify valid token and return payload", () => {
      jwt.verify.mockReturnValue(mockPayload);

      const result = jwtService.verifyToken("valid-token");

      expect(jwt.verify).toHaveBeenCalledWith("valid-token", "test-secret", {
        issuer: "college-social-media-api",
        audience: "college-social-media-app",
      });
      expect(result).toEqual(mockPayload);
    });

    it("should throw error for missing token", () => {
      expect(() => jwtService.verifyToken()).toThrow("Token is required");
      expect(() => jwtService.verifyToken("")).toThrow("Token is required");
      expect(() => jwtService.verifyToken(null)).toThrow("Token is required");
    });

    it("should handle expired token error", () => {
      const expiredError = new Error("Token expired");
      expiredError.name = "TokenExpiredError";
      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      expect(() => jwtService.verifyToken("expired-token")).toThrow(
        "Token has expired"
      );
    });

    it("should handle invalid token error", () => {
      const invalidError = new Error("Invalid token");
      invalidError.name = "JsonWebTokenError";
      jwt.verify.mockImplementation(() => {
        throw invalidError;
      });

      expect(() => jwtService.verifyToken("invalid-token")).toThrow(
        "Invalid token"
      );
    });

    it("should handle not before error", () => {
      const notBeforeError = new Error("Token not active");
      notBeforeError.name = "NotBeforeError";
      jwt.verify.mockImplementation(() => {
        throw notBeforeError;
      });

      expect(() => jwtService.verifyToken("not-active-token")).toThrow(
        "Token not active"
      );
    });

    it("should handle generic verification errors", () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("Generic error");
      });

      expect(() => jwtService.verifyToken("error-token")).toThrow(
        "Token verification failed"
      );
    });
  });

  describe("extractTokenFromHeader", () => {
    it("should extract token from valid Bearer header", () => {
      expect(jwtService.extractTokenFromHeader("Bearer valid-token")).toBe(
        "valid-token"
      );
      expect(
        jwtService.extractTokenFromHeader("Bearer another-token-123")
      ).toBe("another-token-123");
    });

    it("should return null for invalid headers", () => {
      expect(jwtService.extractTokenFromHeader("Invalid header")).toBe(null);
      expect(jwtService.extractTokenFromHeader("Bearer")).toBe(null);
      expect(jwtService.extractTokenFromHeader("Basic token")).toBe(null);
      expect(jwtService.extractTokenFromHeader("Bearer token extra")).toBe(
        null
      );
      expect(jwtService.extractTokenFromHeader("")).toBe(null);
      expect(jwtService.extractTokenFromHeader(null)).toBe(null);
      expect(jwtService.extractTokenFromHeader(undefined)).toBe(null);
      expect(jwtService.extractTokenFromHeader(123)).toBe(null);
    });
  });
});
