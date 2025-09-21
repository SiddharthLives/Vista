const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    authorStudentId: {
      type: String,
      required: [true, "Author student ID is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Validate student ID format (e.g., 2025CS1001)
          return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
        },
        message:
          "Author student ID must follow format: YYYY[DEPT][NUMBER] (e.g., 2025CS1001)",
      },
    },
    media: {
      url: {
        type: String,
        required: [true, "Media URL is required"],
        validate: {
          validator: function (v) {
            return /^https?:\/\/.+/.test(v);
          },
          message: "Media URL must be a valid HTTP/HTTPS URL",
        },
      },
      cloudinaryPublicId: {
        type: String,
        required: [true, "Cloudinary public ID is required"],
        trim: true,
        validate: {
          validator: function (v) {
            // Validate cloudinary public_id format for college folder structure
            return /^college\/\d{4}-[A-Z]{2,4}\/dept-[A-Z]{2,4}\/section-[A-Z]\/student-\d{4}[A-Z]{2,4}\d{3,4}\//.test(
              v
            );
          },
          message: "Cloudinary public ID must follow college folder structure",
        },
      },
      width: {
        type: Number,
        min: [1, "Width must be positive"],
        validate: {
          validator: Number.isInteger,
          message: "Width must be an integer",
        },
      },
      height: {
        type: Number,
        min: [1, "Height must be positive"],
        validate: {
          validator: Number.isInteger,
          message: "Height must be an integer",
        },
      },
      duration: {
        type: Number,
        min: [0, "Duration must be non-negative"],
        validate: {
          validator: function (v) {
            // Duration is optional but if provided should be reasonable (max 60 seconds for stories)
            if (v !== undefined && v !== null) {
              return v <= 60;
            }
            return true;
          },
          message: "Story duration cannot exceed 60 seconds",
        },
      },
      type: {
        type: String,
        enum: {
          values: ["image", "video"],
          message: "Story media type must be either image or video",
        },
        required: [true, "Media type is required"],
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    expiresAt: {
      type: Date,
      default: function () {
        // Stories expire 24 hours after creation
        return new Date(Date.now() + 24 * 60 * 60 * 1000);
      },
      expires: 0, // TTL index - MongoDB will automatically delete documents when expiresAt is reached
    },
    viewedBy: [
      {
        studentId: {
          type: String,
          required: true,
          validate: {
            validator: function (v) {
              return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
            },
            message: "Student ID must follow format: YYYY[DEPT][NUMBER]",
          },
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    viewsCount: {
      type: Number,
      default: 0,
      min: [0, "Views count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: false, // We handle createdAt manually
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
storySchema.index({ authorStudentId: 1, createdAt: -1 }); // Author's stories
storySchema.index({ createdAt: -1 }); // Recent stories
storySchema.index({ expiresAt: 1 }); // TTL index for automatic deletion
storySchema.index({ isActive: 1, createdAt: -1 }); // Active stories only

// Compound index for story feed queries
storySchema.index({
  isActive: 1,
  expiresAt: 1,
  createdAt: -1,
});

// Virtual to check if story is expired
storySchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// Virtual to get time remaining until expiration
storySchema.virtual("timeRemaining").get(function () {
  const now = new Date();
  const remaining = this.expiresAt.getTime() - now.getTime();
  return Math.max(0, remaining);
});

// Virtual to check if story has been viewed by a specific user
storySchema.virtual("hasBeenViewedBy").get(function () {
  return (studentId) => {
    return this.viewedBy.some((view) => view.studentId === studentId);
  };
});

// Instance methods
storySchema.methods.addView = function (studentId) {
  // Don't add view if already viewed by this user
  if (!this.viewedBy.some((view) => view.studentId === studentId)) {
    this.viewedBy.push({ studentId });
    this.viewsCount += 1;
  }
  return this.save();
};

storySchema.methods.getViewers = function () {
  return this.viewedBy.map((view) => ({
    studentId: view.studentId,
    viewedAt: view.viewedAt,
  }));
};

storySchema.methods.canBeViewedBy = function (
  viewerStudentId,
  viewerYear,
  viewerDept,
  viewerSection,
  authorYear,
  authorDept,
  authorSection
) {
  if (!this.isActive || this.isExpired) return false;

  // Author can always view their own story
  if (this.authorStudentId === viewerStudentId) return true;

  // Stories are visible to users in the same year, department, or section
  // This logic can be customized based on privacy requirements
  return (
    viewerYear === authorYear ||
    viewerDept === authorDept ||
    (viewerYear === authorYear &&
      viewerDept === authorDept &&
      viewerSection === authorSection)
  );
};

storySchema.methods.markAsInactive = function () {
  this.isActive = false;
  return this.save();
};

// Static methods
storySchema.statics.findByAuthor = function (authorStudentId, options = {}) {
  const query = {
    authorStudentId,
    isActive: true,
    expiresAt: { $gt: new Date() }, // Only non-expired stories
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20);
};

storySchema.statics.findActiveStories = function (options = {}) {
  const query = {
    isActive: true,
    expiresAt: { $gt: new Date() }, // Only non-expired stories
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

storySchema.statics.findStoriesByYearDept = function (
  year,
  department,
  options = {}
) {
  // This would require joining with User model in practice
  // For now, we'll implement a basic version
  const query = {
    isActive: true,
    expiresAt: { $gt: new Date() },
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

storySchema.statics.getStoriesFeed = function (options = {}) {
  const { cursor, limit = 50, authorStudentIds = [] } = options;

  let query = {
    isActive: true,
    expiresAt: { $gt: new Date() }, // Only non-expired stories
  };

  // Add cursor-based pagination
  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  // Filter by specific authors if provided
  if (authorStudentIds.length > 0) {
    query.authorStudentId = { $in: authorStudentIds };
  }

  return this.find(query).sort({ createdAt: -1 }).limit(limit);
};

storySchema.statics.cleanupExpiredStories = function () {
  // Manual cleanup method (TTL index should handle this automatically)
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
};

storySchema.statics.getStoryStats = function (authorStudentId) {
  return this.aggregate([
    {
      $match: {
        authorStudentId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      },
    },
    {
      $group: {
        _id: null,
        totalStories: { $sum: 1 },
        totalViews: { $sum: "$viewsCount" },
        averageViews: { $avg: "$viewsCount" },
      },
    },
  ]);
};

// Pre-save middleware
storySchema.pre("save", function (next) {
  // Validate media requirements
  if (!this.media || !this.media.url || !this.media.cloudinaryPublicId) {
    return next(
      new Error("Story must have valid media with URL and Cloudinary public ID")
    );
  }

  // Ensure expiresAt is set if not provided
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  next();
});

// Pre-validate middleware
storySchema.pre("validate", function (next) {
  // Ensure media type is set based on URL or duration
  if (this.media && !this.media.type) {
    if (this.media.duration !== undefined && this.media.duration !== null) {
      this.media.type = "video";
    } else {
      // Default to image if no duration specified
      this.media.type = "image";
    }
  }

  next();
});

const Story = mongoose.model("Story", storySchema);

module.exports = Story;
