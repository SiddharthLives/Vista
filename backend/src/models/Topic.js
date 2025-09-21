const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Topic title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    body: {
      type: String,
      required: [true, "Topic body is required"],
      trim: true,
      minlength: [10, "Body must be at least 10 characters"],
      maxlength: [5000, "Body cannot exceed 5000 characters"],
    },
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
    votes: {
      type: Number,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Votes must be an integer",
      },
    },
    upvotes: {
      type: Number,
      default: 0,
      min: [0, "Upvotes cannot be negative"],
    },
    downvotes: {
      type: Number,
      default: 0,
      min: [0, "Downvotes cannot be negative"],
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
    isPinned: {
      type: Boolean,
      default: false,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    // Moderation fields
    isRemoved: {
      type: Boolean,
      default: false,
    },
    removedBy: {
      type: String,
      trim: true,
    },
    removedAt: {
      type: Date,
    },
    removedReason: {
      type: String,
      trim: true,
      maxlength: [500, "Removal reason cannot exceed 500 characters"],
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
topicSchema.index({ createdAt: -1 }); // Recent topics
topicSchema.index({ votes: -1 }); // Popular topics
topicSchema.index({ authorStudentId: 1, createdAt: -1 }); // User's topics
topicSchema.index({ tags: 1 }); // Tag filtering
topicSchema.index({ isActive: 1, createdAt: -1 }); // Active topics
topicSchema.index({ isPinned: -1, createdAt: -1 }); // Pinned topics first

// Compound indexes for complex queries
topicSchema.index({
  isActive: 1,
  isPinned: -1,
  votes: -1,
  createdAt: -1,
}); // Feed with pinned and popular topics first

// Text search index
topicSchema.index(
  {
    title: "text",
    body: "text",
    tags: "text",
  },
  {
    weights: {
      title: 10,
      body: 5,
      tags: 3,
    },
  }
);

// Virtual for topic URL/slug
topicSchema.virtual("slug").get(function () {
  const titleSlug = this.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);
  return `${titleSlug}-${this._id}`;
});

// Virtual for vote score calculation
topicSchema.virtual("voteScore").get(function () {
  return this.upvotes - this.downvotes;
});

// Virtual for engagement score (votes + comments)
topicSchema.virtual("engagementScore").get(function () {
  return this.votes + this.commentsCount;
});

// Instance methods
topicSchema.methods.upvote = function () {
  this.upvotes += 1;
  this.votes = this.upvotes - this.downvotes;
  return this.save();
};

topicSchema.methods.downvote = function () {
  this.downvotes += 1;
  this.votes = this.upvotes - this.downvotes;
  return this.save();
};

topicSchema.methods.removeUpvote = function () {
  if (this.upvotes > 0) {
    this.upvotes -= 1;
    this.votes = this.upvotes - this.downvotes;
  }
  return this.save();
};

topicSchema.methods.removeDownvote = function () {
  if (this.downvotes > 0) {
    this.downvotes -= 1;
    this.votes = this.upvotes - this.downvotes;
  }
  return this.save();
};

topicSchema.methods.incrementComments = function () {
  this.commentsCount += 1;
  return this.save();
};

topicSchema.methods.decrementComments = function () {
  if (this.commentsCount > 0) {
    this.commentsCount -= 1;
  }
  return this.save();
};

topicSchema.methods.addTag = function (tag) {
  const normalizedTag = tag.toLowerCase().trim();
  if (!this.tags.includes(normalizedTag)) {
    this.tags.push(normalizedTag);
  }
  return this.save();
};

topicSchema.methods.removeTag = function (tag) {
  const normalizedTag = tag.toLowerCase().trim();
  this.tags = this.tags.filter((t) => t !== normalizedTag);
  return this.save();
};

topicSchema.methods.pin = function () {
  this.isPinned = true;
  return this.save();
};

topicSchema.methods.unpin = function () {
  this.isPinned = false;
  return this.save();
};

topicSchema.methods.lock = function () {
  this.isLocked = true;
  return this.save();
};

topicSchema.methods.unlock = function () {
  this.isLocked = false;
  return this.save();
};

// Static methods
topicSchema.statics.findByAuthor = function (authorStudentId, options = {}) {
  const query = {
    authorStudentId,
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20);
};

topicSchema.statics.findByTags = function (tags, options = {}) {
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

topicSchema.statics.findPopular = function (options = {}) {
  const query = {
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ votes: -1, createdAt: -1 })
    .limit(options.limit || 20);
};

topicSchema.statics.searchTopics = function (searchQuery, options = {}) {
  const query = {
    $text: { $search: searchQuery },
    isActive: true,
    ...options.filters,
  };

  return this.find(query, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .limit(options.limit || 20);
};

topicSchema.statics.getTopicsFeed = function (options = {}) {
  const {
    cursor,
    limit = 20,
    sortBy = "recent", // 'recent', 'popular', 'engagement'
    tags,
    authorStudentId,
  } = options;

  let query = { isActive: true };

  // Add cursor-based pagination
  if (cursor) {
    if (sortBy === "popular" || sortBy === "engagement") {
      // For vote-based sorting, we need to handle cursor differently
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    } else {
      query.createdAt = { $lt: new Date(cursor) };
    }
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

  // Determine sort order
  let sortOrder;
  switch (sortBy) {
    case "popular":
      sortOrder = { isPinned: -1, votes: -1, createdAt: -1 };
      break;
    case "engagement":
      sortOrder = { isPinned: -1, votes: -1, commentsCount: -1, createdAt: -1 };
      break;
    default: // 'recent'
      sortOrder = { isPinned: -1, createdAt: -1 };
  }

  return this.find(query).sort(sortOrder).limit(limit);
};

// Pre-save middleware
topicSchema.pre("save", function (next) {
  // Update updatedAt timestamp
  this.updatedAt = new Date();

  // Recalculate votes from upvotes and downvotes
  this.votes = this.upvotes - this.downvotes;

  next();
});

// Pre-validate middleware
topicSchema.pre("validate", function (next) {
  // Trim title and body
  if (this.title) {
    this.title = this.title.trim();
  }
  if (this.body) {
    this.body = this.body.trim();
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

const Topic = mongoose.model("Topic", topicSchema);

module.exports = Topic;
