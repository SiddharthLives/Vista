const cloudinary = require("cloudinary").v2;
const crypto = require("crypto");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Generate folder path based on user information
 * Format: /college/year-{year}/dept-{dept}/section-{section}/student-{studentId}/
 * @param {Object} user - User object with year, department, section, studentId
 * @returns {string} - Folder path
 */
const generateFolderPath = (user) => {
  const { year, department, section, studentId } = user;

  if (!year || !department || !section || !studentId) {
    throw new Error(
      "Missing required user information for folder path generation"
    );
  }

  return `college/year-${year}/dept-${department}/section-${section}/student-${studentId}`;
};

/**
 * Validate if a public_id belongs to the correct folder structure for a user
 * @param {string} publicId - Cloudinary public_id to validate
 * @param {Object} user - User object with year, department, section, studentId
 * @returns {boolean} - True if valid, false otherwise
 */
const validateFolderStructure = (publicId, user) => {
  const expectedFolder = generateFolderPath(user);
  return publicId.startsWith(expectedFolder + "/");
};

/**
 * Generate signed upload parameters for Cloudinary
 * @param {Object} options - Upload options
 * @param {string} options.folder - Folder path for upload
 * @param {string} options.resourceType - Resource type (image, video, raw)
 * @param {Array<string>} options.allowedFormats - Allowed file formats
 * @param {number} options.maxFileSize - Maximum file size in bytes
 * @returns {Object} - Signed upload parameters
 */
const generateSignedUploadParams = (options = {}) => {
  const {
    folder,
    resourceType = "auto",
    allowedFormats = ["jpg", "jpeg", "png", "gif", "mp4", "mov", "avi"],
    maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
  } = options;

  if (!folder) {
    throw new Error("Folder path is required for signed upload");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const uploadParams = {
    timestamp,
    folder,
    resource_type: resourceType,
    allowed_formats: allowedFormats.join(","),
    max_file_size: maxFileSize,
  };

  // Generate signature
  const signature = cloudinary.utils.api_sign_request(
    uploadParams,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    ...uploadParams,
    signature,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  };
};

/**
 * Generate signed upload parameters for a specific user
 * @param {Object} user - User object with year, department, section, studentId
 * @param {Object} options - Additional upload options
 * @returns {Object} - Signed upload parameters with user-specific folder
 */
const generateUserSignedUploadParams = (user, options = {}) => {
  const folder = generateFolderPath(user);
  return generateSignedUploadParams({ ...options, folder });
};

/**
 * Validate file metadata before upload
 * @param {Object} fileMetadata - File metadata
 * @param {string} fileMetadata.filename - Original filename
 * @param {string} fileMetadata.mimeType - MIME type
 * @param {number} fileMetadata.size - File size in bytes
 * @returns {Object} - Validation result
 */
const validateFileMetadata = (fileMetadata) => {
  const { filename, mimeType, size } = fileMetadata;
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default

  const errors = [];

  if (!filename) {
    errors.push("Filename is required");
  }

  if (!mimeType) {
    errors.push("MIME type is required");
  }

  if (!size || size <= 0) {
    errors.push("Valid file size is required");
  }

  if (size > maxFileSize) {
    errors.push(`File size exceeds maximum limit of ${maxFileSize} bytes`);
  }

  // Validate MIME type
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
  ];

  if (mimeType && !allowedMimeTypes.includes(mimeType)) {
    errors.push(`Unsupported file type: ${mimeType}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Extract resource type from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} - Cloudinary resource type
 */
const getResourceTypeFromMimeType = (mimeType) => {
  if (mimeType.startsWith("image/")) {
    return "image";
  } else if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "auto";
};

/**
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} - File extension
 */
const getExtensionFromMimeType = (mimeType) => {
  const mimeToExt = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
  };

  return mimeToExt[mimeType] || "unknown";
};

/**
 * Create media validation utilities for post creation
 * @param {Array} mediaArray - Array of media objects
 * @param {Object} user - User object
 * @returns {Object} - Validation utilities
 */
const createMediaValidationUtils = (mediaArray, user) => {
  return {
    validateAll: () => {
      const errors = [];
      const validMedia = [];

      mediaArray.forEach((media, index) => {
        if (!validateFolderStructure(media.cloudinaryPublicId, user)) {
          errors.push(`Media ${index + 1}: Invalid folder structure`);
        } else {
          validMedia.push(media);
        }
      });

      return {
        isValid: errors.length === 0,
        errors,
        validMedia,
      };
    },

    getMediaUrls: () => mediaArray.map((media) => media.url),
    getPublicIds: () => mediaArray.map((media) => media.cloudinaryPublicId),

    filterByType: (type) => {
      const extension =
        type === "image" ? /\.(jpg|jpeg|png|gif)$/i : /\.(mp4|mov|avi)$/i;
      return mediaArray.filter((media) =>
        extension.test(media.cloudinaryPublicId)
      );
    },
  };
};

module.exports = {
  cloudinary,
  generateFolderPath,
  validateFolderStructure,
  generateSignedUploadParams,
  generateUserSignedUploadParams,
  validateFileMetadata,
  getResourceTypeFromMimeType,
  getExtensionFromMimeType,
  createMediaValidationUtils,
};
