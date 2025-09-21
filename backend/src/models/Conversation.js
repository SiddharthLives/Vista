const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: String,
        required: [true, "Participant student ID is required"],
        validate: {
          validator: function (v) {
            // Validate student ID format (e.g., 2025CS1001)
            return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
          },
          message:
            "Participant student ID must follow format: YYYY[DEPT][NUMBER] (e.g., 2025CS1001)",
        },
      },
    ],
    type: {
      type: String,
      enum: {
        values: ["direct", "group"],
        message: "Conversation type must be either direct or group",
      },
      default: "direct",
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Conversation title cannot exceed 100 characters"],
      default: null,
    },
    lastMessage: {
      content: {
        type: String,
        trim: true,
        maxlength: [500, "Last message preview cannot exceed 500 characters"],
      },
      senderStudentId: {
        type: String,
        validate: {
          validator: function (v) {
            if (!v) return true; // Allow null/undefined
            return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
          },
          message: "Sender student ID must follow format: YYYY[DEPT][NUMBER]",
        },
      },
      timestamp: {
        type: Date,
        default: null,
      },
      messageType: {
        type: String,
        enum: ["text", "image", "file"],
        default: "text",
      },
    },
    messagesCount: {
      type: Number,
      default: 0,
      min: [0, "Messages count cannot be negative"],
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
    // Group conversation specific fields
    createdBy: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null/undefined for direct conversations
          return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
        },
        message: "Creator student ID must follow format: YYYY[DEPT][NUMBER]",
      },
      default: null,
    },
    admins: [
      {
        type: String,
        validate: {
          validator: function (v) {
            return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
          },
          message: "Admin student ID must follow format: YYYY[DEPT][NUMBER]",
        },
      },
    ],
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
conversationSchema.index({ participants: 1, updatedAt: -1 }); // User's conversations
conversationSchema.index({ updatedAt: -1 }); // Recent conversations
conversationSchema.index({ isActive: 1, updatedAt: -1 }); // Active conversations
conversationSchema.index({ type: 1, updatedAt: -1 }); // Conversation type filtering

// Compound index for efficient participant queries
conversationSchema.index({
  participants: 1,
  isActive: 1,
  updatedAt: -1,
});

// Virtual to check if conversation is direct message
conversationSchema.virtual("isDirectMessage").get(function () {
  return this.type === "direct" && this.participants.length === 2;
});

// Virtual to check if conversation is group
conversationSchema.virtual("isGroup").get(function () {
  return this.type === "group";
});

// Virtual to get participant count
conversationSchema.virtual("participantCount").get(function () {
  return this.participants.length;
});

// Virtual to get display title
conversationSchema.virtual("displayTitle").get(function () {
  if (this.title) {
    return this.title;
  }

  if (this.isDirectMessage) {
    return "Direct Message";
  }

  return `Group (${this.participantCount} members)`;
});

// Instance methods
conversationSchema.methods.addParticipant = function (studentId) {
  if (!this.participants.includes(studentId)) {
    this.participants.push(studentId);
    this.updatedAt = new Date();
  }
  return this.save();
};

conversationSchema.methods.removeParticipant = function (studentId) {
  this.participants = this.participants.filter((p) => p !== studentId);
  this.updatedAt = new Date();

  // Remove from admins if they were an admin
  this.admins = this.admins.filter((a) => a !== studentId);

  return this.save();
};

conversationSchema.methods.addAdmin = function (studentId) {
  if (
    this.participants.includes(studentId) &&
    !this.admins.includes(studentId)
  ) {
    this.admins.push(studentId);
  }
  return this.save();
};

conversationSchema.methods.removeAdmin = function (studentId) {
  this.admins = this.admins.filter((a) => a !== studentId);
  return this.save();
};

conversationSchema.methods.isParticipant = function (studentId) {
  return this.participants.includes(studentId);
};

conversationSchema.methods.isAdmin = function (studentId) {
  return this.admins.includes(studentId);
};

conversationSchema.methods.updateLastMessage = function (messageData) {
  this.lastMessage = {
    content: messageData.content || messageData.text || "[Media]",
    senderStudentId: messageData.senderStudentId,
    timestamp: messageData.createdAt || new Date(),
    messageType: messageData.type || "text",
  };
  this.updatedAt = new Date();
  return this.save();
};

