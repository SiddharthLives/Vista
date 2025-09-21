const { validationResult } = require("express-validator");
const DOMPurify = require("isomorphic-dompurify");

/**
 * Input validation and sanitization middleware
 * Based on requirements 10.1, 10.2, 10.3, 10.6 for security
 */

/**
 * Handle validation errors from express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors for security monitoring
    console.warn("Validation error:", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      path: req.path,
      method: req.method,
      errors: errors.array(),
      timestamp: new Date().toISOString(),
    });

    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          // Don't expose the actual invalid value for security
          value: error.value ? "[REDACTED]" : undefined,
        })),
      },
    });
  }
  next();
};

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized HTML content
 */
const sanitizeHtml = (html) => {
  if (typeof html !== "string") return html;

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
};

/**
 * Sanitize text content to prevent injection attacks
 * @param {string} text - Text content to sanitize
 * @returns {string} - Sanitized text content
 */
const sanitizeText = (text) => {
  if (typeof text !== "string") return text;

  // Remove null bytes and control characters except newlines and tabs
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
};

/**
 * Middleware to sanitize request body
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Recursively sanitize object properties
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
const sanitizeObject = (obj) => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeText(key);

    if (typeof value === "string") {
      // Sanitize based on field name
      if (
        key.toLowerCase().includes("html") ||
        key.toLowerCase().includes("content")
      ) {
        sanitized[sanitizedKey] = sanitizeHtml(value);
      } else {
        sanitized[sanitizedKey] = sanitizeText(value);
      }
    } else if (typeof value === "object") {
      sanitized[sanitizedKey] = sanitizeObject(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
};

/**
 * Validate student ID format
 * @param {string} studentId - Student ID to validate
 * @returns {boolean} - True if valid format
 */
const isValidStudentId = (studentId) => {
  if (typeof studentId !== "string") return false;
  return /^[0-9]{4}[A-Z]{2,4}[0-9]{3,4}$/.test(studentId);
};

/**
 * Validate email format and domain
 * @param {string} email - Email to validate
 * @param {string} requiredDomain - Required domain (optional)
 * @returns {boolean} - True if valid
 */
