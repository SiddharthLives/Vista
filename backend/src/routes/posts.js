const express = require("express");
const { body, query, param, validationResult } = require("express-validator");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const {
  authenticateToken,
  optionalAuth,
} = require("../middleware/authMiddleware");
const {
  contentCreationRateLimit,
  interactionRateLimit,
  searchRateLimit,
} = require("../middleware/rateLimitMiddleware");

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
 * Helper function to check if a user can view a post
 */
const canUserViewPost = async (post, user) => {
  if (post.visibility === "public") {
    return true;
  }

  if (!user) {
    return false;
  }

  // Get author details
  const author = await User.findOne({ studentId: post.authorStudentId }).lean();
  if (!author) {
    return false;
  }

  // Get viewer details
  const viewer = await User.findOne({ studentId: user.studentId }).lean();
  if (!viewer) {
    return false;
  }

  return post.canBeViewedBy(
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
 * GET /posts - Get posts feed with cursor-based pagination and filtering
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
    query("visibility")
      .optional()
      .isIn(["public", "year", "dept", "section", "all"])
      .withMessage(
        "Visibility must be one of: public, year, dept, section, all"
      ),
    query("authorStudentId")
      .optional()
      .matches(/^\d{4}[A-Z]{2,4}\d{3,4}$/)
      .withMessage("Author student ID must follow format: YYYY[DEPT][NUMBER]"),
    query("tags")
      .optional()
      .custom((value) => {
        if (typeof value === "string") {
          return value
            .split(",")
            .every((tag) => /^[a-z0-9_-]+$/.test(tag.trim()));
        }
        return (
          Array.isArray(value) &&
          value.every((tag) => /^[a-z0-9_-]+$/.test(tag))
        );
      })
      .withMessage(
        "Tags must contain only lowercase letters, numbers, underscores, and hyphens"
      ),
    query("search")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Search query must be between 1 and 100 characters"),
  ],
  handleValidationErrors,
  optionalAuth,
  async (req, res) => {
    try {
      const {
        cursor,
        limit = 20,
        visibility = "public",
        authorStudentId,
        tags,
        search,
      } = req.query;

      // Build query options
      const options = {
        cursor,
        limit: parseInt(limit),
        visibility: req.user ? "all" : "public", // Get all posts if authenticated, only public if not
      };

      if (authorStudentId) {
        options.authorStudentId = authorStudentId;
      }

      if (tags) {
        options.tags =
          typeof tags === "string"
            ? tags.split(",").map((t) => t.trim())
            : tags;
      }

      let posts;

      if (search) {
        // Text search
        posts = await Post.searchPosts(search, options);
      } else {
        // Regular feed
        posts = await Post.getFeed(options);
      }

      // Filter posts based on visibility and user context
      const filteredPosts = [];
      for (const post of posts) {
        if (visibility === "all" && req.user) {
          const canView = await canUserViewPost(post, req.user);
          if (canView) {
            filteredPosts.push(post);
          }
        } else if (await canUserViewPost(post, req.user)) {
          filteredPosts.push(post);
        }
      }
      posts = filteredPosts;

      // Get author information for each post
      const authorIds = [...new Set(posts.map((post) => post.authorStudentId))];
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

      // Enrich posts with author information
      const enrichedPosts = posts.map((post) => ({
        ...post.toJSON(),
        author: authorMap[post.authorStudentId] || null,
      }));

      // Determine next cursor
      const nextCursor =
        posts.length === parseInt(limit) && posts.length > 0
          ? posts[posts.length - 1].createdAt.toISOString()
          : null;

      res.json({
        posts: enrichedPosts,
        pagination: {
          nextCursor,
          hasMore: nextCursor !== null,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({
        error: {
          code: "FETCH_POSTS_ERROR",
          message: "Failed to fetch posts",
        },
      });
    }
  }
);

/**
 * POST /posts - Create a new post
 */
router.post(
  "/",
  authenticateToken,
  [
    body("type")
      .isIn(["image", "video", "text"])
      .withMessage("Post type must be one of: image, video, text"),
    body("text")
      .optional()
      .isLength({ max: 2000 })
      .withMessage("Post text cannot exceed 2000 characters"),
    body("media").optional().isArray().withMessage("Media must be an array"),
    body("media.*.url")
      .if(body("media").exists())
      .isURL()
      .withMessage("Media URL must be valid"),
    body("media.*.cloudinaryPublicId")
      .if(body("media").exists())
      .matches(
        /^college\/\d{1,4}-[A-Z]{2,4}\/dept-[A-Z]{2,4}\/section-[A-Z]\/student-\d{4}[A-Z]{2,4}\d{3,4}\//
      )
      .withMessage("Cloudinary public ID must follow college folder structure"),
    body("media.*.width")
      .if(body("media").exists())
      .optional()
      .isInt({ min: 1 })
      .withMessage("Media width must be a positive integer"),
    body("media.*.height")
      .if(body("media").exists())
      .optional()
      .isInt({ min: 1 })
      .withMessage("Media height must be a positive integer"),
    body("visibility")
      .optional()
      .isIn(["public", "year", "dept", "section"])
      .withMessage("Visibility must be one of: public, year, dept, section"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("tags.*")
      .if(body("tags").exists())
      .matches(/^[a-z0-9_-]+$/)
      .withMessage(
        "Tags can only contain lowercase letters, numbers, underscores, and hyphens"
      ),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { type, text, media, visibility = "public", tags } = req.body;

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
      if (media && media.length > 0) {
        const userFolder = `college/${userDetails.year}-${userDetails.department}/dept-${userDetails.department}/section-${userDetails.section}/student-${userDetails.studentId}/`;

        for (const mediaItem of media) {
          if (!mediaItem.cloudinaryPublicId.startsWith(userFolder)) {
            return res.status(403).json({
              error: {
                code: "INVALID_MEDIA_OWNERSHIP",
                message: "Media does not belong to the authenticated user",
                details: {
                  expected: userFolder,
                  received: mediaItem.cloudinaryPublicId,
                },
              },
            });
          }
        }
      }

      // Create post
      const postData = {
        authorStudentId: req.user.studentId,
        type,
        text: text || "",
        media: media || [],
        visibility,
        tags: tags || [],
      };

      const post = new Post(postData);
      await post.save();

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

      const enrichedPost = {
        ...post.toJSON(),
        author,
      };

      res.status(201).json({
        message: "Post created successfully",
        post: enrichedPost,
      });
    } catch (error) {
      console.error("Error creating post:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Post validation failed",
            details: Object.values(error.errors).map((err) => ({
              field: err.path,
              message: err.message,
            })),
          },
        });
      }

      // Handle custom validation errors from pre-save middleware
      if (
        error.message &&
        (error.message.includes("posts must have at least one media item") ||
          error.message.includes("posts must have text content"))
      ) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
          },
        });
      }

      res.status(500).json({
        error: {
          code: "CREATE_POST_ERROR",
          message: "Failed to create post",
        },
      });
    }
  }
);

