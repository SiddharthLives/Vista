const request = require("supertest");
const { app } = require("../../src/server");
const User = require("../../src/models/User");
const jwtService = require("../../src/services/jwtService");

// Mock the cloudinary service
jest.mock("../../src/services/cloudinaryService", () => ({
  generateUserSignedUploadParams: jest.fn(),
  validateFileMetadata: jest.fn(),
  validateFolderStructure: jest.fn(),
  getResourceTypeFromMimeType: jest.fn(),
}));

const cloudinaryService = require("../../src/services/cloudinaryService");

describe("Media Routes", () => {
  let authToken;
  let mockUser;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      studentId: "2025CS1001",
      email: "student@college.edu",
      displayName: "Test Student",
      year: 3,
      department: "Computer Science",
      section: "A",
      uid: "firebase-uid-123",
    };

    // Generate a valid JWT token for testing
    authToken = jwtService.generateToken({
      studentId: mockUser.studentId,
      email: mockUser.email,
      uid: mockUser.uid,
    });

    // Mock User.findOne to return our mock user with lean() method
    jest.spyOn(User, "findOne").mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockUser),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /media/sign", () => {
    const validSignRequest = {
      filename: "test-image.jpg",
      mimeType: "image/jpeg",
      size: 1048576, // 1MB
    };

    it("should generate signed upload parameters for valid request", async () => {
      const mockSignedParams = {
        timestamp: 1234567890,
        signature: "mock-signature",
        api_key: "mock-api-key",
        cloud_name: "mock-cloud",
        folder:
          "college/year-3/dept-Computer Science/section-A/student-2025CS1001",
        resource_type: "image",
        allowed_formats: "jpg,jpeg,png,gif",
        max_file_size: 1048576,
      };

      cloudinaryService.validateFileMetadata.mockReturnValue({
        isValid: true,
        errors: [],
      });
      cloudinaryService.getResourceTypeFromMimeType.mockReturnValue("image");
      cloudinaryService.generateUserSignedUploadParams.mockReturnValue(
        mockSignedParams
      );

      const response = await request(app)
        .post("/media/sign")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validSignRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("signature", "mock-signature");
      expect(response.body).toHaveProperty("api_key", "mock-api-key");
      expect(response.body).toHaveProperty("uploadUrl");
      expect(response.body).toHaveProperty("expectedFolder");
      expect(response.body.uploadUrl).toContain("cloudinary.com");
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await request(app)
        .post("/media/sign")
        .send(validSignRequest);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("MISSING_TOKEN");
    });

    it("should return 400 for missing filename", async () => {
      const invalidRequest = { ...validSignRequest, filename: "" };

      const response = await request(app)
        .post("/media/sign")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "filename",
            message: "Filename is required",
          }),
        ])
      );
    });

    it("should return 400 for invalid MIME type", async () => {
      const invalidRequest = {
        ...validSignRequest,
        mimeType: "application/pdf",
      };

      const response = await request(app)
        .post("/media/sign")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for file size exceeding limit", async () => {
      const invalidRequest = { ...validSignRequest, size: 20971520 }; // 20MB

      const response = await request(app)
        .post("/media/sign")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid file metadata", async () => {
      cloudinaryService.validateFileMetadata.mockReturnValue({
        isValid: false,
        errors: ["File size exceeds maximum limit"],
      });

      const response = await request(app)
        .post("/media/sign")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validSignRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_FILE_METADATA");
      expect(response.body.error.details).toContain(
        "File size exceeds maximum limit"
      );
    });

    it("should handle incomplete user profile error", async () => {
      cloudinaryService.validateFileMetadata.mockReturnValue({
        isValid: true,
        errors: [],
      });
      cloudinaryService.getResourceTypeFromMimeType.mockReturnValue("image");
      cloudinaryService.generateUserSignedUploadParams.mockImplementation(
        () => {
          throw new Error(
            "Missing required user information for folder path generation"
          );
        }
      );

      const response = await request(app)
        .post("/media/sign")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validSignRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INCOMPLETE_USER_PROFILE");
    });
  });

  describe("POST /media/validate", () => {
    const validValidationRequest = {
      media: [
        {
          cloudinaryPublicId:
            "college/year-3/dept-Computer Science/section-A/student-2025CS1001/image123.jpg",
          url: "https://res.cloudinary.com/test/image/upload/v123/college/year-3/dept-Computer%20Science/section-A/student-2025CS1001/image123.jpg",
          width: 800,
          height: 600,
        },
      ],
      postType: "image",
    };

    it("should validate media successfully for valid request", async () => {
      cloudinaryService.validateFolderStructure.mockReturnValue(true);

      const response = await request(app)
        .post("/media/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validValidationRequest);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.validMedia).toHaveLength(1);
      expect(response.body.validMedia[0]).toHaveProperty("index", 0);
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await request(app)
        .post("/media/validate")
        .send(validValidationRequest);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("MISSING_TOKEN");
    });

    it("should return 400 for empty media array", async () => {
      const invalidRequest = { ...validValidationRequest, media: [] };

      const response = await request(app)
        .post("/media/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid folder structure", async () => {
      cloudinaryService.validateFolderStructure.mockReturnValue(false);

      const response = await request(app)
        .post("/media/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send(validValidationRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MEDIA_VALIDATION_FAILED");
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "Media does not belong to user folder structure"
          ),
        ])
      );
    });

    it("should return 400 for non-Cloudinary URL", async () => {
      const invalidRequest = {
        ...validValidationRequest,
        media: [
          {
            ...validValidationRequest.media[0],
            url: "https://example.com/image.jpg",
          },
        ],
      };

      cloudinaryService.validateFolderStructure.mockReturnValue(true);

      const response = await request(app)
        .post("/media/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MEDIA_VALIDATION_FAILED");
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.stringContaining("URL must be from Cloudinary"),
        ])
      );
    });

    it("should return 400 for media type mismatch", async () => {
      const invalidRequest = {
        ...validValidationRequest,
        media: [
          {
            ...validValidationRequest.media[0],
            cloudinaryPublicId:
              "college/year-3/dept-Computer Science/section-A/student-2025CS1001/video123.mp4",
          },
        ],
        postType: "image",
      };

      cloudinaryService.validateFolderStructure.mockReturnValue(true);

      const response = await request(app)
        .post("/media/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MEDIA_VALIDATION_FAILED");
    });

    it("should return 400 for image/video post without media", async () => {
      const invalidRequest = {
        media: [],
        postType: "image",
      };

      const response = await request(app)
        .post("/media/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should handle too many media files", async () => {
      const tooManyMedia = Array(10).fill(validValidationRequest.media[0]);
      const invalidRequest = {
        ...validValidationRequest,
        media: tooManyMedia,
      };

      cloudinaryService.validateFolderStructure.mockReturnValue(true);

      const response = await request(app)
        .post("/media/validate")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("MEDIA_VALIDATION_FAILED");
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Maximum 5 files allowed per post"),
        ])
      );
    });
  });

  describe("GET /media/limits", () => {
    it("should return media limits and supported formats", async () => {
      const response = await request(app).get("/media/limits");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("maxFileSize");
      expect(response.body).toHaveProperty("maxFilesPerPost");
      expect(response.body).toHaveProperty("supportedImageFormats");
      expect(response.body).toHaveProperty("supportedVideoFormats");
      expect(response.body).toHaveProperty("supportedMimeTypes");
      expect(response.body.supportedImageFormats).toContain("jpg");
      expect(response.body.supportedVideoFormats).toContain("mp4");
      expect(response.body.supportedMimeTypes).toContain("image/jpeg");
    });

    it("should not require authentication", async () => {
      const response = await request(app).get("/media/limits");
      expect(response.status).toBe(200);
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting to media endpoints", async () => {
      cloudinaryService.validateFileMetadata.mockReturnValue({
        isValid: true,
        errors: [],
      });
      cloudinaryService.getResourceTypeFromMimeType.mockReturnValue("image");
      cloudinaryService.generateUserSignedUploadParams.mockReturnValue({
        signature: "mock-signature",
        api_key: "mock-api-key",
        folder: "test-folder",
      });

      const validRequest = {
        filename: "test.jpg",
        mimeType: "image/jpeg",
        size: 1048576,
      };

      // Make multiple requests rapidly
      const requests = Array(60)
        .fill()
        .map(() =>
          request(app)
            .post("/media/sign")
            .set("Authorization", `Bearer ${authToken}`)
            .send(validRequest)
        );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(
        (res) => res.status === 429
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
