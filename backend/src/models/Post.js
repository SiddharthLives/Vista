const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
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
    type: {
      type: String,
      required: [true, "Post type is required"],
      enum: {
        values: ["image", "video", "text"],
        message: "Post type must be one of: image, video, text",
      },
    },
    media: [
      {
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
            message:
              "Cloudinary public ID must follow college folder structure",
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
              // Duration only valid for video posts
              if (v !== undefined && v !== null) {
                return this.parent().type === "video";
              }
              return true;
            },
            message: "Duration can only be specified for video posts",
          },
        },
      },
    ],
    text: {
      type: String,
      trim: true,
      maxlength: [2000, "Post text cannot exceed 2000 characters"],
      default: "",
    },
    visibility: {
      type: String,
      enum: {
        values: ["public", "year", "dept", "section"],
        message: "Visibility must be one of: public, year, dept, section",
      },
      default: "public",
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [50, "Tag cannot exceed 50 characters"],
        validate: {
          validator: function (v) {
            return /^[a-z0-9_-]+$/.test(v);
          },
          message:
            "Tags can only contain lowercase letters, numbers, underscores, and hyphens",
        },
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
      min: [0, "Likes count cannot be negative"],
    },
    commentsCount: {
      type: Number,
      default: 0,
      min: [0, "Comments count cannot be negative"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for performance
postSchema.index({ createdAt: -1 }); // Feed queries (newest first)
postSchema.index({ authorStudentId: 1, createdAt: -1 }); // User's posts
postSchema.index({ visibility: 1, createdAt: -1 }); // Visibility filtering
postSchema.index({ isActive: 1, createdAt: -1 }); // Active posts only
postSchema.index({ tags: 1 }); // Tag filtering

// Compound indexes for complex queries
postSchema.index({
  visibility: 1,
  isActive: 1,
  createdAt: -1,
}); // Feed with visibility and active filtering

// Text search index
postSchema.index(
  {
    text: "text",
    tags: "text",
  },
  {
    weights: {
      text: 10,
      tags: 5,
    },
  }
);

// Virtual for post URL/slug
postSchema.virtual("slug").get(function () {
  return `${this.authorStudentId}-${this._id}`;
});

// Virtual to check if post has media
postSchema.virtual("hasMedia").get(function () {
  return this.media && this.media.length > 0;
});

// Instance methods
postSchema.methods.incrementLikes = function () {
  this.likesCount += 1;
  return this.save();
};

postSchema.methods.decrementLikes = function () {
  if (this.likesCount > 0) {
    this.likesCount -= 1;
  }
  return this.save();
};

postSchema.methods.incrementComments = function () {
  this.commentsCount += 1;
  return this.save();
};

postSchema.methods.decrementComments = function () {
  if (this.commentsCount > 0) {
    this.commentsCount -= 1;
  }
  return this.save();
};

postSchema.methods.canBeViewedBy = function (
  viewerStudentId,
  viewerYear,
  viewerDept,
  viewerSection
) {
  if (!this.isActive) return false;

  switch (this.visibility) {
    case "public":
      return true;
    case "year":
      return viewerYear === this.authorYear;
    case "dept":
      return viewerDept === this.authorDept;
    case "section":
      return (
        viewerYear === this.authorYear &&
        viewerDept === this.authorDept &&
        viewerSection === this.authorSection
      );
    default:
      return false;
  }
};

postSchema.methods.addTag = function (tag) {
  const normalizedTag = tag.toLowerCase().trim();
  if (!this.tags.includes(normalizedTag)) {
    this.tags.push(normalizedTag);
  }
  return this.save();
};

postSchema.methods.removeTag = function (tag) {
  const normalizedTag = tag.toLowerCase().trim();
  this.tags = this.tags.filter((t) => t !== normalizedTag);
  return this.save();
};

// Static methods
postSchema.statics.findByAuthor = function (authorStudentId, options = {}) {
  const query = {
    authorStudentId,
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20);
};

postSchema.statics.findByVisibility = function (visibility, options = {}) {
  const query = {
    visibility,
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20);
};

postSchema.statics.findByTags = function (tags, options = {}) {
  const normalizedTags = tags.map((tag) => tag.toLowerCase().trim());
  const query = {
    tags: { $in: normalizedTags },
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20);
};

postSchema.statics.searchPosts = function (searchQuery, options = {}) {
  const query = {
    $text: { $search: searchQuery },
    isActive: true,
    ...options.filters,
  };

  return this.find(query, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .limit(options.limit || 20);
};

postSchema.statics.getFeed = function (options = {}) {
  const {
    cursor,
    limit = 20,
    visibility = "public",
    authorStudentId,
    tags,
  } = options;

  let query = { isActive: true };

  // Add cursor-based pagination
  if (cursor) {
    query.createdAt = { $lt: new Date(cursor) };
  }

  // Add visibility filter
  if (visibility !== "all") {
    query.visibility = visibility;
  }

  // Add author filter
  if (authorStudentId) {
    query.authorStudentId = authorStudentId;
  }

  // Add tags filter
  if (tags && tags.length > 0) {
    const normalizedTags = tags.map((tag) => tag.toLowerCase().trim());
    query.tags = { $in: normalizedTags };
  }

  return this.find(query).sort({ createdAt: -1 }).limit(limit);
};

// Pre-save middleware
postSchema.pre("save", function (next) {
  // Update updatedAt timestamp
  this.updatedAt = new Date();

  // Validate media requirements based on post type
  if (this.type === "image" || this.type === "video") {
    if (!this.media || this.media.length === 0) {
      return next(
        new Error(`${this.type} posts must have at least one media item`)
      );
    }
  }

  // Validate that text posts have text content
  if (this.type === "text") {
    if (!this.text || this.text.trim().length === 0) {
      return next(new Error("Text posts must have text content"));
    }
  }

  next();
});

// Pre-validate middleware
postSchema.pre("validate", function (next) {
  // Trim text content
  if (this.text) {
    this.text = this.text.trim();
  }

  // Normalize tags before validation
  if (this.tags) {
    this.tags = this.tags
      .map((tag) => tag.toLowerCase().trim())
      .filter((tag) => tag.length > 0);
    // Remove duplicates
    this.tags = [...new Set(this.tags)];
  }

  next();
});

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