/**
 * GET /posts/:id - Get a specific post by ID
 */
router.get(
  "/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("Post ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  optionalAuth,
  async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findOne({ _id: id, isActive: true });

      if (!post) {
        return res.status(404).json({
          error: {
            code: "POST_NOT_FOUND",
            message: "Post not found",
          },
        });
      }

      // Check if user can view this post
      const canView = await canUserViewPost(post, req.user);
      if (!canView) {
        if (!req.user) {
          return res.status(403).json({
            error: {
              code: "AUTHENTICATION_REQUIRED",
              message: "Authentication required to view this post",
            },
          });
        } else {
          return res.status(403).json({
            error: {
              code: "INSUFFICIENT_PERMISSIONS",
              message: "You don't have permission to view this post",
            },
          });
        }
      }

      // Get author information
      const author = await User.findOne(
        { studentId: post.authorStudentId },
        {
          studentId: 1,
          displayName: 1,
          photoUrl: 1,
          year: 1,
          department: 1,
          section: 1,
        }
      ).lean();

      const enrichedPost = {
        ...post.toJSON(),
        author,
      };

      res.json({ post: enrichedPost });
    } catch (error) {
      console.error("Error fetching post:", error);
      res.status(500).json({
        error: {
          code: "FETCH_POST_ERROR",
          message: "Failed to fetch post",
        },
      });
    }
  }
);

/**
 * POST /posts/:id/like - Like or unlike a post
 */
router.post(
  "/:id/like",
  authenticateToken,
  [
    param("id")
      .isMongoId()
      .withMessage("Post ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findOne({ _id: id, isActive: true });

      if (!post) {
        return res.status(404).json({
          error: {
            code: "POST_NOT_FOUND",
            message: "Post not found",
          },
        });
      }

      // Check if user can view this post
      const canView = await canUserViewPost(post, req.user);
      if (!canView) {
        return res.status(403).json({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "You don't have permission to interact with this post",
          },
        });
      }

      // For now, we'll just increment/decrement likes
      // In a full implementation, you'd track individual likes in a separate collection
      await post.incrementLikes();

      res.json({
        message: "Post liked successfully",
        likesCount: post.likesCount,
      });
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({
        error: {
          code: "LIKE_POST_ERROR",
          message: "Failed to like post",
        },
      });
    }
  }
);

