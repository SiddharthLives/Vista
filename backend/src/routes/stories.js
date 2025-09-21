const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const Story = require("../models/Story");
const User = require("../models/User");
const {
  authenticateToken,
  optionalAuth,
} = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * Validation middleware to check for validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input data",
        details: errors.array(),
      },
    });
  }
  next();
};

/**
 * Helper function to check if a user can view a story
 */
const canUserViewStory = async (story, user) => {
  if (!user) {
    return false;
  }

  // Get author details
  const author = await User.findOne({
    studentId: story.authorStudentId,
  }).lean();
  if (!author) {
    return false;
  }

  // Get viewer details
  const viewer = await User.findOne({ studentId: user.studentId }).lean();
  if (!viewer) {
    return false;
  }

  return story.canBeViewedBy(
    user.studentId,
    viewer.year,
    viewer.department,
    viewer.section,
    author.year,
    author.department,
    author.section
  );
};

/**
 * POST /stories - Create a new story
 */
router.post(
  "/",
  authenticateToken,
  [
    body("media.url").isURL().withMessage("Media URL must be valid"),
    body("media.cloudinaryPublicId")
      .matches(
        /^college\/\d{1,4}-[A-Z]{2,4}\/dept-[A-Z]{2,4}\/section-[A-Z]\/student-\d{4}[A-Z]{2,4}\d{3,4}\//
      )
      .withMessage("Cloudinary public ID must follow college folder structure"),
    body("media.width")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Media width must be a positive integer"),
    body("media.height")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Media height must be a positive integer"),
    body("media.duration")
      .optional()
      .isFloat({ min: 0, max: 60 })
      .withMessage("Media duration must be between 0 and 60 seconds"),
    body("media.type")
      .isIn(["image", "video"])
      .withMessage("Media type must be either image or video"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { media } = req.body;

      // Get full user details for media ownership validation
      const userDetails = await User.findOne({
        studentId: req.user.studentId,
      }).lean();
      if (!userDetails) {
        return res.status(401).json({
          error: {
            code: "USER_NOT_FOUND",
            message: "User account not found",
          },
        });
      }

      // Validate media ownership - ensure cloudinary public_id belongs to the user
      // Extract year from studentId (first 4 digits)
      const fullYear = userDetails.studentId.substring(0, 4);
      const userFolder = `college/${fullYear}-${userDetails.department}/dept-${userDetails.department}/section-${userDetails.section}/student-${userDetails.studentId}/`;

      if (!media.cloudinaryPublicId.startsWith(userFolder)) {
        return res.status(403).json({
          error: {
            code: "INVALID_MEDIA_OWNERSHIP",
            message: "Media does not belong to the authenticated user",
            details: {
              expected: userFolder,
              received: media.cloudinaryPublicId,
            },
          },
        });
      }

      // Create story
      const storyData = {
        authorStudentId: req.user.studentId,
        media: {
          url: media.url,
          cloudinaryPublicId: media.cloudinaryPublicId,
          width: media.width,
          height: media.height,
          duration: media.duration,
          type: media.type,
        },
      };

      const story = new Story(storyData);
      await story.save();

      // Get author information
      const author = await User.findOne(
        { studentId: req.user.studentId },
        {
          studentId: 1,
          displayName: 1,
          photoUrl: 1,
          year: 1,
          department: 1,
          section: 1,
        }
      ).lean();

      const enrichedStory = {
        ...story.toJSON(),
        author,
      };

      res.status(201).json({
        message: "Story created successfully",
        story: enrichedStory,
      });
    } catch (error) {
      console.error("Error creating story:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Story validation failed",
            details: Object.values(error.errors).map((err) => ({
              field: err.path,
              message: err.message,
            })),
          },
        });
      }

      res.status(500).json({
        error: {
          code: "CREATE_STORY_ERROR",
          message: "Failed to create story",
        },
      });
    }
  }
);

/**
 * GET /stories - Get stories feed with filtering by year/department
 */
