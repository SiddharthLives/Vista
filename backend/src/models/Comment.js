const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
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
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment must have content"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    // Reference to the parent entity (Post or Topic)
    parentType: {
      type: String,
      required: [true, "Parent type is required"],
      enum: {
        values: ["Post", "Topic"],
        message: "Parent type must be either Post or Topic",
      },
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Parent ID is required"],
      refPath: "parentType",
    },
    // Threading support - reference to parent comment for replies
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    // Threading level (0 = top-level, 1 = reply, 2 = reply to reply, etc.)
    level: {
      type: Number,
      default: 0,
      min: [0, "Level cannot be negative"],
      max: [5, "Maximum nesting level is 5"], // Prevent infinite nesting
    },
    // Path for efficient threading queries (e.g., "parentId/commentId")
    path: {
      type: String,
      default: "",
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
    repliesCount: {
      type: Number,
      default: 0,
      min: [0, "Replies count cannot be negative"],
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
    editedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        // Hide content if deleted
        if (ret.isDeleted) {
          ret.content = "[deleted]";
        }
        return ret;
      },
    },
  }
);

// Indexes for performance
commentSchema.index({ parentType: 1, parentId: 1, createdAt: -1 }); // Comments for a post/topic
commentSchema.index({ authorStudentId: 1, createdAt: -1 }); // User's comments
commentSchema.index({ parentCommentId: 1, createdAt: 1 }); // Replies to a comment
commentSchema.index({ path: 1 }); // Threading queries
commentSchema.index({ isActive: 1, isDeleted: 1, createdAt: -1 }); // Active, non-deleted comments
commentSchema.index({ votes: -1 }); // Popular comments

// Compound indexes for complex queries
commentSchema.index({
  parentType: 1,
  parentId: 1,
  isActive: 1,
  isDeleted: 1,
  level: 1,
  createdAt: -1,
}); // Threaded comments for a post/topic

// Text search index
commentSchema.index({
  content: "text",
});

// Virtual for vote score calculation
commentSchema.virtual("voteScore").get(function () {
  return this.upvotes - this.downvotes;
});

// Virtual to check if comment is edited
commentSchema.virtual("isEdited").get(function () {
  return this.editedAt !== null;
});

// Virtual to check if comment has replies
commentSchema.virtual("hasReplies").get(function () {
  return this.repliesCount > 0;
});

// Instance methods
commentSchema.methods.upvote = function () {
  this.upvotes += 1;
  this.votes = this.upvotes - this.downvotes;
  return this.save();
};

commentSchema.methods.downvote = function () {
  this.downvotes += 1;
  this.votes = this.upvotes - this.downvotes;
  return this.save();
};

commentSchema.methods.removeUpvote = function () {
  if (this.upvotes > 0) {
    this.upvotes -= 1;
    this.votes = this.upvotes - this.downvotes;
  }
  return this.save();
};

commentSchema.methods.removeDownvote = function () {
  if (this.downvotes > 0) {
    this.downvotes -= 1;
    this.votes = this.upvotes - this.downvotes;
  }
  return this.save();
};

commentSchema.methods.incrementReplies = function () {
  this.repliesCount += 1;
  return this.save();
};

commentSchema.methods.decrementReplies = function () {
  if (this.repliesCount > 0) {
    this.repliesCount -= 1;
  }
  return this.save();
};

commentSchema.methods.editContent = function (newContent) {
  this.content = newContent.trim();
  this.editedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

commentSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = "[deleted]";
  return this.save();
};

commentSchema.methods.restore = function () {
  // Note: This would need the original content to be stored separately
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

commentSchema.methods.getReplies = function (options = {}) {
  const Comment = this.constructor;
  return Comment.find({
    parentCommentId: this._id,
    isActive: true,
    ...options.filters,
  })
    .sort({ createdAt: 1 }) // Replies in chronological order
    .limit(options.limit || 50);
};

commentSchema.methods.getThread = function (options = {}) {
  const Comment = this.constructor;
  const pathPattern = new RegExp(`^${this.path}`);

  return Comment.find({
    path: pathPattern,
    isActive: true,
    ...options.filters,
  })
    .sort({ path: 1, createdAt: 1 })
    .limit(options.limit || 100);
};

// Static methods
commentSchema.statics.findByParent = function (
  parentType,
  parentId,
  options = {}
) {
  const query = {
    parentType,
    parentId,
    isActive: true,
    isDeleted: false,
    ...options.filters,
  };

  const sortOrder =
    options.sortBy === "popular"
      ? { votes: -1, createdAt: -1 }
      : { createdAt: -1 };

  return this.find(query)
    .sort(sortOrder)
    .limit(options.limit || 50);
};

commentSchema.statics.findByAuthor = function (authorStudentId, options = {}) {
  const query = {
    authorStudentId,
    isActive: true,
    isDeleted: false,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

commentSchema.statics.findThreaded = function (
  parentType,
  parentId,
  options = {}
) {
  const query = {
    parentType,
    parentId,
    isActive: true,
    isDeleted: false,
    ...options.filters,
  };

  return this.find(query)
    .sort({ path: 1, createdAt: 1 })
    .limit(options.limit || 100);
};

commentSchema.statics.findTopLevel = function (
  parentType,
  parentId,
  options = {}
) {
  const query = {
    parentType,
    parentId,
    level: 0,
    isActive: true,
    isDeleted: false,
    ...options.filters,
  };

  const sortOrder =
    options.sortBy === "popular"
      ? { votes: -1, createdAt: -1 }
      : { createdAt: -1 };

  return this.find(query)
    .sort(sortOrder)
    .limit(options.limit || 50);
};

commentSchema.statics.searchComments = function (searchQuery, options = {}) {
  const query = {
    $text: { $search: searchQuery },
    isActive: true,
    isDeleted: false,
    ...options.filters,
  };

  return this.find(query, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .limit(options.limit || 50);
};

commentSchema.statics.getCommentStats = function (authorStudentId) {
  return this.aggregate([
    {
      $match: {
        authorStudentId,
        isActive: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        totalVotes: { $sum: "$votes" },
        averageVotes: { $avg: "$votes" },
        totalReplies: { $sum: "$repliesCount" },
      },
    },
  ]);
};

// Pre-save middleware
commentSchema.pre("save", async function (next) {
  // Update updatedAt timestamp
  this.updatedAt = new Date();

  // Recalculate votes from upvotes and downvotes
  this.votes = this.upvotes - this.downvotes;

  // Set path for threading if this is a new comment
  if (this.isNew) {
    if (this.parentCommentId) {
      try {
        // This is a reply - we need to find the parent comment's path
        const Comment = this.constructor;
        const parentComment = await Comment.findById(this.parentCommentId);
        if (parentComment) {
          this.path = `${parentComment.path}/${this._id}`;
          this.level = parentComment.level + 1;
        } else {
          this.path = this._id.toString();
          this.level = 0;
        }
      } catch (error) {
        return next(error);
      }
    } else {
      // Top-level comment
      this.path = this._id.toString();
      this.level = 0;
    }
  }

  next();
});

// Pre-validate middleware
commentSchema.pre("validate", function (next) {
  // Trim content
  if (this.content) {
    this.content = this.content.trim();
  }

  next();
});

// Post-save middleware to update parent comment reply count
commentSchema.post("save", async function (doc) {
  if (doc.parentCommentId && doc.isNew) {
    try {
      const Comment = this.constructor;
      await Comment.findByIdAndUpdate(doc.parentCommentId, {
        $inc: { repliesCount: 1 },
      });
    } catch (error) {
      console.error("Error updating parent comment reply count:", error);
    }
  }
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