conversationSchema.methods.incrementMessageCount = function () {
  this.messagesCount += 1;
  this.updatedAt = new Date();
  return this.save();
};

conversationSchema.methods.decrementMessageCount = function () {
  if (this.messagesCount > 0) {
    this.messagesCount -= 1;
    this.updatedAt = new Date();
  }
  return this.save();
};

conversationSchema.methods.markAsInactive = function () {
  this.isActive = false;
  this.updatedAt = new Date();
  return this.save();
};

conversationSchema.methods.getOtherParticipant = function (currentStudentId) {
  if (!this.isDirectMessage) {
    return null;
  }

  return this.participants.find((p) => p !== currentStudentId);
};

// Static methods
conversationSchema.statics.findByParticipant = function (
  studentId,
  options = {}
) {
  const query = {
    participants: studentId,
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ updatedAt: -1 })
    .limit(options.limit || 50);
};

conversationSchema.statics.findDirectConversation = function (
  participant1,
  participant2
) {
  return this.findOne({
    type: "direct",
    participants: { $all: [participant1, participant2], $size: 2 },
    isActive: true,
  });
};

conversationSchema.statics.findOrCreateDirectConversation = async function (
  participant1,
  participant2
) {
  let conversation = await this.findDirectConversation(
    participant1,
    participant2
  );

  if (!conversation) {
    conversation = new this({
      type: "direct",
      participants: [participant1, participant2],
    });
    await conversation.save();
  }

  return conversation;
};

conversationSchema.statics.findGroupConversations = function (
  studentId,
  options = {}
) {
  const query = {
    type: "group",
    participants: studentId,
    isActive: true,
    ...options.filters,
  };

  return this.find(query)
    .sort({ updatedAt: -1 })
    .limit(options.limit || 50);
};

conversationSchema.statics.createGroupConversation = function (
  creatorStudentId,
  participants,
  title
) {
  // Ensure creator is in participants
  const allParticipants = [...new Set([creatorStudentId, ...participants])];

  return this.create({
    type: "group",
    participants: allParticipants,
    title: title,
    createdBy: creatorStudentId,
    admins: [creatorStudentId],
  });
};

conversationSchema.statics.searchConversations = function (
  studentId,
  searchQuery,
  options = {}
) {
  const query = {
    participants: studentId,
    isActive: true,
    $or: [
      { title: { $regex: searchQuery, $options: "i" } },
      { "lastMessage.content": { $regex: searchQuery, $options: "i" } },
    ],
    ...options.filters,
  };

  return this.find(query)
    .sort({ updatedAt: -1 })
    .limit(options.limit || 20);
};

conversationSchema.statics.getConversationStats = function (studentId) {
  return this.aggregate([
    {
      $match: {
        participants: studentId,
        isActive: true,
      },
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        totalMessages: { $sum: "$messagesCount" },
      },
    },
  ]);
};

// Pre-save middleware
conversationSchema.pre("save", function (next) {
  // Update updatedAt timestamp
  this.updatedAt = new Date();

  // Validate participants array
  if (!this.participants || this.participants.length === 0) {
    return next(new Error("Conversation must have at least one participant"));
  }

  // Validate direct conversation has exactly 2 participants
  if (this.type === "direct" && this.participants.length !== 2) {
    return next(
      new Error("Direct conversations must have exactly 2 participants")
    );
  }

  // Validate group conversation has at least 2 participants
  if (this.type === "group" && this.participants.length < 2) {
    return next(
      new Error("Group conversations must have at least 2 participants")
    );
  }

  // Remove duplicates from participants
  this.participants = [...new Set(this.participants)];

  // Remove duplicates from admins and ensure admins are participants
  if (this.admins && this.admins.length > 0) {
    this.admins = [...new Set(this.admins)];
    this.admins = this.admins.filter((admin) =>
      this.participants.includes(admin)
    );
  }

  // Set creator as admin for group conversations
  if (
    this.type === "group" &&
    this.createdBy &&
    !this.admins.includes(this.createdBy)
  ) {
    this.admins.push(this.createdBy);
  }

  next();
});

// Pre-validate middleware
conversationSchema.pre("validate", function (next) {
  // Trim title
  if (this.title) {
    this.title = this.title.trim();
  }

  // Trim last message content
  if (this.lastMessage && this.lastMessage.content) {
    this.lastMessage.content = this.lastMessage.content.trim();
  }

  next();
});

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = Conversation;
