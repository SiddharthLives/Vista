const User = require("../models/User");

/**
 * Get user profile by student ID
 */
const getUserProfile = async (req, res) => {
  try {
    const { studentId } = req.params;

    const user = await User.findByStudentId(studentId);

    if (!user) {
      return res.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      });
    }

    // Check if the requesting user can view this profile
    // For now, allow all college students to view basic profiles
    // In a full implementation, you might have more granular privacy controls
    const canView = user.canViewProfile(req.user);
    if (!canView && req.user) {
      return res.status(403).json({
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: "You don't have permission to view this profile",
        },
      });
    }

    // Return user profile (sensitive fields are already filtered by toJSON transform)
    res.json({
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      error: {
        code: "FETCH_USER_ERROR",
        message: "Failed to fetch user profile",
      },
    });
  }
};

/**
 * Update user profile (owner only)
 */
const updateUserProfile = async (req, res) => {
  try {
    const { studentId } = req.params;
    const updates = req.body;

    const user = await User.findByStudentId(studentId);

    if (!user) {
      return res.status(404).json({
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      });
    }

    // Check if user is updating their own profile
    if (req.user.studentId !== studentId) {
      return res.status(403).json({
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: "You can only update your own profile",
        },
      });
    }

    // Only allow updating specific fields
    const allowedUpdates = ["displayName", "photoUrl", "bio", "settings"];
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    // Handle nested settings updates
    if (updates.settings) {
      filteredUpdates.settings = {
        ...user.settings.toObject(),
        ...updates.settings,
      };

      // Handle nested privacy settings
      if (updates.settings.privacy) {
        filteredUpdates.settings.privacy = {
          ...user.settings.privacy.toObject(),
          ...updates.settings.privacy,
        };
      }
    }

    // Apply updates
    Object.assign(user, filteredUpdates);
    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    console.error("Error updating user profile:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Profile validation failed",
          details: Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
        },
      });
    }

    res.status(500).json({
      error: {
        code: "UPDATE_USER_ERROR",
        message: "Failed to update user profile",
      },
    });
  }
};

/**
 * Get users with filtering by year/department/section
 */
const getUsers = async (req, res) => {
  try {
    const {
      year,
      department,
      section,
      search,
      limit = 20,
      page = 1,
    } = req.query;

    let users;
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    };

    // Build filter object
    const filters = { isActive: true };

    if (year) {
      filters.year = parseInt(year);
    }

    if (department) {
      filters.department = department.toUpperCase();
    }

    if (section) {
      filters.section = section.toUpperCase();
    }

    if (search) {
      // Use text search
      users = await User.searchUsers(search, filters)
        .limit(options.limit)
        .skip(options.skip)
        .lean();
    } else {
      // Regular filtering
      users = await User.find(filters, {
        studentId: 1,
        displayName: 1,
        photoUrl: 1,
        year: 1,
        department: 1,
        section: 1,
        bio: 1,
        createdAt: 1,
      })
        .sort({ createdAt: -1 })
        .limit(options.limit)
        .skip(options.skip)
        .lean();
    }

    // Get total count for pagination
    const totalCount = await User.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasMore: parseInt(page) < totalPages,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      error: {
        code: "FETCH_USERS_ERROR",
        message: "Failed to fetch users",
      },
    });
  }
};

/**
 * Search users with advanced filtering
 */
const searchUsers = async (req, res) => {
  try {
    const { q, year, department, section, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_SEARCH_QUERY",
          message: "Search query is required",
        },
      });
    }

    // Build filter object
    const filters = { isActive: true };

    if (year) {
      filters.year = parseInt(year);
    }

    if (department) {
      filters.department = department.toUpperCase();
    }

    if (section) {
      filters.section = section.toUpperCase();
    }

    // Perform text search
    const users = await User.searchUsers(q.trim(), filters)
      .limit(parseInt(limit))
      .select({
        studentId: 1,
        displayName: 1,
        photoUrl: 1,
        year: 1,
        department: 1,
        section: 1,
        bio: 1,
        score: { $meta: "textScore" },
      })
      .lean();

    res.json({
      users,
      query: q.trim(),
      filters: {
        year: year ? parseInt(year) : null,
        department: department ? department.toUpperCase() : null,
        section: section ? section.toUpperCase() : null,
      },
      count: users.length,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({
      error: {
        code: "SEARCH_USERS_ERROR",
        message: "Failed to search users",
      },
    });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUsers,
  searchUsers,
};
