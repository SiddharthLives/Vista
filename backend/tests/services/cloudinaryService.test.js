const {
  generateFolderPath,
  validateFolderStructure,
  generateSignedUploadParams,
  generateUserSignedUploadParams,
  validateFileMetadata,
  getResourceTypeFromMimeType,
  getExtensionFromMimeType,
} = require("../../src/services/cloudinaryService");

// Mock environment variables
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-api-key";
process.env.CLOUDINARY_API_SECRET = "test-api-secret";
process.env.MAX_FILE_SIZE = "10485760"; // 10MB

// Mock cloudinary
jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    utils: {
      api_sign_request: jest.fn(() => "mock-signature"),
    },
  },
}));

describe("CloudinaryService", () => {
  const mockUser = {
    studentId: "2025CS1001",
    year: 3,
    department: "Computer Science",
    section: "A",
  };

  describe("generateFolderPath", () => {
    it("should generate correct folder path for valid user", () => {
      const result = generateFolderPath(mockUser);
      expect(result).toBe(
        "college/year-3/dept-Computer Science/section-A/student-2025CS1001"
      );
    });

    it("should throw error for missing year", () => {
      const invalidUser = { ...mockUser, year: undefined };
      expect(() => generateFolderPath(invalidUser)).toThrow(
        "Missing required user information for folder path generation"
      );
    });

    it("should throw error for missing department", () => {
      const invalidUser = { ...mockUser, department: undefined };
      expect(() => generateFolderPath(invalidUser)).toThrow(
        "Missing required user information for folder path generation"
      );
    });

    it("should throw error for missing section", () => {
      const invalidUser = { ...mockUser, section: undefined };
      expect(() => generateFolderPath(invalidUser)).toThrow(
        "Missing required user information for folder path generation"
      );
    });

    it("should throw error for missing studentId", () => {
      const invalidUser = { ...mockUser, studentId: undefined };
      expect(() => generateFolderPath(invalidUser)).toThrow(
        "Missing required user information for folder path generation"
      );
    });
  });

  describe("validateFolderStructure", () => {
    it("should return true for valid public_id", () => {
      const publicId =
        "college/year-3/dept-Computer Science/section-A/student-2025CS1001/image123.jpg";
      const result = validateFolderStructure(publicId, mockUser);
      expect(result).toBe(true);
    });

    it("should return false for invalid public_id", () => {
      const publicId =
        "college/year-2/dept-Mathematics/section-B/student-2024MT1001/image123.jpg";
      const result = validateFolderStructure(publicId, mockUser);
      expect(result).toBe(false);
    });

    it("should return false for public_id without proper folder structure", () => {
      const publicId = "random/folder/image123.jpg";
      const result = validateFolderStructure(publicId, mockUser);
      expect(result).toBe(false);
    });

    it("should return false for public_id that partially matches", () => {
      const publicId =
        "college/year-3/dept-Computer Science/section-B/student-2025CS1001/image123.jpg";
      const result = validateFolderStructure(publicId, mockUser);
      expect(result).toBe(false);
    });
  });

  describe("generateSignedUploadParams", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should generate signed upload parameters with default options", () => {
      const options = { folder: "test/folder" };
      const result = generateSignedUploadParams(options);

      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("signature", "mock-signature");
      expect(result).toHaveProperty("api_key", "test-api-key");
      expect(result).toHaveProperty("cloud_name", "test-cloud");
      expect(result).toHaveProperty("folder", "test/folder");
      expect(result).toHaveProperty("resource_type", "auto");
      expect(result).toHaveProperty(
        "allowed_formats",
        "jpg,jpeg,png,gif,mp4,mov,avi"
      );
      expect(result).toHaveProperty("max_file_size", 10485760);
    });

    it("should generate signed upload parameters with custom options", () => {
      const options = {
        folder: "custom/folder",
        resourceType: "image",
        allowedFormats: ["jpg", "png"],
        maxFileSize: 5242880, // 5MB
      };
      const result = generateSignedUploadParams(options);

      expect(result.folder).toBe("custom/folder");
      expect(result.resource_type).toBe("image");
      expect(result.allowed_formats).toBe("jpg,png");
      expect(result.max_file_size).toBe(5242880);
    });

    it("should throw error when folder is not provided", () => {
      expect(() => generateSignedUploadParams({})).toThrow(
        "Folder path is required for signed upload"
      );
    });

    it("should use environment MAX_FILE_SIZE when not specified", () => {
      const options = { folder: "test/folder" };
      const result = generateSignedUploadParams(options);
      expect(result.max_file_size).toBe(10485760);
    });
  });

  describe("generateUserSignedUploadParams", () => {
    it("should generate signed upload parameters for user", () => {
      const result = generateUserSignedUploadParams(mockUser);

      expect(result).toHaveProperty(
        "folder",
        "college/year-3/dept-Computer Science/section-A/student-2025CS1001"
      );
      expect(result).toHaveProperty("signature", "mock-signature");
      expect(result).toHaveProperty("api_key", "test-api-key");
    });

    it("should pass through additional options", () => {
      const options = { resourceType: "video", maxFileSize: 20971520 };
      const result = generateUserSignedUploadParams(mockUser, options);

      expect(result.resource_type).toBe("video");
      expect(result.max_file_size).toBe(20971520);
    });
  });

  describe("validateFileMetadata", () => {
    const validFileMetadata = {
      filename: "test.jpg",
      mimeType: "image/jpeg",
      size: 1048576, // 1MB
    };

    it("should validate correct file metadata", () => {
      const result = validateFileMetadata(validFileMetadata);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject file without filename", () => {
      const invalidMetadata = { ...validFileMetadata, filename: undefined };
      const result = validateFileMetadata(invalidMetadata);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Filename is required");
    });

    it("should reject file without mimeType", () => {
      const invalidMetadata = { ...validFileMetadata, mimeType: undefined };
      const result = validateFileMetadata(invalidMetadata);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("MIME type is required");
    });

    it("should reject file without size", () => {
      const invalidMetadata = { ...validFileMetadata, size: undefined };
      const result = validateFileMetadata(invalidMetadata);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Valid file size is required");
    });

    it("should reject file with zero size", () => {
      const invalidMetadata = { ...validFileMetadata, size: 0 };
      const result = validateFileMetadata(invalidMetadata);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Valid file size is required");
    });

    it("should reject file exceeding size limit", () => {
      const invalidMetadata = { ...validFileMetadata, size: 20971520 }; // 20MB
      const result = validateFileMetadata(invalidMetadata);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "File size exceeds maximum limit of 10485760 bytes"
      );
    });

    it("should reject unsupported MIME type", () => {
      const invalidMetadata = {
        ...validFileMetadata,
        mimeType: "application/pdf",
      };
      const result = validateFileMetadata(invalidMetadata);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unsupported file type: application/pdf");
    });

    it("should accept all supported image MIME types", () => {
      const supportedImageTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
      ];

      supportedImageTypes.forEach((mimeType) => {
        const metadata = { ...validFileMetadata, mimeType };
        const result = validateFileMetadata(metadata);
        expect(result.isValid).toBe(true);
      });
    });

    it("should accept all supported video MIME types", () => {
      const supportedVideoTypes = [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
      ];

      supportedVideoTypes.forEach((mimeType) => {
        const metadata = { ...validFileMetadata, mimeType };
        const result = validateFileMetadata(metadata);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe("getResourceTypeFromMimeType", () => {
    it('should return "image" for image MIME types', () => {
      expect(getResourceTypeFromMimeType("image/jpeg")).toBe("image");
      expect(getResourceTypeFromMimeType("image/png")).toBe("image");
      expect(getResourceTypeFromMimeType("image/gif")).toBe("image");
    });

    it('should return "video" for video MIME types', () => {
      expect(getResourceTypeFromMimeType("video/mp4")).toBe("video");
      expect(getResourceTypeFromMimeType("video/quicktime")).toBe("video");
      expect(getResourceTypeFromMimeType("video/x-msvideo")).toBe("video");
    });

    it('should return "auto" for unknown MIME types', () => {
      expect(getResourceTypeFromMimeType("application/pdf")).toBe("auto");
      expect(getResourceTypeFromMimeType("text/plain")).toBe("auto");
    });
  });

  describe("getExtensionFromMimeType", () => {
    it("should return correct extensions for image MIME types", () => {
      expect(getExtensionFromMimeType("image/jpeg")).toBe("jpg");
      expect(getExtensionFromMimeType("image/jpg")).toBe("jpg");
      expect(getExtensionFromMimeType("image/png")).toBe("png");
      expect(getExtensionFromMimeType("image/gif")).toBe("gif");
    });

    it("should return correct extensions for video MIME types", () => {
      expect(getExtensionFromMimeType("video/mp4")).toBe("mp4");
      expect(getExtensionFromMimeType("video/quicktime")).toBe("mov");
      expect(getExtensionFromMimeType("video/x-msvideo")).toBe("avi");
    });

    it('should return "unknown" for unsupported MIME types', () => {
      expect(getExtensionFromMimeType("application/pdf")).toBe("unknown");
      expect(getExtensionFromMimeType("text/plain")).toBe("unknown");
    });
  });
});