/**
 * POST /posts/:id/comment - Add a comment to a post
 */
router.post(
  "/:id/comment",
  authenticateToken,
  [
    param("id")
      .isMongoId()
      .withMessage("Post ID must be a valid MongoDB ObjectId"),
    body("content")
      .isLength({ min: 1, max: 1000 })
      .withMessage("Comment content must be between 1 and 1000 characters"),
    body("parentCommentId")
      .optional()
      .isMongoId()
      .withMessage("Parent comment ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content, parentCommentId } = req.body;

      const post = await Post.findOne({ _id: id, isActive: true });

      if (!post) {
        return res.status(404).json({
          error: {
            code: "POST_NOT_FOUND",
            message: "Post not found",
          },
        });
      }

      // Check if user can view this post
      const canView = await canUserViewPost(post, req.user);
      if (!canView) {
        return res.status(403).json({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "You don't have permission to comment on this post",
          },
        });
      }

      // If replying to a comment, verify it exists and belongs to this post
      if (parentCommentId) {
        const parentComment = await Comment.findOne({
          _id: parentCommentId,
          parentType: "Post",
          parentId: id,
          isActive: true,
        });

        if (!parentComment) {
          return res.status(404).json({
            error: {
              code: "PARENT_COMMENT_NOT_FOUND",
              message: "Parent comment not found",
            },
          });
        }
      }

      // Create comment
      const commentData = {
        authorStudentId: req.user.studentId,
        content,
        parentType: "Post",
        parentId: id,
        parentCommentId: parentCommentId || null,
      };

      const comment = new Comment(commentData);
      await comment.save();

      // Increment post comment count
      await post.incrementComments();

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

      const enrichedComment = {
        ...comment.toJSON(),
        author,
      };

      res.status(201).json({
        message: "Comment added successfully",
        comment: enrichedComment,
        post: {
          id: post._id,
          commentsCount: post.commentsCount,
        },
      });
    } catch (error) {
      console.error("Error adding comment:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Comment validation failed",
            details: Object.values(error.errors).map((err) => ({
              field: err.path,
              message: err.message,
            })),
          },
        });
      }

      res.status(500).json({
        error: {
          code: "ADD_COMMENT_ERROR",
          message: "Failed to add comment",
        },
      });
    }
  }
);

/**
 * GET /posts/:id/comments - Get comments for a post
 */
router.get(
  "/:id/comments",
  [
    param("id")
      .isMongoId()
      .withMessage("Post ID must be a valid MongoDB ObjectId"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("sortBy")
      .optional()
      .isIn(["newest", "oldest", "popular"])
      .withMessage("Sort by must be one of: newest, oldest, popular"),
    query("parentCommentId")
      .optional()
      .isMongoId()
      .withMessage("Parent comment ID must be a valid MongoDB ObjectId"),
  ],
  handleValidationErrors,
  optionalAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 50, sortBy = "newest", parentCommentId } = req.query;

      const post = await Post.findOne({ _id: id, isActive: true });

      if (!post) {
        return res.status(404).json({
          error: {
            code: "POST_NOT_FOUND",
            message: "Post not found",
          },
        });
      }

      // Check if user can view this post
      const canView = await canUserViewPost(post, req.user);
      if (!canView) {
        if (!req.user) {
          return res.status(403).json({
            error: {
              code: "AUTHENTICATION_REQUIRED",
              message: "Authentication required to view comments on this post",
            },
          });
        } else {
          return res.status(403).json({
            error: {
              code: "INSUFFICIENT_PERMISSIONS",
              message:
                "You don't have permission to view comments on this post",
            },
          });
        }
      }

      // Get comments
      const options = {
        limit: parseInt(limit),
        sortBy: sortBy === "popular" ? "popular" : undefined,
      };

      let comments;
      if (parentCommentId) {
        // Get replies to a specific comment
        const parentComment = await Comment.findById(parentCommentId);
        if (parentComment) {
          comments = await parentComment.getReplies(options);
        } else {
          comments = [];
        }
      } else {
        // Get top-level comments
        comments = await Comment.findTopLevel("Post", id, options);
      }

      // Get author information for comments
      const authorIds = [
        ...new Set(comments.map((comment) => comment.authorStudentId)),
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

      // Enrich comments with author information
      const enrichedComments = comments.map((comment) => ({
        ...comment.toJSON(),
        author: authorMap[comment.authorStudentId] || null,
      }));

      res.json({
        comments: enrichedComments,
        pagination: {
          total: enrichedComments.length,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({
        error: {
          code: "FETCH_COMMENTS_ERROR",
          message: "Failed to fetch comments",
        },
      });
    }
  }
);

module.exports = router;
