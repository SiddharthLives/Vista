const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reporterStudentId: {
      type: String,
      required: [true, "Reporter student ID is required"],
      trim: true,
    },
    reportedStudentId: {
      type: String,
      required: [true, "Reported student ID is required"],
      trim: true,
    },
    contentType: {
      type: String,
      required: [true, "Content type is required"],
      enum: {
        values: ["post", "comment", "topic", "story", "message", "user"],
        message:
          "Content type must be one of: post, comment, topic, story, message, user",
      },
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Content ID is required"],
    },
    reason: {
      type: String,
      required: [true, "Report reason is required"],
      enum: {
        values: [
          "spam",
          "harassment",
          "hate_speech",
          "inappropriate_content",
          "violence",
          "misinformation",
          "copyright",
          "privacy_violation",
          "other",
        ],
        message: "Invalid report reason",
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "reviewed", "resolved", "dismissed"],
        message:
          "Status must be one of: pending, reviewed, resolved, dismissed",
      },
      default: "pending",
    },
    moderatorStudentId: {
      type: String,
      trim: true,
    },
    moderatorAction: {
      type: String,
      enum: {
        values: [
          "none",
          "warning",
          "content_removed",
          "user_suspended",
          "user_banned",
          "resolved",
          "dismissed",
        ],
        message: "Invalid moderator action",
      },
    },
    moderatorNotes: {
      type: String,
      trim: true,
      maxlength: [1000, "Moderator notes cannot exceed 1000 characters"],
    },
    reviewedAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
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
reportSchema.index({ reporterStudentId: 1, createdAt: -1 });
reportSchema.index({ reportedStudentId: 1, createdAt: -1 });
reportSchema.index({ contentType: 1, contentId: 1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ moderatorStudentId: 1, reviewedAt: -1 });

// Compound index for admin queries
reportSchema.index({ status: 1, contentType: 1, createdAt: -1 });

// Static methods
reportSchema.statics.findPendingReports = function (limit = 50) {
  return this.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("reporterStudentId", "displayName email")
    .populate("reportedStudentId", "displayName email");
};

reportSchema.statics.findReportsByContent = function (contentType, contentId) {
  return this.find({ contentType, contentId })
    .sort({ createdAt: -1 })
    .populate("reporterStudentId", "displayName email")
    .populate("reportedStudentId", "displayName email");
};

reportSchema.statics.getReportStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
};

// Instance methods
reportSchema.methods.markAsReviewed = function (
  moderatorStudentId,
  action,
  notes
) {
  this.status = "reviewed";
  this.moderatorStudentId = moderatorStudentId;
  this.moderatorAction = action || "none";
  this.moderatorNotes = notes || "";
  this.reviewedAt = new Date();
  return this.save();
};

reportSchema.methods.resolve = function (moderatorStudentId, action, notes) {
  this.status = "resolved";
  this.moderatorStudentId = moderatorStudentId;
  this.moderatorAction = action || "none";
  this.moderatorNotes = notes || "";
  this.reviewedAt = new Date();
  return this.save();
};

reportSchema.methods.dismiss = function (moderatorStudentId, notes) {
  this.status = "dismissed";
  this.moderatorStudentId = moderatorStudentId;
  this.moderatorAction = "none";
  this.moderatorNotes = notes || "";
  this.reviewedAt = new Date();
  return this.save();
};

const Report = mongoose.model("Report", reportSchema);

module.exports = Report;
