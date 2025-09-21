const request = require("supertest");
const express = require("express");
const firebaseService = require("../../src/services/firebaseService");
const jwtService = require("../../src/services/jwtService");
const User = require("../../src/models/User");
const authController = require("../../src/controllers/authController");

// Mock dependencies
jest.mock("../../src/services/firebaseService");
jest.mock("../../src/services/jwtService");
jest.mock("../../src/models/User");

// Mock rate limiting to avoid test issues
jest.mock("express-rate-limit", () => {
  return () => (req, res, next) => next();
});

// Create test app
const app = express();
app.use(express.json());

// Add routes manually to avoid rate limiting issues
app.post("/auth/firebaseSignIn", authController.firebaseSignIn);
app.post("/auth/linkStudentId", authController.linkStudentId);

describe("Authentication Routes", () => {
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

  describe("POST /auth/firebaseSignIn", () => {
    const mockDecodedToken = {
      uid: "firebase-uid-123",
      email: "student@college.edu",
      name: "Test Student",
      picture: "https://example.com/photo.jpg",
    };

    const mockUser = {
      studentId: "2025CS1001",
      email: "student@college.edu",
      displayName: "Test Student",
      photoUrl: "https://example.com/photo.jpg",
      year: 3,
      department: "Computer Science",
      section: "A",
      bio: "Test bio",
      badges: ["early-adopter"],
      joinedAt: new Date("2025-01-01"),
      settings: { notifications: true },
      uid: "firebase-uid-123",
    };

    it("should sign in existing user successfully", async () => {
      firebaseService.verifyTokenAndDomain.mockResolvedValue(mockDecodedToken);
      User.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockUser),
      });
      jwtService.generateToken.mockReturnValue("app-jwt-token");

      const response = await request(app)
        .post("/auth/firebaseSignIn")
        .send({ idToken: "valid-firebase-token" });

      expect(response.status).toBe(200);
      expect(response.body.token).toBe("app-jwt-token");
      expect(response.body.user.studentId).toBe("2025CS1001");
      expect(response.body.user.email).toBe("student@college.edu");

      expect(firebaseService.verifyTokenAndDomain).toHaveBeenCalledWith(
        "valid-firebase-token"
      );
      expect(jwtService.generateToken).toHaveBeenCalledWith({
        studentId: "2025CS1001",
        email: "student@college.edu",
        uid: "firebase-uid-123",
        year: 3,
        department: "Computer Science",
        section: "A",
      });
    });

    it("should link Firebase UID to existing user without UID", async () => {
      const userWithoutUID = { ...mockUser, uid: undefined };
      const mockSave = jest.fn().mockResolvedValue();
      const mockToObject = jest.fn().mockReturnValue({ ...mockUser });

      firebaseService.verifyTokenAndDomain.mockResolvedValue(mockDecodedToken);
      User.findOne
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue(null),
        })
        .mockReturnValueOnce({
          save: mockSave,
          toObject: mockToObject,
          ...userWithoutUID,
        });
      jwtService.generateToken.mockReturnValue("app-jwt-token");

      const response = await request(app)
        .post("/auth/firebaseSignIn")
        .send({ idToken: "valid-firebase-token" });

      expect(response.status).toBe(200);
      expect(mockSave).toHaveBeenCalled();
    });

    it("should return 403 for invalid email domain", async () => {
      const domainError = new Error(
        "Access denied: school-domain required. Provided: gmail.com, Required: college.edu"
      );
      firebaseService.verifyTokenAndDomain.mockRejectedValue(domainError);
      firebaseService.extractEmailDomain.mockReturnValue("gmail.com");
      firebaseService.getCollegeEmailDomain.mockReturnValue("college.edu");

      const response = await request(app)
        .post("/auth/firebaseSignIn")
        .send({ idToken: "invalid-domain-token" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("INVALID_EMAIL_DOMAIN");
    });

    it("should return 403 when student not in roster", async () => {
      firebaseService.verifyTokenAndDomain.mockResolvedValue(mockDecodedToken);
      // First call for lean() query returns null
      // Second call for non-lean query also returns null
      User.findOne
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue(null),
        })
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/auth/firebaseSignIn")
        .send({ idToken: "valid-firebase-token" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("STUDENT_NOT_IN_ROSTER");
      expect(response.body.error.details.email).toBe("student@college.edu");
    });

    it("should return 400 for missing idToken", async () => {
      const response = await request(app).post("/auth/firebaseSignIn").send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MISSING_ID_TOKEN");
    });

    it("should return 401 for expired Firebase token", async () => {
      const expiredError = new Error("Token has expired");
      firebaseService.verifyTokenAndDomain.mockRejectedValue(expiredError);

      const response = await request(app)
        .post("/auth/firebaseSignIn")
        .send({ idToken: "expired-token" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("FIREBASE_TOKEN_EXPIRED");
    });
  });

  describe("POST /auth/linkStudentId", () => {
    const mockDecodedToken = {
      uid: "firebase-uid-123",
      email: "student@college.edu",
      name: "Test Student",
      picture: "https://example.com/photo.jpg",
    };

    const mockUser = {
      studentId: "2025CS1001",
      email: null,
      displayName: "Test Student",
      year: 3,
      department: "Computer Science",
      section: "A",
      save: jest.fn().mockResolvedValue(),
    };

    it("should link student ID successfully", async () => {
      firebaseService.verifyTokenAndDomain.mockResolvedValue(mockDecodedToken);
      User.findOne.mockResolvedValue(mockUser);
      jwtService.generateToken.mockReturnValue("app-jwt-token");

      const response = await request(app).post("/auth/linkStudentId").send({
        idToken: "valid-firebase-token",
        studentId: "2025CS1001",
        verificationCode: "SKIP_VERIFICATION",
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toBe("app-jwt-token");
      expect(response.body.message).toBe(
        "Student ID successfully linked to your account"
      );
      expect(mockUser.save).toHaveBeenCalled();
    });

    it("should return 404 for non-existent student ID", async () => {
      firebaseService.verifyTokenAndDomain.mockResolvedValue(mockDecodedToken);
      User.findOne.mockResolvedValue(null);

      const response = await request(app).post("/auth/linkStudentId").send({
        idToken: "valid-firebase-token",
        studentId: "2025CS9999",
      });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("STUDENT_ID_NOT_FOUND");
      expect(response.body.error.details.studentId).toBe("2025CS9999");
    });

    it("should return 409 for already linked student ID", async () => {
      const linkedUser = {
        ...mockUser,
        email: "other@college.edu",
      };

      firebaseService.verifyTokenAndDomain.mockResolvedValue(mockDecodedToken);
      User.findOne.mockResolvedValue(linkedUser);

      const response = await request(app).post("/auth/linkStudentId").send({
        idToken: "valid-firebase-token",
        studentId: "2025CS1001",
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("STUDENT_ID_ALREADY_LINKED");
      expect(response.body.error.details.linkedEmail).toBe("ot***@college.edu");
    });

    it("should return 400 for missing required fields", async () => {
      const response = await request(app).post("/auth/linkStudentId").send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MISSING_REQUIRED_FIELDS");
    });
  });
});
