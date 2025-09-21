const Topic = require("../models/Topic");
const Comment = require("../models/Comment");
const User = require("../models/User");

/**
 * Helper function to get author information for topics
 */
const getAuthorsInfo = async (authorIds) => {
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

  return authors.reduce((map, author) => {
    map[author.studentId] = author;
    return map;
  }, {});
};

/**
 * Get topics with filtering and pagination
 */
const getTopics = async (req, res) => {
  try {
    const {
      cursor,
      limit = 20,
      sortBy = "recent",
      tags,
      authorStudentId,
      search,
    } = req.query;

    const options = {
      cursor,
      limit: parseInt(limit),
      sortBy,
    };

    if (authorStudentId) {
      options.authorStudentId = authorStudentId;
    }

    if (tags) {
      options.tags =
        typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags;
    }

    let topics;

    if (search) {
      // Text search
      topics = await Topic.searchTopics(search, options);
    } else {
      // Regular feed
      topics = await Topic.getTopicsFeed(options);
    }

    // Get author information for each topic
    const authorIds = [
      ...new Set(topics.map((topic) => topic.authorStudentId)),
    ];
    const authorMap = await getAuthorsInfo(authorIds);

    // Enrich topics with author information
    const enrichedTopics = topics.map((topic) => ({
      ...topic.toJSON(),
      author: authorMap[topic.authorStudentId] || null,
    }));

    // Determine next cursor
    const nextCursor =
      topics.length === parseInt(limit) && topics.length > 0
        ? sortBy === "popular" || sortBy === "engagement"
          ? topics[topics.length - 1]._id.toString()
          : topics[topics.length - 1].createdAt.toISOString()
        : null;

    res.json({
      topics: enrichedTopics,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({
      error: {
        code: "FETCH_TOPICS_ERROR",
        message: "Failed to fetch topics",
      },
    });
  }
};

/**
 * Create a new topic
 */
const createTopic = async (req, res) => {
  try {
    const { title, body, tags } = req.body;

    const topicData = {
      title,
      body,
      authorStudentId: req.user.studentId,
      tags: tags || [],
    };

    const topic = new Topic(topicData);
    await topic.save();

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

    const enrichedTopic = {
      ...topic.toJSON(),
      author,
    };

    res.status(201).json({
      message: "Topic created successfully",
      topic: enrichedTopic,
    });
  } catch (error) {
    console.error("Error creating topic:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Topic validation failed",
          details: Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
        },
      });
    }

    res.status(500).json({
      error: {
        code: "CREATE_TOPIC_ERROR",
        message: "Failed to create topic",
      },
    });
  }
};

/**
 * Get a specific topic by ID
 */
const getTopicById = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await Topic.findOne({ _id: id, isActive: true });

    if (!topic) {
      return res.status(404).json({
        error: {
          code: "TOPIC_NOT_FOUND",
          message: "Topic not found",
        },
      });
    }

    // Get author information
    const author = await User.findOne(
      { studentId: topic.authorStudentId },
      {
        studentId: 1,
        displayName: 1,
        photoUrl: 1,
        year: 1,
        department: 1,
        section: 1,
      }
    ).lean();

    const enrichedTopic = {
      ...topic.toJSON(),
      author,
    };

    res.json({ topic: enrichedTopic });
  } catch (error) {
    console.error("Error fetching topic:", error);
    res.status(500).json({
      error: {
        code: "FETCH_TOPIC_ERROR",
        message: "Failed to fetch topic",
      },
    });
  }
};

/**
 * Vote on a topic (upvote/downvote)
 */
const voteTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body; // 'up', 'down', 'remove_up', 'remove_down'

    const topic = await Topic.findOne({ _id: id, isActive: true });

    if (!topic) {
      return res.status(404).json({
        error: {
          code: "TOPIC_NOT_FOUND",
          message: "Topic not found",
        },
      });
    }

    // Apply vote based on type
    switch (voteType) {
      case "up":
        await topic.upvote();
        break;
      case "down":
        await topic.downvote();
        break;
      case "remove_up":
        await topic.removeUpvote();
        break;
      case "remove_down":
        await topic.removeDownvote();
        break;
      default:
        return res.status(400).json({
          error: {
            code: "INVALID_VOTE_TYPE",
            message:
              "Vote type must be one of: up, down, remove_up, remove_down",
          },
        });
    }

    res.json({
      message: "Vote recorded successfully",
      votes: topic.votes,
      upvotes: topic.upvotes,
      downvotes: topic.downvotes,
    });
  } catch (error) {
    console.error("Error voting on topic:", error);
    res.status(500).json({
      error: {
        code: "VOTE_TOPIC_ERROR",
        message: "Failed to vote on topic",
      },
    });
  }
};

/**
 * Add a comment to a topic
 */
const commentOnTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, parentCommentId } = req.body;

    const topic = await Topic.findOne({ _id: id, isActive: true });

    if (!topic) {
      return res.status(404).json({
        error: {
          code: "TOPIC_NOT_FOUND",
          message: "Topic not found",
        },
      });
    }

    // If replying to a comment, verify it exists and belongs to this topic
    if (parentCommentId) {
      const parentComment = await Comment.findOne({
        _id: parentCommentId,
        parentType: "Topic",
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
      parentType: "Topic",
      parentId: id,
      parentCommentId: parentCommentId || null,
    };

    const comment = new Comment(commentData);
    await comment.save();

    // Increment topic comment count
    await topic.incrementComments();

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
      topic: {
        id: topic._id,
        commentsCount: topic.commentsCount,
      },
    });
  } catch (error) {
    console.error("Error adding comment to topic:", error);

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
};

/**
 * Get comments for a topic
 */
const getTopicComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, sortBy = "newest", parentCommentId } = req.query;

    const topic = await Topic.findOne({ _id: id, isActive: true });

    if (!topic) {
      return res.status(404).json({
        error: {
          code: "TOPIC_NOT_FOUND",
          message: "Topic not found",
        },
      });
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
      comments = await Comment.findTopLevel("Topic", id, options);
    }

    // Get author information for comments
    const authorIds = [
      ...new Set(comments.map((comment) => comment.authorStudentId)),
    ];
    const authorMap = await getAuthorsInfo(authorIds);

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
    console.error("Error fetching topic comments:", error);
    res.status(500).json({
      error: {
        code: "FETCH_COMMENTS_ERROR",
        message: "Failed to fetch comments",
      },
    });
  }
};

module.exports = {
  getTopics,
  createTopic,
  getTopicById,
  voteTopic,
  commentOnTopic,
  getTopicComments,
};
