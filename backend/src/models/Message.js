const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation ID is required"],
    },
    senderStudentId: {
      type: String,
      required: [true, "Sender student ID is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Allow "system" for system messages, otherwise validate student ID format
          return v === "system" || /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
        },
        message:
          "Sender student ID must follow format: YYYY[DEPT][NUMBER] (e.g., 2025CS1001) or be 'system'",
      },
    },
    type: {
      type: String,
      enum: {
        values: ["text", "image", "file", "system"],
        message: "Message type must be one of: text, image, file, system",
      },
      default: "text",
    },
    content: {
      text: {
        type: String,
        trim: true,
        maxlength: [2000, "Message text cannot exceed 2000 characters"],
      },
      media: {
        url: {
          type: String,
          validate: {
            validator: function (v) {
              if (!v) return true; // Allow null/undefined
              return /^https?:\/\/.+/.test(v);
            },
            message: "Media URL must be a valid HTTP/HTTPS URL",
          },
        },
        cloudinaryPublicId: {
          type: String,
          trim: true,
          validate: {
            validator: function (v) {
              if (!v) return true; // Allow null/undefined
              // Validate cloudinary public_id format for college folder structure
              return /^college\/\d{4}-[A-Z]{2,4}\/dept-[A-Z]{2,4}\/section-[A-Z]\/student-\d{4}[A-Z]{2,4}\d{3,4}\//.test(
                v
              );
            },
            message:
              "Cloudinary public ID must follow college folder structure",
          },
        },
        filename: {
          type: String,
          trim: true,
          maxlength: [255, "Filename cannot exceed 255 characters"],
        },
        fileSize: {
          type: Number,
          min: [0, "File size cannot be negative"],
        },
        mimeType: {
          type: String,
          trim: true,
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
        },
      },
      system: {
        action: {
          type: String,
          enum: [
            "user_joined",
            "user_left",
            "user_added",
            "user_removed",
            "title_changed",
            "admin_added",
            "admin_removed",
          ],
          validate: {
            validator: function (v) {
              // System action is required for system messages
              return this.type !== "system" || v;
            },
            message: "System action is required for system messages",
          },
        },
        metadata: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    },
    readBy: [
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
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    deliveredTo: [
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
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedFor: [
      {
        type: String,
        validate: {
          validator: function (v) {
            return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
          },
          message: "Student ID must follow format: YYYY[DEPT][NUMBER]",
        },
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        // Hide content if message is deleted
        if (ret.isDeleted) {
          ret.content = { text: "[deleted]" };
        }
        return ret;
      },
    },
  }
);

// Indexes for performance
messageSchema.index({ conversationId: 1, createdAt: -1 }); // Messages in conversation
messageSchema.index({ senderStudentId: 1, createdAt: -1 }); // User's messages
messageSchema.index({ createdAt: -1 }); // Recent messages
messageSchema.index({ readBy: 1 }); // Read receipts
messageSchema.index({ deliveredTo: 1 }); // Delivery receipts

// Compound indexes for complex queries
messageSchema.index({
  conversationId: 1,
  isDeleted: 1,
  createdAt: -1,
}); // Non-deleted messages in conversation

messageSchema.index({
  conversationId: 1,
  type: 1,
  createdAt: -1,
}); // Messages by type in conversation

// Text search index
messageSchema.index({
  "content.text": "text",
});

// Virtual to check if message is edited
messageSchema.virtual("isEdited").get(function () {
  return this.editedAt !== null;
});

// Virtual to check if message has media
messageSchema.virtual("hasMedia").get(function () {
  return !!(
    this.content &&
    this.content.media &&
    (this.content.media.url || this.content.media.cloudinaryPublicId)
  );
});

// Virtual to get display content
messageSchema.virtual("displayContent").get(function () {
  if (this.isDeleted) {
    return "[deleted]";
  }

  switch (this.type) {
    case "text":
      return this.content.text || "";
    case "image":
      return "[Image]";
    case "file":
      return `[File: ${this.content.media?.filename || "Unknown"}]`;
    case "system":
      return this.getSystemMessageText();
    default:
      return "[Message]";
  }
});

// Virtual to check read status for a user
messageSchema.virtual("isReadBy").get(function () {
  return (studentId) => {
    return this.readBy.some((read) => read.studentId === studentId);
  };
});

// Virtual to check delivery status for a user
messageSchema.virtual("isDeliveredTo").get(function () {
  return (studentId) => {
    return this.deliveredTo.some(
      (delivery) => delivery.studentId === studentId
    );
  };
});

// Instance methods
messageSchema.methods.markAsRead = function (studentId) {
  // Don't mark as read if already read
  if (!this.readBy.some((read) => read.studentId === studentId)) {
    this.readBy.push({ studentId });
  }
  return this.save();
};

messageSchema.methods.markAsDelivered = function (studentId) {
  // Don't mark as delivered if already delivered
  if (!this.deliveredTo.some((delivery) => delivery.studentId === studentId)) {
    this.deliveredTo.push({ studentId });
  }
  return this.save();
};

