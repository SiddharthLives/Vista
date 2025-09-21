const csv = require("csv-parser");
const { Readable } = require("stream");
const User = require("../models/User");
const Post = require("../models/Post");
const Topic = require("../models/Topic");
const Story = require("../models/Story");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");
const Report = require("../models/Report");

/**
 * Upload and process roster CSV file
 * @route POST /admin/roster
 * @access Admin only
 */
const uploadRoster = async (req, res) => {
  try {
    const { csvData } = req.body;

    if (!csvData) {
      return res.status(400).json({
        error: {
          code: "MISSING_CSV_DATA",
          message: "CSV data is required",
        },
      });
    }

    const results = [];
    const errors = [];
    const duplicates = [];
    let processedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    // Parse CSV data
    const stream = Readable.from([csvData]);

    const parsePromise = new Promise((resolve, reject) => {
      const csvResults = [];

      stream
        .pipe(
          csv({
            skipEmptyLines: true,
            skipLinesWithError: true,
          })
        )
        .on("data", (data) => {
          csvResults.push(data);
        })
        .on("end", () => {
          resolve(csvResults);
        })
        .on("error", (error) => {
          reject(error);
        });
    });

    const csvResults = await parsePromise;

    // Validate and process each row
    for (const row of csvResults) {
      processedCount++;

      try {
        // Validate required fields
        const { studentId, email, displayName, year, department, section } =
          row;

        if (
          !studentId ||
          !email ||
          !displayName ||
          !year ||
          !department ||
          !section
        ) {
          errors.push({
            row: processedCount,
            error: "Missing required fields",
            data: row,
          });
          continue;
        }

        // Validate student ID format
        if (!/^\d{4}[A-Z]{2,4}\d{3,4}$/.test(studentId.trim())) {
          errors.push({
            row: processedCount,
            error: "Invalid student ID format",
            data: row,
          });
          continue;
        }

        // Validate email format
        if (
          !/^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/.test(
            email.trim()
          )
        ) {
          errors.push({
            row: processedCount,
            error: "Invalid email format",
            data: row,
          });
          continue;
        }

        // Validate year
        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 1 || yearNum > 4) {
          errors.push({
            row: processedCount,
            error: "Year must be between 1 and 4",
            data: row,
          });
          continue;
        }

        // Validate department
        const validDepartments = [
          "CS",
          "ECE",
          "ME",
          "CE",
          "EE",
          "IT",
          "BT",
          "CH",
          "PH",
          "MA",
        ];
        if (!validDepartments.includes(department.trim().toUpperCase())) {
          errors.push({
            row: processedCount,
            error: `Invalid department. Must be one of: ${validDepartments.join(
              ", "
            )}`,
            data: row,
          });
          continue;
        }

        // Validate section
        if (!/^[A-Za-z]$/.test(section.trim())) {
          errors.push({
            row: processedCount,
            error: "Section must be a single letter",
            data: row,
          });
          continue;
        }

        // Check for existing user with same studentId or email
        const existingUser = await User.findOne({
          $or: [
            { studentId: studentId.trim() },
            { email: email.trim().toLowerCase() },
          ],
        });

        if (existingUser) {
          duplicates.push({
            row: processedCount,
            existingStudentId: existingUser.studentId,
            existingEmail: existingUser.email,
            newData: row,
          });
          skippedCount++;
          continue;
        }

        // Create new user
        const newUser = new User({
          studentId: studentId.trim(),
          email: email.trim().toLowerCase(),
          displayName: displayName.trim(),
          year: yearNum,
          department: department.trim().toUpperCase(),
          section: section.trim().toUpperCase(),
          bio: "",
          isActive: true,
        });

        await newUser.save();
        createdCount++;

        results.push({
          studentId: newUser.studentId,
          email: newUser.email,
          displayName: newUser.displayName,
          year: newUser.year,
          department: newUser.department,
          section: newUser.section,
        });
      } catch (error) {
        errors.push({
          row: processedCount,
          error: error.message,
          data: row,
        });
      }
    }

    res.status(200).json({
      message: "Roster upload completed",
      summary: {
        totalProcessed: processedCount,
        created: createdCount,
        skipped: skippedCount,
        errors: errors.length,
        duplicates: duplicates.length,
      },
      results,
      errors,
      duplicates,
    });
  } catch (error) {
    console.error("Roster upload error:", error);
    res.status(500).json({
      error: {
        code: "ROSTER_UPLOAD_ERROR",
        message: "Failed to process roster upload",
        details: error.message,
      },
    });
  }
};

