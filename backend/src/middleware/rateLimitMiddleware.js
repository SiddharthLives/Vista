const rateLimit = require("express-rate-limit");

/**
 * Rate limiting configurations for different endpoint types
 * Based on requirement 10.3 for preventing abuse
 */

// General API rate limit - applies to most endpoints
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this IP, please try again later",
      retryAfter: "15 minutes",
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use IP address and user ID if available for more granular limiting
    return req.user?.studentId ? `${req.ip}-${req.user.studentId}` : req.ip;
  },
});

// Strict rate limit for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth attempts per windowMs
  message: {
    error: {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again later",
      retryAfter: "15 minutes",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Media upload rate limit - more restrictive due to resource usage
const mediaUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 media uploads per hour
  message: {
    error: {
      code: "MEDIA_UPLOAD_RATE_LIMIT_EXCEEDED",
      message: "Too many media uploads, please try again later",
      retryAfter: "1 hour",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for media uploads to prevent abuse
    return req.user?.studentId || req.ip;
  },
});

// Content creation rate limit (posts, stories, topics)
const contentCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each user to 30 content creations per hour
  message: {
    error: {
      code: "CONTENT_CREATION_RATE_LIMIT_EXCEEDED",
      message: "Too many posts created, please try again later",
      retryAfter: "1 hour",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.studentId || req.ip;
  },
});

// Interaction rate limit (likes, comments, votes)
const interactionRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit each user to 100 interactions per 5 minutes
  message: {
    error: {
      code: "INTERACTION_RATE_LIMIT_EXCEEDED",
      message: "Too many interactions, please slow down",
      retryAfter: "5 minutes",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.studentId || req.ip;
  },
});

// Admin endpoints rate limit - more permissive for admin operations
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for admin operations
  message: {
    error: {
      code: "ADMIN_RATE_LIMIT_EXCEEDED",
      message: "Too many admin requests, please try again later",
      retryAfter: "15 minutes",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.studentId || req.ip;
  },
});

// Chat/messaging rate limit
const messagingRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each user to 30 messages per minute
  message: {
    error: {
      code: "MESSAGING_RATE_LIMIT_EXCEEDED",
      message: "Too many messages sent, please slow down",
      retryAfter: "1 minute",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.studentId || req.ip;
  },
});

// Search rate limit - prevent search abuse
const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each user to 20 searches per minute
  message: {
    error: {
      code: "SEARCH_RATE_LIMIT_EXCEEDED",
      message: "Too many search requests, please slow down",
      retryAfter: "1 minute",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.studentId || req.ip;
  },
});

/**
 * Socket.IO rate limiting store
 * Tracks rate limits for real-time events
 */
class SocketRateLimitStore {
  constructor() {
    this.store = new Map();
    this.cleanup();
  }

  // Clean up expired entries every 5 minutes
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.store.entries()) {
        if (now > data.resetTime) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  // Check if user has exceeded rate limit
  checkLimit(userId, eventType, limit, windowMs) {
    const key = `${userId}-${eventType}`;
    const now = Date.now();
    const data = this.store.get(key);

    if (!data || now > data.resetTime) {
      // First request or window expired
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { allowed: true, remaining: limit - 1 };
    }

    if (data.count >= limit) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: data.resetTime,
      };
    }

    // Increment count
    data.count++;
    this.store.set(key, data);

    return {
      allowed: true,
      remaining: limit - data.count,
    };
  }
}

// Create global socket rate limit store
const socketRateLimitStore = new SocketRateLimitStore();

/**
 * Socket.IO rate limiting configurations
 */
const socketRateLimits = {
  // Message sending rate limit
  sendMessage: {
    limit: 30, // 30 messages per minute
    windowMs: 60 * 1000,
  },
  // Typing indicator rate limit
  typing: {
    limit: 60, // 60 typing events per minute
    windowMs: 60 * 1000,
  },
  // Join/leave room rate limit
  roomActions: {
    limit: 20, // 20 room actions per minute
    windowMs: 60 * 1000,
  },
  // General socket events
  general: {
    limit: 100, // 100 events per minute
    windowMs: 60 * 1000,
  },
};

/**
 * Socket.IO rate limiting middleware
 * @param {string} eventType - Type of socket event
 * @returns {Function} Middleware function
 */
const createSocketRateLimit = (eventType = "general") => {
  return (socket, next) => {
    const userId = socket.user?.studentId || socket.handshake.address;
    const config = socketRateLimits[eventType] || socketRateLimits.general;

    const result = socketRateLimitStore.checkLimit(
      userId,
      eventType,
      config.limit,
      config.windowMs
    );

    if (!result.allowed) {
      const error = new Error("Rate limit exceeded");
      error.data = {
        code: "SOCKET_RATE_LIMIT_EXCEEDED",
        message: `Too many ${eventType} events, please slow down`,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      };
      return next(error);
    }

    // Add rate limit info to socket for debugging
    socket.rateLimit = {
      remaining: result.remaining,
      eventType,
    };

    next();
  };
};

module.exports = {
  generalRateLimit,
  authRateLimit,
  mediaUploadRateLimit,
  contentCreationRateLimit,
  interactionRateLimit,
  adminRateLimit,
  messagingRateLimit,
  searchRateLimit,
  createSocketRateLimit,
  socketRateLimits,
  socketRateLimitStore,
};
