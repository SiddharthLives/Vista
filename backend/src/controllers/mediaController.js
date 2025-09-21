const {
  generateUserSignedUploadParams,
  validateFileMetadata,
  validateFolderStructure,
  getResourceTypeFromMimeType,
} = require("../services/cloudinaryService");

/**
 * Generate signed upload parameters for Cloudinary
 * @route POST /media/sign
 */
const generateSignedUploadParams = async (req, res) => {
  try {
    const { filename, mimeType, size, resourceType } = req.body;
    const user = req.user;

    // Validate file metadata
    const validation = validateFileMetadata({ filename, mimeType, size });
    if (!validation.isValid) {
      return res.status(400).json({
        error: {
          code: "INVALID_FILE_METADATA",
          message: "File metadata validation failed",
          details: validation.errors,
        },
      });
    }

    // Determine resource type if not provided
    const finalResourceType =
      resourceType || getResourceTypeFromMimeType(mimeType);

    // Generate signed upload parameters
    const uploadParams = generateUserSignedUploadParams(user, {
      resourceType: finalResourceType,
      maxFileSize: size, // Use the actual file size as limit
    });

    // Add additional metadata for client
    const response = {
      ...uploadParams,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${finalResourceType}/upload`,
      expectedFolder: uploadParams.folder,
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
    };

    res.json(response);
  } catch (error) {
    console.error("Error generating signed upload parameters:", error);

    if (error.message.includes("Missing required user information")) {
      return res.status(400).json({
        error: {
          code: "INCOMPLETE_USER_PROFILE",
          message:
            "User profile is incomplete. Please ensure year, department, section, and studentId are set.",
        },
      });
    }

    res.status(500).json({
      error: {
        code: "UPLOAD_PARAMS_GENERATION_FAILED",
        message: "Failed to generate upload parameters",
      },
    });
  }
};

/**
 * Validate media for post creation
 * @route POST /media/validate
 */
const validateMediaForPost = async (req, res) => {
  try {
    const { media, postType } = req.body;
    const user = req.user;
    const maxFilesPerPost = parseInt(process.env.MAX_FILES_PER_POST) || 5;

    const validationResults = {
      isValid: true,
      errors: [],
      warnings: [],
      validMedia: [],
    };

    // Check number of media files
    if (media.length > maxFilesPerPost) {
      validationResults.isValid = false;
      validationResults.errors.push(
        `Maximum ${maxFilesPerPost} files allowed per post`
      );
    }

    // Validate each media item
    for (let i = 0; i < media.length; i++) {
      const mediaItem = media[i];
      const mediaErrors = [];

      // Validate required fields
      if (!mediaItem.cloudinaryPublicId) {
        mediaErrors.push("Missing cloudinaryPublicId");
      }
      if (!mediaItem.url) {
        mediaErrors.push("Missing URL");
      }

      // Validate folder structure
      if (
        mediaItem.cloudinaryPublicId &&
        !validateFolderStructure(mediaItem.cloudinaryPublicId, user)
      ) {
        mediaErrors.push("Media does not belong to user folder structure");
      }

      // Validate URL format (basic check)
      if (mediaItem.url && !mediaItem.url.includes("cloudinary.com")) {
        mediaErrors.push("URL must be from Cloudinary");
      }

      // Validate dimensions for images
      if (postType === "image" && mediaItem.cloudinaryPublicId) {
        if (!mediaItem.width || !mediaItem.height) {
          validationResults.warnings.push(
            `Media item ${i + 1}: Missing width/height dimensions`
          );
        }
      }

      // Check media type consistency
      if (postType === "image" && mediaItem.cloudinaryPublicId) {
        const isImagePublicId = /\.(jpg|jpeg|png|gif)$/i.test(
          mediaItem.cloudinaryPublicId
        );
        if (!isImagePublicId) {
          mediaErrors.push(
            "Media type does not match post type (expected image)"
          );
        }
      } else if (postType === "video" && mediaItem.cloudinaryPublicId) {
        const isVideoPublicId = /\.(mp4|mov|avi)$/i.test(
          mediaItem.cloudinaryPublicId
        );
        if (!isVideoPublicId) {
          mediaErrors.push(
            "Media type does not match post type (expected video)"
          );
        }
      }

      if (mediaErrors.length > 0) {
        validationResults.isValid = false;
        validationResults.errors.push(
          `Media item ${i + 1}: ${mediaErrors.join(", ")}`
        );
      } else {
        validationResults.validMedia.push({
          ...mediaItem,
          index: i,
        });
      }
    }

    // Post type specific validations
    if (postType === "text" && media.length > 0) {
      validationResults.warnings.push(
        "Text posts typically do not include media"
      );
    }

    if ((postType === "image" || postType === "video") && media.length === 0) {
      validationResults.isValid = false;
      validationResults.errors.push(
        `${postType} posts must include at least one media file`
      );
    }

    // Return validation results
    if (validationResults.isValid) {
      res.json({
        valid: true,
        message: "All media items are valid",
        validMedia: validationResults.validMedia,
        warnings: validationResults.warnings,
      });
    } else {
      res.status(400).json({
        error: {
          code: "MEDIA_VALIDATION_FAILED",
          message: "Media validation failed",
          details: validationResults.errors,
          warnings: validationResults.warnings,
        },
      });
    }
  } catch (error) {
    console.error("Error validating media for post:", error);
    res.status(500).json({
      error: {
        code: "MEDIA_VALIDATION_ERROR",
        message: "Failed to validate media",
      },
    });
  }
};

module.exports = {
  generateSignedUploadParams,
  validateMediaForPost,
};