messageSchema.methods.editContent = function (newText) {
  if (this.type !== "text") {
    return Promise.reject(new Error("Only text messages can be edited"));
  }

  this.content.text = newText.trim();
  this.editedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

messageSchema.methods.softDelete = function (studentId = null) {
  if (studentId) {
    // Delete for specific user only
    if (!this.deletedFor.includes(studentId)) {
      this.deletedFor.push(studentId);
    }
  } else {
    // Delete for everyone
    this.isDeleted = true;
    this.deletedAt = new Date();
  }
  return this.save();
};

messageSchema.methods.restore = function () {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedFor = [];
  return this.save();
};

messageSchema.methods.getSystemMessageText = function () {
  if (this.type !== "system") {
    return "";
  }

  const action = this.content.system?.action;
  const metadata = this.content.system?.metadata || {};

  switch (action) {
    case "user_joined":
      return `${metadata.userName || "Someone"} joined the conversation`;
    case "user_left":
      return `${metadata.userName || "Someone"} left the conversation`;
    case "user_added":
      return `${metadata.addedUserName || "Someone"} was added by ${
        metadata.addedByName || "someone"
      }`;
    case "user_removed":
      return `${metadata.removedUserName || "Someone"} was removed by ${
        metadata.removedByName || "someone"
      }`;
    case "title_changed":
      return `${metadata.changedByName || "Someone"} changed the title to "${
        metadata.newTitle || "Untitled"
      }"`;
    case "admin_added":
      return `${metadata.newAdminName || "Someone"} was made an admin by ${
        metadata.addedByName || "someone"
      }`;
    case "admin_removed":
      return `${
        metadata.removedAdminName || "Someone"
      } was removed as admin by ${metadata.removedByName || "someone"}`;
    default:
      return "System message";
  }
};

messageSchema.methods.canBeEditedBy = function (studentId) {
  return (
    this.senderStudentId === studentId &&
    this.type === "text" &&
    !this.isDeleted &&
    Date.now() - this.createdAt.getTime() < 15 * 60 * 1000
  ); // 15 minutes
};

messageSchema.methods.canBeDeletedBy = function (studentId) {
  return this.senderStudentId === studentId && !this.isDeleted;
};

messageSchema.methods.isVisibleTo = function (studentId) {
  return !this.isDeleted && !this.deletedFor.includes(studentId);
};

// Static methods
messageSchema.statics.findByConversation = function (
  conversationId,
  options = {}
) {
  const query = {
    conversationId,
    isDeleted: false,
    ...options.filters,
  };

  // Handle cursor-based pagination
  if (options.cursor) {
    query.createdAt = { $lt: new Date(options.cursor) };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

messageSchema.statics.findBySender = function (senderStudentId, options = {}) {
  const query = {
    senderStudentId,
    isDeleted: false,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

messageSchema.statics.searchMessages = function (
  conversationId,
  searchQuery,
  options = {}
) {
  const query = {
    conversationId,
    $text: { $search: searchQuery },
    isDeleted: false,
    ...options.filters,
  };

  return this.find(query, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .limit(options.limit || 20);
};

messageSchema.statics.findUnreadMessages = function (
  conversationId,
  studentId,
  options = {}
) {
  const query = {
    conversationId,
    senderStudentId: { $ne: studentId }, // Not sent by the user
    "readBy.studentId": { $ne: studentId }, // Not read by the user
    isDeleted: false,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

messageSchema.statics.markConversationAsRead = function (
  conversationId,
  studentId
) {
  return this.updateMany(
    {
      conversationId,
      senderStudentId: { $ne: studentId },
      "readBy.studentId": { $ne: studentId },
      isDeleted: false,
    },
    {
      $push: { readBy: { studentId, readAt: new Date() } },
    }
  );
};

messageSchema.statics.getMessageStats = function (conversationId) {
  return this.aggregate([
    {
      $match: {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        lastMessage: { $max: "$createdAt" },
      },
    },
  ]);
};

messageSchema.statics.createSystemMessage = function (
  conversationId,
  action,
  metadata = {}
) {
  return this.create({
    conversationId,
    senderStudentId: "system", // Special sender for system messages
    type: "system",
    content: {
      system: {
        action,
        metadata,
      },
    },
  });
};

// Pre-save middleware
messageSchema.pre("save", function (next) {
  // Update updatedAt timestamp
  this.updatedAt = new Date();

  // Validate content based on message type
  if (this.type === "text") {
    if (!this.content.text || this.content.text.trim().length === 0) {
      return next(new Error("Text messages must have text content"));
    }
  }

  if (this.type === "image" || this.type === "file") {
    if (
      !this.content.media ||
      (!this.content.media.url && !this.content.media.cloudinaryPublicId)
    ) {
      return next(new Error(`${this.type} messages must have media content`));
    }
  }

  if (this.type === "system") {
    if (!this.content.system || !this.content.system.action) {
      return next(new Error("System messages must have action"));
    }
  }

  next();
});

// Pre-validate middleware
messageSchema.pre("validate", function (next) {
  // Trim text content
  if (this.content.text) {
    this.content.text = this.content.text.trim();
  }

  // Trim media filename
  if (this.content.media && this.content.media.filename) {
    this.content.media.filename = this.content.media.filename.trim();
  }

  next();
});

// Post-save middleware to update conversation
messageSchema.post("save", async function (doc) {
  if (doc.isNew && !doc.isDeleted) {
    try {
      const Conversation = mongoose.model("Conversation");
      const conversation = await Conversation.findById(doc.conversationId);

      if (conversation) {
        await conversation.updateLastMessage({
          content: doc.content.text || "[Media]",
          senderStudentId: doc.senderStudentId,
          createdAt: doc.createdAt,
          type: doc.type,
        });
        await conversation.incrementMessageCount();
      }
    } catch (error) {
      console.error("Error updating conversation after message save:", error);
    }
  }
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