const isValidEmail = (email, requiredDomain = null) => {
  if (typeof email !== "string") return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;

  if (requiredDomain) {
    return email.toLowerCase().endsWith(`@${requiredDomain.toLowerCase()}`);
  }

  return true;
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId format
 */
const isValidObjectId = (id) => {
  if (typeof id !== "string") return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @param {Array} allowedProtocols - Allowed protocols (default: ['http', 'https'])
 * @returns {boolean} - True if valid URL
 */
const isValidUrl = (url, allowedProtocols = ["http", "https"]) => {
  if (typeof url !== "string") return false;

  try {
    const urlObj = new URL(url);
    return allowedProtocols.includes(urlObj.protocol.slice(0, -1));
  } catch {
    return false;
  }
};

/**
 * Validate file upload parameters
 * @param {Object} fileData - File data to validate
 * @returns {Object} - Validation result
 */
const validateFileUpload = (fileData) => {
  const errors = [];

  if (!fileData.filename || typeof fileData.filename !== "string") {
    errors.push("Filename is required and must be a string");
  } else if (fileData.filename.length > 255) {
    errors.push("Filename must be less than 255 characters");
  } else if (!/^[a-zA-Z0-9._-]+$/.test(fileData.filename)) {
    errors.push("Filename contains invalid characters");
  }

  if (!fileData.mimeType || typeof fileData.mimeType !== "string") {
    errors.push("MIME type is required");
  } else {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
    ];

    if (!allowedMimeTypes.includes(fileData.mimeType.toLowerCase())) {
      errors.push("Unsupported file type");
    }
  }

  if (fileData.size && typeof fileData.size === "number") {
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB
    if (fileData.size > maxSize) {
      errors.push(`File size exceeds maximum limit of ${maxSize} bytes`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate post content
 * @param {Object} postData - Post data to validate
 * @returns {Object} - Validation result
 */
const validatePostContent = (postData) => {
  const errors = [];

  if (postData.text && typeof postData.text === "string") {
    if (postData.text.length > 2000) {
      errors.push("Post text must be less than 2000 characters");
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(postData.text))) {
      errors.push("Post contains potentially malicious content");
    }
  }

  if (postData.tags && Array.isArray(postData.tags)) {
    if (postData.tags.length > 10) {
      errors.push("Maximum 10 tags allowed");
    }

    for (const tag of postData.tags) {
      if (typeof tag !== "string" || !/^[a-z0-9_-]+$/.test(tag)) {
        errors.push(
          "Tags must contain only lowercase letters, numbers, underscores, and hyphens"
        );
        break;
      }

      if (tag.length > 50) {
        errors.push("Each tag must be less than 50 characters");
        break;
      }
    }
  }

  if (
    postData.visibility &&
    !["public", "year", "dept", "section"].includes(postData.visibility)
  ) {
    errors.push("Invalid visibility setting");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Security headers middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const securityHeaders = (req, res, next) => {
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "media-src 'self' https:; " +
      "connect-src 'self' wss: https:; " +
      "font-src 'self' https:; " +
      "object-src 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self';"
  );

  // Additional security headers (complementing helmet)
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  // Remove server information
  res.removeHeader("X-Powered-By");

  next();
};

/**
 * Request logging middleware for security monitoring
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const securityLogger = (req, res, next) => {
  // Log suspicious requests
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code injection
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  const isSuspicious = suspiciousPatterns.some(
    (pattern) =>
      pattern.test(req.url) ||
      pattern.test(requestData) ||
      pattern.test(req.get("User-Agent") || "")
  );

  if (isSuspicious) {
    console.warn("Suspicious request detected:", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      path: req.path,
      method: req.method,
      query: req.query,
      body: req.body ? "[REDACTED]" : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  // Log failed authentication attempts
  const originalSend = res.send;
  res.send = function (data) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      console.warn("Authentication/Authorization failure:", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Comprehensive error handler with secure error messages
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const secureErrorHandler = (err, req, res, next) => {
  // Log the full error for debugging
  console.error("Application error:", {
    error: err.message,
    stack: err.stack,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Determine error type and send appropriate response
  let statusCode = 500;
  let errorCode = "INTERNAL_SERVER_ERROR";
  let errorMessage = "An unexpected error occurred";

  if (err.name === "ValidationError") {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    errorMessage = "Request validation failed";
  } else if (err.name === "CastError") {
    statusCode = 400;
    errorCode = "INVALID_ID_FORMAT";
    errorMessage = "Invalid ID format";
  } else if (err.code === 11000) {
    statusCode = 409;
    errorCode = "DUPLICATE_ENTRY";
    errorMessage = "Resource already exists";
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    errorCode = "UNAUTHORIZED";
    errorMessage = "Authentication required";
  } else if (err.name === "ForbiddenError") {
    statusCode = 403;
    errorCode = "FORBIDDEN";
    errorMessage = "Access denied";
  } else if (err.statusCode && err.statusCode < 500) {
    statusCode = err.statusCode;
    errorCode = err.code || "CLIENT_ERROR";
    errorMessage = err.message || "Client error";
  }

  // Don't expose internal errors in production
  const response = {
    error: {
      code: errorCode,
      message: errorMessage,
    },
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === "development") {
    response.error.stack = err.stack;
    response.error.details = err.details;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  handleValidationErrors,
  sanitizeInput,
  sanitizeHtml,
  sanitizeText,
  sanitizeObject,
  isValidStudentId,
  isValidEmail,
  isValidObjectId,
  isValidUrl,
  validateFileUpload,
  validatePostContent,
  securityHeaders,
  securityLogger,
  secureErrorHandler,
};