/**
 * Get basic analytics and metrics
 * @route GET /admin/reports
 * @access Admin only
 */
const getReports = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    // Default to last 30 days if no date range provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const reports = {};

    // User statistics
    if (!type || type === "users") {
      const totalUsers = await User.countDocuments({ isActive: true });
      const newUsers = await User.countDocuments({
        isActive: true,
        createdAt: { $gte: start, $lte: end },
      });

      const usersByYear = await User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$year", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      const usersByDepartment = await User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      reports.users = {
        total: totalUsers,
        newInPeriod: newUsers,
        byYear: usersByYear,
        byDepartment: usersByDepartment,
      };
    }

    // Content statistics
    if (!type || type === "content") {
      const totalPosts = await Post.countDocuments();
      const newPosts = await Post.countDocuments({
        createdAt: { $gte: start, $lte: end },
      });

      const totalTopics = await Topic.countDocuments();
      const newTopics = await Topic.countDocuments({
        createdAt: { $gte: start, $lte: end },
      });

      const totalStories = await Story.countDocuments();
      const newStories = await Story.countDocuments({
        createdAt: { $gte: start, $lte: end },
      });

      const postsByType = await Post.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      reports.content = {
        posts: {
          total: totalPosts,
          newInPeriod: newPosts,
          byType: postsByType,
        },
        topics: {
          total: totalTopics,
          newInPeriod: newTopics,
        },
        stories: {
          total: totalStories,
          newInPeriod: newStories,
        },
      };
    }

    // Activity statistics
    if (!type || type === "activity") {
      const dailyActiveUsers = await User.countDocuments({
        lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        isActive: true,
      });

      const weeklyActiveUsers = await User.countDocuments({
        lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        isActive: true,
      });

      const monthlyActiveUsers = await User.countDocuments({
        lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        isActive: true,
      });

      reports.activity = {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
      };
    }

    res.status(200).json({
      message: "Reports generated successfully",
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      reports,
    });
  } catch (error) {
    console.error("Reports generation error:", error);
    res.status(500).json({
      error: {
        code: "REPORTS_ERROR",
        message: "Failed to generate reports",
        details: error.message,
      },
    });
  }
};

/**
 * Export user data for privacy compliance
 * @route GET /admin/export
 * @access Admin only
 */
const exportData = async (req, res) => {
  try {
    const { type, format = "json" } = req.query;

    if (!type) {
      return res.status(400).json({
        error: {
          code: "MISSING_EXPORT_TYPE",
          message: "Export type is required (users, posts, topics, etc.)",
        },
      });
    }

    let data = [];

    switch (type) {
      case "users":
        data = await User.find({ isActive: true })
          .select("-fcmTokens -__v")
          .lean();
        break;

      case "posts":
        data = await Post.find()
          .populate("authorStudentId", "displayName email")
          .lean();
        break;

      case "topics":
        data = await Topic.find()
          .populate("authorStudentId", "displayName email")
          .lean();
        break;

      default:
        return res.status(400).json({
          error: {
            code: "INVALID_EXPORT_TYPE",
            message:
              "Invalid export type. Supported types: users, posts, topics",
          },
        });
    }

    if (format === "csv" && type === "users") {
      // Convert to CSV for users
      const csvHeader =
        "studentId,email,displayName,year,department,section,createdAt\n";
      const csvData = data
        .map(
          (user) =>
            `${user.studentId},${user.email},${user.displayName},${user.year},${user.department},${user.section},${user.createdAt}`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${type}_export.csv"`
      );
      res.send(csvHeader + csvData);
    } else {
      res.status(200).json({
        message: `${type} data exported successfully`,
        count: data.length,
        data,
      });
    }
  } catch (error) {
    console.error("Data export error:", error);
    res.status(500).json({
      error: {
        code: "EXPORT_ERROR",
        message: "Failed to export data",
        details: error.message,
      },
    });
  }
};

