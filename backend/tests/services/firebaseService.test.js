const admin = require("firebase-admin");
const firebaseService = require("../../src/services/firebaseService");

// Mock Firebase Admin SDK
jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

describe("FirebaseService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the initialized state
    firebaseService.initialized = false;

    // Set up test environment variables
    process.env = {
      ...originalEnv,
      FIREBASE_PROJECT_ID: "test-project",
      FIREBASE_PRIVATE_KEY_ID: "test-key-id",
      FIREBASE_PRIVATE_KEY:
        "-----BEGIN PRIVATE KEY-----\\nTEST_KEY\\n-----END PRIVATE KEY-----\\n",
      FIREBASE_CLIENT_EMAIL: "test@test-project.iam.gserviceaccount.com",
      FIREBASE_CLIENT_ID: "test-client-id",
      FIREBASE_AUTH_URI: "https://accounts.google.com/o/oauth2/auth",
      FIREBASE_TOKEN_URI: "https://oauth2.googleapis.com/token",
      FIREBASE_AUTH_PROVIDER_X509_CERT_URL:
        "https://www.googleapis.com/oauth2/v1/certs",
      FIREBASE_CLIENT_X509_CERT_URL:
        "https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com",
      COLLEGE_EMAIL_DOMAIN: "college.edu",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("initialize", () => {
    it("should initialize Firebase Admin SDK with correct configuration", () => {
      const mockCredential = { mock: "credential" };
      admin.credential.cert.mockReturnValue(mockCredential);

      firebaseService.initialize();

      expect(admin.credential.cert).toHaveBeenCalledWith({
        type: "service_account",
        project_id: "test-project",
        private_key_id: "test-key-id",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nTEST_KEY\n-----END PRIVATE KEY-----\n",
        client_email: "test@test-project.iam.gserviceaccount.com",
        client_id: "test-client-id",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url:
          "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url:
          "https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com",
      });

      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: mockCredential,
        projectId: "test-project",
      });

      expect(firebaseService.initialized).toBe(true);
    });

    it("should not reinitialize if already initialized", () => {
      firebaseService.initialize();
      firebaseService.initialize();

      expect(admin.initializeApp).toHaveBeenCalledTimes(1);
    });

    it("should handle initialization errors", () => {
      admin.initializeApp.mockImplementationOnce(() => {
        throw new Error("Initialization failed");
      });

      expect(() => firebaseService.initialize()).toThrow(
        "Firebase initialization failed"
      );
    });
  });

  describe("verifyIdToken", () => {
    const mockDecodedToken = {
      uid: "test-uid",
      email: "student@college.edu",
      email_verified: true,
      name: "Test Student",
      picture: "https://example.com/photo.jpg",
      iss: "https://securetoken.google.com/test-project",
      aud: "test-project",
      auth_time: 1234567890,
      iat: 1234567890,
      exp: 1234571490,
    };

    beforeEach(() => {
      admin.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockResolvedValue(mockDecodedToken),
      });
    });

    it("should verify valid token and return user data", async () => {
      const result = await firebaseService.verifyIdToken("valid-token");

      expect(admin.auth().verifyIdToken).toHaveBeenCalledWith("valid-token");
      expect(result).toEqual({
        uid: "test-uid",
        email: "student@college.edu",
        emailVerified: true,
        name: "Test Student",
        picture: "https://example.com/photo.jpg",
        iss: "https://securetoken.google.com/test-project",
        aud: "test-project",
        authTime: 1234567890,
        iat: 1234567890,
        exp: 1234571490,
      });
    });

    it("should throw error for missing token", async () => {
      await expect(firebaseService.verifyIdToken()).rejects.toThrow(
        "ID token is required"
      );
      await expect(firebaseService.verifyIdToken("")).rejects.toThrow(
        "ID token is required"
      );
      await expect(firebaseService.verifyIdToken(null)).rejects.toThrow(
        "ID token is required"
      );
    });

    it("should throw error for token without email", async () => {
      admin.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockResolvedValue({ uid: "test-uid" }),
      });

      await expect(
        firebaseService.verifyIdToken("token-without-email")
      ).rejects.toThrow("Email not found in token");
    });

    it("should handle expired token error", async () => {
      const expiredError = new Error("Token expired");
      expiredError.code = "auth/id-token-expired";

      admin.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockRejectedValue(expiredError),
      });

      await expect(
        firebaseService.verifyIdToken("expired-token")
      ).rejects.toThrow("Token has expired");
    });

    it("should handle revoked token error", async () => {
      const revokedError = new Error("Token revoked");
      revokedError.code = "auth/id-token-revoked";

      admin.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockRejectedValue(revokedError),
      });

      await expect(
        firebaseService.verifyIdToken("revoked-token")
      ).rejects.toThrow("Token has been revoked");
    });

    it("should handle invalid token error", async () => {
      const invalidError = new Error("Invalid token");
      invalidError.code = "auth/invalid-id-token";

      admin.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockRejectedValue(invalidError),
      });

      await expect(
        firebaseService.verifyIdToken("invalid-token")
      ).rejects.toThrow("Invalid token format");
    });

    it("should handle generic verification errors", async () => {
      admin.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockRejectedValue(new Error("Generic error")),
      });

      await expect(
        firebaseService.verifyIdToken("error-token")
      ).rejects.toThrow("Token verification failed");
    });
  });

  describe("validateEmailDomain", () => {
    it("should return true for valid college email", () => {
      expect(firebaseService.validateEmailDomain("student@college.edu")).toBe(
        true
      );
      expect(firebaseService.validateEmailDomain("STUDENT@COLLEGE.EDU")).toBe(
        true
      );
      expect(
        firebaseService.validateEmailDomain("test.student@college.edu")
      ).toBe(true);
    });

    it("should return false for invalid email domains", () => {
      expect(firebaseService.validateEmailDomain("student@gmail.com")).toBe(
        false
      );
      expect(firebaseService.validateEmailDomain("student@yahoo.com")).toBe(
        false
      );
      expect(
        firebaseService.validateEmailDomain("student@othercollege.edu")
      ).toBe(false);
    });

    it("should return false for invalid email formats", () => {
      expect(firebaseService.validateEmailDomain("invalid-email")).toBe(false);
      expect(firebaseService.validateEmailDomain("student@")).toBe(false);
      expect(firebaseService.validateEmailDomain("@college.edu")).toBe(false);
      expect(firebaseService.validateEmailDomain("")).toBe(false);
      expect(firebaseService.validateEmailDomain(null)).toBe(false);
      expect(firebaseService.validateEmailDomain(undefined)).toBe(false);
      expect(firebaseService.validateEmailDomain(123)).toBe(false);
    });
  });

  describe("extractEmailDomain", () => {
    it("should extract domain from valid email", () => {
      expect(firebaseService.extractEmailDomain("student@college.edu")).toBe(
        "college.edu"
      );
      expect(firebaseService.extractEmailDomain("STUDENT@COLLEGE.EDU")).toBe(
        "college.edu"
      );
      expect(firebaseService.extractEmailDomain("test.student@gmail.com")).toBe(
        "gmail.com"
      );
    });

    it("should return null for invalid emails", () => {
      expect(firebaseService.extractEmailDomain("invalid-email")).toBe(null);
      expect(firebaseService.extractEmailDomain("student@")).toBe(null);
      expect(firebaseService.extractEmailDomain("@college.edu")).toBe(null);
      expect(firebaseService.extractEmailDomain("")).toBe(null);
      expect(firebaseService.extractEmailDomain(null)).toBe(null);
      expect(firebaseService.extractEmailDomain(undefined)).toBe(null);
      expect(firebaseService.extractEmailDomain(123)).toBe(null);
    });
  });

  describe("getCollegeEmailDomain", () => {
    it("should return the configured college email domain", () => {
      expect(firebaseService.getCollegeEmailDomain()).toBe("college.edu");
    });

    it("should use default domain when env var is not set", () => {
      delete process.env.COLLEGE_EMAIL_DOMAIN;
      const newService = require("../../src/services/firebaseService");
      expect(newService.getCollegeEmailDomain()).toBe("college.edu");
    });
  });

  describe("verifyTokenAndDomain", () => {
    const mockDecodedToken = {
      uid: "test-uid",
      email: "student@college.edu",
      email_verified: true,
      name: "Test Student",
      picture: "https://example.com/photo.jpg",
      iss: "https://securetoken.google.com/test-project",
      aud: "test-project",
      auth_time: 1234567890,
      iat: 1234567890,
      exp: 1234571490,
    };

    beforeEach(() => {
      admin.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockResolvedValue(mockDecodedToken),
      });
    });

    it("should verify token and validate domain for valid college email", async () => {
      const result = await firebaseService.verifyTokenAndDomain("valid-token");

      expect(result).toEqual({
        uid: "test-uid",
        email: "student@college.edu",
        emailVerified: true,
        name: "Test Student",
        picture: "https://example.com/photo.jpg",
        iss: "https://securetoken.google.com/test-project",
        aud: "test-project",
        authTime: 1234567890,
        iat: 1234567890,
        exp: 1234571490,
      });
    });

    it("should throw error for invalid email domain", async () => {
      const invalidDomainToken = {
        ...mockDecodedToken,
        email: "student@gmail.com",
      };
      admin.auth.mockReturnValue({
        verifyIdToken: jest.fn().mockResolvedValue(invalidDomainToken),
      });

      await expect(
        firebaseService.verifyTokenAndDomain("invalid-domain-token")
      ).rejects.toThrow(
        "Access denied: school-domain required. Provided: gmail.com, Required: college.edu"
      );
    });

    it("should propagate token verification errors", async () => {
      admin.auth.mockReturnValue({
        verifyIdToken: jest
          .fn()
          .mockRejectedValue(new Error("Token verification failed")),
      });

      await expect(
        firebaseService.verifyTokenAndDomain("invalid-token")
      ).rejects.toThrow("Token verification failed");
    });
  });
});
