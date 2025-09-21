const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: [true, "Student ID is required"],
      unique: true,
      trim: true,
      validate: {
        validator: function (v) {
          // Validate student ID format (e.g., 2025CS1001)
          return /^\d{4}[A-Z]{2,4}\d{3,4}$/.test(v);
        },
        message:
          "Student ID must follow format: YYYY[DEPT][NUMBER] (e.g., 2025CS1001)",
      },
    },
    email: {
      type: String,
      sparse: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null/undefined for sparse index
          // More strict email validation - no consecutive dots, proper format
          return /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(
            v
          );
        },
        message: "Please provide a valid email address",
      },
    },
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
      minlength: [2, "Display name must be at least 2 characters"],
      maxlength: [50, "Display name cannot exceed 50 characters"],
    },
    photoUrl: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true; // Allow null/undefined
          return /^https?:\/\/.+/.test(v);
        },
        message: "Photo URL must be a valid HTTP/HTTPS URL",
      },
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
      min: [1, "Year must be between 1 and 4"],
      max: [4, "Year must be between 1 and 4"],
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
      uppercase: true,
      enum: {
        values: ["CS", "ECE", "ME", "CE", "EE", "IT", "BT", "CH", "PH", "MA"],
        message:
          "Department must be one of: CS, ECE, ME, CE, EE, IT, BT, CH, PH, MA",
      },
    },
    section: {
      type: String,
      required: [true, "Section is required"],
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return false;
          return /^[A-Za-z]$/.test(v);
        },
        message: "Section must be a single uppercase letter (A-Z)",
      },
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    badges: [
      {
        type: String,
        trim: true,
      },
    ],
    fcmTokens: [
      {
        type: String,
        trim: true,
      },
    ],
    settings: {
      notifications: {
        type: Boolean,
        default: true,
      },
      privacy: {
        showEmail: {
          type: Boolean,
          default: false,
        },
        showYear: {
          type: Boolean,
          default: true,
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        // Remove sensitive fields from JSON output
        delete ret.__v;
        delete ret.fcmTokens;
        return ret;
      },
    },
  }
);

// Indexes for performance
userSchema.index({ studentId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ year: 1, department: 1, section: 1 });
userSchema.index({ displayName: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1 });

// Compound index for user discovery
userSchema.index({
  year: 1,
  department: 1,
  section: 1,
  isActive: 1,
});

// Text index for search functionality
userSchema.index(
  {
    displayName: "text",
    bio: "text",
  },
  {
    weights: {
      displayName: 10,
      bio: 5,
    },
  }
);

// Virtual for full student identifier
userSchema.virtual("fullStudentId").get(function () {
  return `${this.year}${this.department}${this.section}-${this.studentId}`;
});

// Instance methods
userSchema.methods.addFCMToken = function (token) {
  if (!this.fcmTokens.includes(token)) {
    this.fcmTokens.push(token);
  }
  return this.save();
};

userSchema.methods.removeFCMToken = function (token) {
  this.fcmTokens = this.fcmTokens.filter((t) => t !== token);
  return this.save();
};

userSchema.methods.updateLastLogin = function () {
  this.lastLoginAt = new Date();
  return this.save();
};

userSchema.methods.canViewProfile = function (viewerUser) {
  if (!viewerUser) return false;
  if (this.studentId === viewerUser.studentId) return true;

  // Same college students can view basic profiles
  return true;
};

// Static methods
userSchema.statics.findByStudentId = function (studentId) {
  return this.findOne({ studentId, isActive: true });
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

userSchema.statics.findByYearDeptSection = function (
  year,
  department,
  section
) {
  return this.find({
    year,
    department: department.toUpperCase(),
    section: section.toUpperCase(),
    isActive: true,
  });
};

userSchema.statics.searchUsers = function (query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    isActive: true,
    ...filters,
  };

  return this.find(searchQuery, { score: { $meta: "textScore" } }).sort({
    score: { $meta: "textScore" },
  });
};

// Pre-save middleware
userSchema.pre("save", function (next) {
  // Prevent studentId changes after creation
  if (!this.isNew && this.isModified("studentId")) {
    const error = new Error("Student ID cannot be modified after creation");
    error.name = "ValidationError";
    return next(error);
  }

  // Set joinedAt on first save if not already set
  if (this.isNew && !this.joinedAt) {
    this.joinedAt = new Date();
  }

  // Ensure department and section are uppercase
  if (this.department) {
    this.department = this.department.toUpperCase();
  }
  if (this.section) {
    this.section = this.section.toUpperCase();
  }

  next();
});

// Pre-validate middleware
userSchema.pre("validate", function (next) {
  // Trim whitespace from string fields
  if (this.displayName) {
    this.displayName = this.displayName.trim();
  }
  if (this.bio) {
    this.bio = this.bio.trim();
  }

  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