router.get(
  "/",
  [
    query("cursor")
      .optional()
      .isISO8601()
      .withMessage("Cursor must be a valid ISO date"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
    query("year")
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage("Year must be between 1 and 4"),
    query("department")
      .optional()
      .isIn(["CS", "ECE", "ME", "CE", "EE", "IT", "BT", "CH", "PH", "MA"])
      .withMessage("Department must be a valid department code"),
    query("section")
      .optional()
      .matches(/^[A-Z]$/)
      .withMessage("Section must be a single uppercase letter"),
    query("authorStudentId")
      .optional()
      .matches(/^\d{4}[A-Z]{2,4}\d{3,4}$/)
      .withMessage("Author student ID must follow format: YYYY[DEPT][NUMBER]"),
  ],
  handleValidationErrors,
  authenticateToken, // Stories require authentication to view
  async (req, res) => {
    try {
      const {
        cursor,
        limit = 20,
        year,
        department,
        section,
        authorStudentId,
      } = req.query;

      // Build query options
      const options = {
        cursor,
        limit: parseInt(limit),
      };

      if (authorStudentId) {
        options.authorStudentIds = [authorStudentId];
      }

      // Get stories using the model's static method
      let stories = await Story.getStoriesFeed(options);

      // Filter stories based on year/department if specified
      if (year || department || section) {
        // Get users matching the filter criteria
        const userFilter = {};
        if (year) userFilter.year = parseInt(year);
        if (department) userFilter.department = department.toUpperCase();
        if (section) userFilter.section = section.toUpperCase();

        const filteredUsers = await User.find(userFilter, {
          studentId: 1,
        }).lean();
        const filteredStudentIds = filteredUsers.map((user) => user.studentId);

        // Filter stories by matching authors
        stories = stories.filter((story) =>
          filteredStudentIds.includes(story.authorStudentId)
        );
      }

      // Filter stories based on visibility and user context
      const filteredStories = [];
      for (const story of stories) {
        const canView = await canUserViewStory(story, req.user);
        if (canView) {
          filteredStories.push(story);
        }
      }
      stories = filteredStories;

      // Get author information for each story
      const authorIds = [
        ...new Set(stories.map((story) => story.authorStudentId)),
      ];
      const authors = await User.find(
        { studentId: { $in: authorIds } },
        {
          studentId: 1,
          displayName: 1,
          photoUrl: 1,
          year: 1,
          department: 1,
          section: 1,
        }
      ).lean();

      const authorMap = authors.reduce((map, author) => {
        map[author.studentId] = author;
        return map;
      }, {});

      // Enrich stories with author information
      const enrichedStories = stories.map((story) => ({
        ...story.toJSON(),
        author: authorMap[story.authorStudentId] || null,
      }));

      // Determine next cursor
      const nextCursor =
        stories.length === parseInt(limit) && stories.length > 0
          ? stories[stories.length - 1].createdAt.toISOString()
          : null;

      res.json({
        stories: enrichedStories,
        pagination: {
          nextCursor,
          hasMore: nextCursor !== null,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Error fetching stories:", error);
      res.status(500).json({
        error: {
          code: "FETCH_STORIES_ERROR",
          message: "Failed to fetch stories",
        },
      });
    }
  }
);

/**
 * GET /stories/:id - Get a specific story by ID
 */
router.get(
  "/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("Story ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const story = await Story.findOne({
        _id: id,
        isActive: true,
        expiresAt: { $gt: new Date() }, // Only non-expired stories
      });

      if (!story) {
        return res.status(404).json({
          error: {
            code: "STORY_NOT_FOUND",
            message: "Story not found or has expired",
          },
        });
      }

      // Check if user can view this story
      const canView = await canUserViewStory(story, req.user);
      if (!canView) {
        return res.status(403).json({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "You don't have permission to view this story",
          },
        });
      }

      // Add view if not already viewed by this user
      const hasBeenViewed = story.viewedBy.some(
        (view) => view.studentId === req.user.studentId
      );
      if (!hasBeenViewed) {
        await story.addView(req.user.studentId);
      }

      // Get author information
      const author = await User.findOne(
        { studentId: story.authorStudentId },
        {
          studentId: 1,
          displayName: 1,
          photoUrl: 1,
          year: 1,
          department: 1,
          section: 1,
        }
      ).lean();

      const enrichedStory = {
        ...story.toJSON(),
        author,
      };

      res.json({ story: enrichedStory });
    } catch (error) {
      console.error("Error fetching story:", error);
      res.status(500).json({
        error: {
          code: "FETCH_STORY_ERROR",
          message: "Failed to fetch story",
        },
      });
    }
  }
);

/**
 * POST /stories/:id/view - Mark a story as viewed
 */
router.post(
  "/:id/view",
  authenticateToken,
  [
    param("id")
      .isMongoId()
      .withMessage("Story ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      const story = await Story.findOne({
        _id: id,
        isActive: true,
        expiresAt: { $gt: new Date() }, // Only non-expired stories
      });

      if (!story) {
        return res.status(404).json({
          error: {
            code: "STORY_NOT_FOUND",
            message: "Story not found or has expired",
          },
        });
      }

      // Check if user can view this story
      const canView = await canUserViewStory(story, req.user);
      if (!canView) {
        return res.status(403).json({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "You don't have permission to view this story",
          },
        });
      }

      // Add view
      await story.addView(req.user.studentId);

      res.json({
        message: "Story view recorded successfully",
        viewsCount: story.viewsCount,
      });
    } catch (error) {
      console.error("Error recording story view:", error);
      res.status(500).json({
        error: {
          code: "RECORD_VIEW_ERROR",
          message: "Failed to record story view",
        },
      });
    }
  }
);

/**
 * GET /stories/cleanup/expired - Manual cleanup of expired stories (admin endpoint)
 */
router.get("/cleanup/expired", authenticateToken, async (req, res) => {
  try {
    // This is primarily for verification - TTL index should handle automatic cleanup
    const result = await Story.cleanupExpiredStories();

    res.json({
      message: "Expired stories cleanup completed",
      deletedCount: result.deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error during expired stories cleanup:", error);
    res.status(500).json({
      error: {
        code: "CLEANUP_ERROR",
        message: "Failed to cleanup expired stories",
      },
    });
  }
});

module.exports = router;
