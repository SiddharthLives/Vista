const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    toStudentId: {
      type: String,
      required: [true, "Recipient student ID is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Validate student ID format (e.g., 2025CS1001)
          return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
        },
        message:
          "Recipient student ID must follow format: YYYY[DEPT][NUMBER] (e.g., 2025CS1001)",
      },
    },
    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: {
        values: [
          "like",
          "comment",
          "follow",
          "message",
          "topic",
          "story_view",
          "mention",
          "system",
        ],
        message:
          "Notification type must be one of: like, comment, follow, message, topic, story_view, mention, system",
      },
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [100, "Notification title cannot exceed 100 characters"],
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [500, "Notification message cannot exceed 500 characters"],
    },
    meta: {
      // Reference to the entity that triggered the notification
      entityType: {
        type: String,
        enum: ["Post", "Topic", "Comment", "Story", "Message", "User"],
        validate: {
          validator: function (v) {
            // EntityType is required for non-system notifications
            return this.type === "system" || v;
          },
          message: "Entity type is required for non-system notifications",
        },
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        validate: {
          validator: function (v) {
            // EntityId is required for non-system notifications
            return this.type === "system" || v;
          },
          message: "Entity ID is required for non-system notifications",
        },
      },
      // User who triggered the notification
      fromStudentId: {
        type: String,
        trim: true,
        validate: {
          validator: function (v) {
            if (!v) return true; // Allow null/undefined for system notifications
            return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
          },
          message: "From student ID must follow format: YYYY[DEPT][NUMBER]",
        },
      },
      fromUserName: {
        type: String,
        trim: true,
        maxlength: [50, "From user name cannot exceed 50 characters"],
      },
      // Additional context data
      postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
      topicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Topic",
      },
      commentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
      storyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story",
      },
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
      },
      // Additional metadata for specific notification types
      additionalData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: {
        values: ["low", "normal", "high", "urgent"],
        message: "Priority must be one of: low, normal, high, urgent",
      },
      default: "normal",
    },
    deliveryMethod: {
      type: String,
      enum: {
        values: ["in_app", "push", "email", "all"],
        message: "Delivery method must be one of: in_app, push, email, all",
      },
      default: "in_app",
    },
    deliveryStatus: {
      inApp: {
        delivered: { type: Boolean, default: false },
        deliveredAt: { type: Date, default: null },
      },
      push: {
        delivered: { type: Boolean, default: false },
        deliveredAt: { type: Date, default: null },
        fcmMessageId: { type: String, default: null },
      },
      email: {
        delivered: { type: Boolean, default: false },
        deliveredAt: { type: Date, default: null },
        emailId: { type: String, default: null },
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
        // Notifications expire after 30 days by default
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      },
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
notificationSchema.index({ toStudentId: 1, createdAt: -1 }); // User's notifications
notificationSchema.index({ toStudentId: 1, isRead: 1, createdAt: -1 }); // Unread notifications
notificationSchema.index({ type: 1, createdAt: -1 }); // Notifications by type
notificationSchema.index({ isActive: 1, createdAt: -1 }); // Active notifications
notificationSchema.index({ expiresAt: 1 }); // TTL-like cleanup queries
notificationSchema.index({ priority: 1, createdAt: -1 }); // Priority-based queries

// Compound indexes for complex queries
notificationSchema.index({
  toStudentId: 1,
  isActive: 1,
  isRead: 1,
  createdAt: -1,
}); // Active unread notifications for user

notificationSchema.index({
  "meta.fromStudentId": 1,
  type: 1,
  createdAt: -1,
}); // Notifications from specific user

// Virtual to check if notification is expired
notificationSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// Virtual to get time remaining until expiration
notificationSchema.virtual("timeRemaining").get(function () {
  const now = new Date();
  const remaining = this.expiresAt.getTime() - now.getTime();
  return Math.max(0, remaining);
});

// Virtual to check delivery status
notificationSchema.virtual("isDelivered").get(function () {
  switch (this.deliveryMethod) {
    case "in_app":
      return this.deliveryStatus.inApp.delivered;
    case "push":
      return this.deliveryStatus.push.delivered;
    case "email":
      return this.deliveryStatus.email.delivered;
    case "all":
      return (
        this.deliveryStatus.inApp.delivered &&
        this.deliveryStatus.push.delivered &&
        this.deliveryStatus.email.delivered
      );
    default:
      return false;
  }
});

// Virtual to get display message with user context
notificationSchema.virtual("displayMessage").get(function () {
  if (!this.meta.fromUserName) {
    return this.message;
  }

  return this.message.replace("{userName}", this.meta.fromUserName);
});

// Instance methods
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsUnread = function () {
  this.isRead = false;
  this.readAt = null;
  return this.save();
};

notificationSchema.methods.markAsDelivered = function (
  method = "in_app",
  metadata = {}
) {
  const now = new Date();

  switch (method) {
    case "in_app":
      this.deliveryStatus.inApp.delivered = true;
      this.deliveryStatus.inApp.deliveredAt = now;
      break;
    case "push":
      this.deliveryStatus.push.delivered = true;
      this.deliveryStatus.push.deliveredAt = now;
      if (metadata.fcmMessageId) {
        this.deliveryStatus.push.fcmMessageId = metadata.fcmMessageId;
      }
      break;
    case "email":
      this.deliveryStatus.email.delivered = true;
      this.deliveryStatus.email.deliveredAt = now;
      if (metadata.emailId) {
        this.deliveryStatus.email.emailId = metadata.emailId;
      }
      break;
  }

  return this.save();
};

notificationSchema.methods.updatePriority = function (newPriority) {
  this.priority = newPriority;
  return this.save();
};

notificationSchema.methods.extendExpiration = function (additionalDays = 7) {
  const additionalMs = additionalDays * 24 * 60 * 60 * 1000;
  this.expiresAt = new Date(this.expiresAt.getTime() + additionalMs);
  return this.save();
};

notificationSchema.methods.markAsInactive = function () {
  this.isActive = false;
  return this.save();
};

notificationSchema.methods.shouldSendPush = function () {
  return (
    (this.deliveryMethod === "push" || this.deliveryMethod === "all") &&
    !this.deliveryStatus.push.delivered &&
    this.isActive &&
    !this.isExpired
  );
};

notificationSchema.methods.shouldSendEmail = function () {
  return (
    (this.deliveryMethod === "email" || this.deliveryMethod === "all") &&
    !this.deliveryStatus.email.delivered &&
    this.isActive &&
    !this.isExpired
  );
};

// Static methods
notificationSchema.statics.findByUser = function (studentId, options = {}) {
  const query = {
    toStudentId: studentId,
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

notificationSchema.statics.findUnreadByUser = function (
  studentId,
  options = {}
) {
  const query = {
    toStudentId: studentId,
    isRead: false,
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .limit(options.limit || 50);
};

notificationSchema.statics.findByType = function (type, options = {}) {
  const query = {
    type,
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100);
};

notificationSchema.statics.findPendingDelivery = function (
  method = "push",
  options = {}
) {
  const query = {
    isActive: true,
    expiresAt: { $gt: new Date() },
    $or: [{ deliveryMethod: method }, { deliveryMethod: "all" }],
    ...options.filters,
  };

  // Add method-specific delivery status check
  switch (method) {
    case "push":
      query["deliveryStatus.push.delivered"] = false;
      break;
    case "email":
      query["deliveryStatus.email.delivered"] = false;
      break;
    case "in_app":
      query["deliveryStatus.inApp.delivered"] = false;
      break;
  }

  return this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .limit(options.limit || 100);
};

notificationSchema.statics.markAllAsRead = function (studentId) {
  return this.updateMany(
    {
      toStudentId: studentId,
      isRead: false,
      isActive: true,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    }
  );
};

notificationSchema.statics.getUnreadCount = function (studentId) {
  return this.countDocuments({
    toStudentId: studentId,
    isRead: false,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
};

notificationSchema.statics.cleanupExpired = function () {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
};

notificationSchema.statics.createLikeNotification = function (
  toStudentId,
  fromStudentId,
  fromUserName,
  postId
) {
  return this.create({
    toStudentId,
    type: "like",
    title: "New Like",
    message: "{userName} liked your post",
    meta: {
      entityType: "Post",
      entityId: postId,
      fromStudentId,
      fromUserName,
      postId,
    },
    priority: "normal",
    deliveryMethod: "all",
  });
};

notificationSchema.statics.createCommentNotification = function (
  toStudentId,
  fromStudentId,
  fromUserName,
  postId,
  commentId
) {
  return this.create({
    toStudentId,
    type: "comment",
    title: "New Comment",
    message: "{userName} commented on your post",
    meta: {
      entityType: "Comment",
      entityId: commentId,
      fromStudentId,
      fromUserName,
      postId,
      commentId,
    },
    priority: "high",
    deliveryMethod: "all",
  });
};

notificationSchema.statics.createMessageNotification = function (
  toStudentId,
  fromStudentId,
  fromUserName,
  conversationId,
  messageId
) {
  return this.create({
    toStudentId,
    type: "message",
    title: "New Message",
    message: "{userName} sent you a message",
    meta: {
      entityType: "Message",
      entityId: messageId,
      fromStudentId,
      fromUserName,
      conversationId,
      messageId,
    },
    priority: "high",
    deliveryMethod: "all",
  });
};

notificationSchema.statics.createTopicNotification = function (
  toStudentId,
  fromStudentId,
  fromUserName,
  topicId,
  action = "created"
) {
  const actionMessages = {
    created: "{userName} created a new topic",
    commented: "{userName} commented on a topic you follow",
    voted: "{userName} voted on your topic",
  };

  return this.create({
    toStudentId,
    type: "topic",
    title: "Topic Activity",
    message: actionMessages[action] || actionMessages.created,
    meta: {
      entityType: "Topic",
      entityId: topicId,
      fromStudentId,
      fromUserName,
      topicId,
      additionalData: { action },
    },
    priority: "normal",
    deliveryMethod: "in_app",
  });
};

notificationSchema.statics.createSystemNotification = function (
  toStudentId,
  title,
  message,
  additionalData = {}
) {
  return this.create({
    toStudentId,
    type: "system",
    title,
    message,
    meta: {
      additionalData,
    },
    priority: "normal",
    deliveryMethod: "in_app",
  });
};

notificationSchema.statics.getNotificationStats = function (studentId) {
  return this.aggregate([
    {
      $match: {
        toStudentId: studentId,
        isActive: true,
      },
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: 1 },
        unread: {
          $sum: {
            $cond: [{ $eq: ["$isRead", false] }, 1, 0],
          },
        },
        lastNotification: { $max: "$createdAt" },
      },
    },
  ]);
};

// Pre-save middleware
notificationSchema.pre("save", function (next) {
  // Validate that system notifications don't have fromStudentId
  if (this.type === "system" && this.meta.fromStudentId) {
    return next(new Error("System notifications cannot have fromStudentId"));
  }

  // Validate that non-system notifications have required meta fields
  if (this.type !== "system") {
    if (!this.meta.entityType || !this.meta.entityId) {
      return next(
        new Error("Non-system notifications must have entityType and entityId")
      );
    }
  }

  // Set default delivery status
  if (this.isNew) {
    this.deliveryStatus = {
      inApp: { delivered: false, deliveredAt: null },
      push: { delivered: false, deliveredAt: null, fcmMessageId: null },
      email: { delivered: false, deliveredAt: null, emailId: null },
    };
  }

  next();
});

// Pre-validate middleware
notificationSchema.pre("validate", function (next) {
  // Trim title and message
  if (this.title) {
    this.title = this.title.trim();
  }
  if (this.message) {
    this.message = this.message.trim();
  }

  // Trim meta fields
  if (this.meta.fromUserName) {
    this.meta.fromUserName = this.meta.fromUserName.trim();
  }

  next();
});

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