/**
 * Moderate content (remove, ban users, etc.)
 * @route POST /admin/moderate
 * @access Admin only
 */
const moderateContent = async (req, res) => {
  try {
    const { action, contentType, contentId, userId, reason, notes } = req.body;
    const moderatorStudentId = req.user.studentId;

    if (!action) {
      return res.status(400).json({
        error: {
          code: "MISSING_ACTION",
          message: "Moderation action is required",
        },
      });
    }

    const validActions = [
      "remove_content",
      "warn_user",
      "suspend_user",
      "ban_user",
      "dismiss_report",
    ];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: {
          code: "INVALID_ACTION",
          message: `Action must be one of: ${validActions.join(", ")}`,
        },
      });
    }

    let result = {};

    switch (action) {
      case "remove_content":
        if (!contentType || !contentId) {
          return res.status(400).json({
            error: {
              code: "MISSING_CONTENT_INFO",
              message: "Content type and ID are required for content removal",
            },
          });
        }

        // Remove content based on type
        let removedContent = null;
        switch (contentType) {
          case "post":
            removedContent = await Post.findByIdAndUpdate(
              contentId,
              {
                isRemoved: true,
                removedBy: moderatorStudentId,
                removedAt: new Date(),
                removedReason: reason,
              },
              { new: true }
            );
            break;
          case "topic":
            removedContent = await Topic.findByIdAndUpdate(
              contentId,
              {
                isRemoved: true,
                removedBy: moderatorStudentId,
                removedAt: new Date(),
                removedReason: reason,
              },
              { new: true }
            );
            break;
          case "comment":
            removedContent = await Comment.findByIdAndUpdate(
              contentId,
              {
                isRemoved: true,
                removedBy: moderatorStudentId,
                removedAt: new Date(),
                removedReason: reason,
              },
              { new: true }
            );
            break;
          case "story":
            removedContent = await Story.findByIdAndDelete(contentId);
            break;
          default:
            return res.status(400).json({
              error: {
                code: "INVALID_CONTENT_TYPE",
                message: "Invalid content type for removal",
              },
            });
        }

        if (!removedContent) {
          return res.status(404).json({
            error: {
              code: "CONTENT_NOT_FOUND",
              message: "Content not found",
            },
          });
        }

        result.contentRemoved = true;
        result.contentType = contentType;
        result.contentId = contentId;
        break;

      case "warn_user":
      case "suspend_user":
      case "ban_user":
        if (!userId) {
          return res.status(400).json({
            error: {
              code: "MISSING_USER_ID",
              message: "User ID is required for user moderation",
            },
          });
        }

        const user = await User.findOne({ studentId: userId });
        if (!user) {
          return res.status(404).json({
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found",
            },
          });
        }

        // Update user status based on action
        if (action === "suspend_user") {
          user.isActive = false;
          user.suspendedAt = new Date();
          user.suspendedBy = moderatorStudentId;
          user.suspensionReason = reason;
        } else if (action === "ban_user") {
          user.isActive = false;
          user.bannedAt = new Date();
          user.bannedBy = moderatorStudentId;
          user.banReason = reason;
        }

        await user.save();

        result.userModerated = true;
        result.userId = userId;
        result.action = action;
        break;

      case "dismiss_report":
        // This will be handled when we process reports
        result.reportDismissed = true;
        break;
    }

    // Update related reports if contentId is provided
    if (contentId && contentType) {
      await Report.updateMany(
        { contentId, contentType, status: "pending" },
        {
          status: "resolved",
          moderatorStudentId,
          moderatorAction: action,
          moderatorNotes: notes || "",
          reviewedAt: new Date(),
        }
      );
    }

    res.status(200).json({
      message: "Moderation action completed successfully",
      action,
      moderator: moderatorStudentId,
      timestamp: new Date().toISOString(),
      result,
      notes: notes || "",
    });
  } catch (error) {
    console.error("Content moderation error:", error);
    res.status(500).json({
      error: {
        code: "MODERATION_ERROR",
        message: "Failed to perform moderation action",
        details: error.message,
      },
    });
  }
};

/**
 * Get pending reports for moderation
 * @route GET /admin/reports/pending
 * @access Admin only
 */
const getPendingReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, contentType, reason } = req.query;
    const skip = (page - 1) * limit;

    const filter = { status: "pending" };
    if (contentType) filter.contentType = contentType;
    if (reason) filter.reason = reason;

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("reporterStudentId", "displayName email")
      .populate("reportedStudentId", "displayName email");

    const totalReports = await Report.countDocuments(filter);

    res.status(200).json({
      message: "Pending reports retrieved successfully",
      reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReports / limit),
        totalReports,
        hasNext: skip + reports.length < totalReports,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Get pending reports error:", error);
    res.status(500).json({
      error: {
        code: "REPORTS_FETCH_ERROR",
        message: "Failed to fetch pending reports",
        details: error.message,
      },
    });
  }
};

/**
 * Process a specific report
 * @route POST /admin/reports/:reportId/process
 * @access Admin only
 */
const processReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, notes } = req.body;
    const moderatorStudentId = req.user.studentId;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        error: {
          code: "REPORT_NOT_FOUND",
          message: "Report not found",
        },
      });
    }

    if (report.status !== "pending") {
      return res.status(400).json({
        error: {
          code: "REPORT_ALREADY_PROCESSED",
          message: "Report has already been processed",
        },
      });
    }

    const validActions = ["resolve", "dismiss"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: {
          code: "INVALID_ACTION",
          message: `Action must be one of: ${validActions.join(", ")}`,
        },
      });
    }

    if (action === "resolve") {
      await report.resolve(moderatorStudentId, "resolved", notes);
    } else {
      await report.dismiss(moderatorStudentId, notes);
    }

    res.status(200).json({
      message: `Report ${
        action === "resolve" ? "resolved" : "dismissed"
      } successfully`,
      report: {
        id: report._id,
        status: report.status,
        moderatorStudentId: report.moderatorStudentId,
        moderatorAction: report.moderatorAction,
        moderatorNotes: report.moderatorNotes,
        reviewedAt: report.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Process report error:", error);
    res.status(500).json({
      error: {
        code: "REPORT_PROCESS_ERROR",
        message: "Failed to process report",
        details: error.message,
      },
    });
  }
};

/**
 * Create a new report (for users to report content)
 * @route POST /admin/reports
 * @access Authenticated users
 */
const createReport = async (req, res) => {
  try {
    const { contentType, contentId, reportedStudentId, reason, description } =
      req.body;
    const reporterStudentId = req.user.studentId;

    // Validate required fields
    if (!contentType || !contentId || !reportedStudentId || !reason) {
      return res.status(400).json({
        error: {
          code: "MISSING_REQUIRED_FIELDS",
          message:
            "Content type, content ID, reported user ID, and reason are required",
        },
      });
    }

    // Check if user is trying to report themselves
    if (reporterStudentId === reportedStudentId) {
      return res.status(400).json({
        error: {
          code: "SELF_REPORT_NOT_ALLOWED",
          message: "You cannot report your own content",
        },
      });
    }

    // Check if user has already reported this content
    const existingReport = await Report.findOne({
      reporterStudentId,
      contentType,
      contentId,
    });

    if (existingReport) {
      return res.status(400).json({
        error: {
          code: "ALREADY_REPORTED",
          message: "You have already reported this content",
        },
      });
    }

    // Verify the reported user exists
    const reportedUser = await User.findOne({ studentId: reportedStudentId });
    if (!reportedUser) {
      return res.status(404).json({
        error: {
          code: "REPORTED_USER_NOT_FOUND",
          message: "Reported user not found",
        },
      });
    }

    // Create the report
    const report = new Report({
      reporterStudentId,
      reportedStudentId,
      contentType,
      contentId,
      reason,
      description: description || "",
    });

    await report.save();

    res.status(201).json({
      message: "Report submitted successfully",
      report: {
        id: report._id,
        contentType: report.contentType,
        contentId: report.contentId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    console.error("Create report error:", error);
    res.status(500).json({
      error: {
        code: "REPORT_CREATION_ERROR",
        message: "Failed to create report",
        details: error.message,
      },
    });
  }
};

module.exports = {
  uploadRoster,
  getReports,
  exportData,
  moderateContent,
  getPendingReports,
  processReport,
  createReport,
};
