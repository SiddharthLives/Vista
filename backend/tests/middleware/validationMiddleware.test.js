const request = require("supertest");
const express = require("express");
const {
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
} = require("../../src/middleware/validationMiddleware");
const { body, validationResult } = require("express-validator");

describe("Validation Middleware", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("handleValidationErrors", () => {
    beforeEach(() => {
      app.post(
        "/test",
        body("email").isEmail().withMessage("Invalid email"),
        body("name").notEmpty().withMessage("Name is required"),
        handleValidationErrors,
        (req, res) => {
          res.json({ message: "success" });
        }
      );
    });

    it("should pass through when no validation errors", async () => {
      const response = await request(app)
        .post("/test")
        .send({ email: "test@example.com", name: "John" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("success");
    });

    it("should return validation errors", async () => {
      const response = await request(app)
        .post("/test")
        .send({ email: "invalid-email", name: "" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.details).toHaveLength(2);
      expect(response.body.error.details[0].field).toBe("email");
      expect(response.body.error.details[1].field).toBe("name");
    });

    it("should redact sensitive values in error response", async () => {
      const response = await request(app)
        .post("/test")
        .send({ email: "sensitive@data.com", name: "" });

      expect(response.status).toBe(400);
      const emailError = response.body.error.details.find(
        (d) => d.field === "email"
      );
      expect(emailError.value).toBe("[REDACTED]");
    });
  });

  describe("sanitizeInput", () => {
    beforeEach(() => {
      app.use(sanitizeInput);
      app.post("/test", (req, res) => {
        res.json({ body: req.body, query: req.query });
      });
    });

    it("should sanitize malicious script tags", async () => {
      const response = await request(app)
        .post("/test?search=<script>alert('xss')</script>")
        .send({
          text: "<script>alert('xss')</script>Hello",
          html: "<p>Safe content</p><script>alert('xss')</script>",
        });

      expect(response.status).toBe(200);
      expect(response.body.body.text).not.toContain("<script>");
      expect(response.body.query.search).not.toContain("<script>");
    });

    it("should remove null bytes and control characters", async () => {
      const response = await request(app)
        .post("/test")
        .send({ text: "Hello\x00World\x01Test" });

      expect(response.status).toBe(200);
      expect(response.body.body.text).toBe("HelloWorldTest");
    });

    it("should preserve safe content", async () => {
      const response = await request(app)
        .post("/test")
        .send({ text: "Hello World!\nNew line\tTab" });

      expect(response.status).toBe(200);
      expect(response.body.body.text).toBe("Hello World!\nNew line\tTab");
    });

    it("should handle nested objects", async () => {
      const response = await request(app)
        .post("/test")
        .send({
          user: {
            name: "<script>alert('xss')</script>John",
            profile: {
              bio: "Safe bio content",
            },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.body.user.name).not.toContain("<script>");
      expect(response.body.body.user.profile.bio).toBe("Safe bio content");
    });

    it("should handle arrays", async () => {
      const response = await request(app)
        .post("/test")
        .send({
          tags: [
            "<script>alert('xss')</script>tag1",
            "safe-tag",
            "another<script>",
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.body.tags[0]).not.toContain("<script>");
      expect(response.body.body.tags[1]).toBe("safe-tag");
      expect(response.body.body.tags[2]).not.toContain("<script>");
    });
  });

  describe("sanitizeHtml", () => {
    it("should allow safe HTML tags", () => {
      const input = "<p>Hello <strong>world</strong>!</p>";
      const result = sanitizeHtml(input);
      expect(result).toContain("<p>");
      expect(result).toContain("<strong>");
    });

    it("should remove dangerous HTML tags", () => {
      const input = "<script>alert('xss')</script><p>Safe content</p>";
      const result = sanitizeHtml(input);
      expect(result).not.toContain("<script>");
      expect(result).toContain("<p>");
    });

    it("should remove dangerous attributes", () => {
      const input = "<p onclick=\"alert('xss')\">Click me</p>";
      const result = sanitizeHtml(input);
      expect(result).not.toContain("onclick");
      expect(result).toContain("<p>");
    });

    it("should handle non-string input", () => {
      expect(sanitizeHtml(null)).toBe(null);
      expect(sanitizeHtml(123)).toBe(123);
      expect(sanitizeHtml({})).toEqual({});
    });
  });

  describe("sanitizeText", () => {
    it("should remove control characters", () => {
      const input = "Hello\x00\x01World\x7F";
      const result = sanitizeText(input);
      expect(result).toBe("HelloWorld");
    });

    it("should preserve newlines and tabs", () => {
      const input = "Hello\nWorld\tTest";
      const result = sanitizeText(input);
      expect(result).toBe("Hello\nWorld\tTest");
    });

    it("should handle non-string input", () => {
      expect(sanitizeText(null)).toBe(null);
      expect(sanitizeText(123)).toBe(123);
    });
  });

  describe("Validation Functions", () => {
    describe("isValidStudentId", () => {
      it("should validate correct student ID format", () => {
        expect(isValidStudentId("2025CS1001")).toBe(true);
        expect(isValidStudentId("2024ECE0123")).toBe(true);
        expect(isValidStudentId("2023MECH999")).toBe(true);
      });

      it("should reject invalid student ID format", () => {
        expect(isValidStudentId("invalid")).toBe(false);
        expect(isValidStudentId("2025cs1001")).toBe(false); // lowercase
        expect(isValidStudentId("25CS1001")).toBe(false); // short year
        expect(isValidStudentId("2025CS")).toBe(false); // missing number
        expect(isValidStudentId(null)).toBe(false);
        expect(isValidStudentId(123)).toBe(false);
      });
    });

    describe("isValidEmail", () => {
      it("should validate correct email format", () => {
        expect(isValidEmail("test@example.com")).toBe(true);
        expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
      });

      it("should validate email with required domain", () => {
        expect(isValidEmail("student@college.edu", "college.edu")).toBe(true);
        expect(isValidEmail("student@other.edu", "college.edu")).toBe(false);
      });

      it("should reject invalid email format", () => {
        expect(isValidEmail("invalid-email")).toBe(false);
        expect(isValidEmail("@domain.com")).toBe(false);
        expect(isValidEmail("user@")).toBe(false);
        expect(isValidEmail(null)).toBe(false);
      });
    });

    describe("isValidObjectId", () => {
      it("should validate correct ObjectId format", () => {
        expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
        expect(isValidObjectId("123456789012345678901234")).toBe(true);
      });

      it("should reject invalid ObjectId format", () => {
        expect(isValidObjectId("invalid")).toBe(false);
        expect(isValidObjectId("507f1f77bcf86cd79943901")).toBe(false); // too short
        expect(isValidObjectId("507f1f77bcf86cd7994390111")).toBe(false); // too long
        expect(isValidObjectId("507f1f77bcf86cd79943901g")).toBe(false); // invalid char
        expect(isValidObjectId(null)).toBe(false);
      });
    });

    describe("isValidUrl", () => {
      it("should validate correct URL format", () => {
        expect(isValidUrl("https://example.com")).toBe(true);
        expect(isValidUrl("http://localhost:3000")).toBe(true);
      });

      it("should reject invalid protocols", () => {
        expect(isValidUrl("ftp://example.com")).toBe(false);
        expect(isValidUrl("javascript:alert('xss')")).toBe(false);
      });

      it("should allow custom protocols", () => {
        expect(isValidUrl("ftp://example.com", ["ftp", "https"])).toBe(true);
      });

      it("should reject invalid URL format", () => {
        expect(isValidUrl("not-a-url")).toBe(false);
        expect(isValidUrl(null)).toBe(false);
      });
    });
  });

  describe("validateFileUpload", () => {
    it("should validate correct file upload data", () => {
      const fileData = {
        filename: "image.jpg",
        mimeType: "image/jpeg",
        size: 1024000,
      };
      const result = validateFileUpload(fileData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid filename", () => {
      const fileData = {
        filename: "../../../etc/passwd",
        mimeType: "image/jpeg",
        size: 1024000,
      };
      const result = validateFileUpload(fileData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Filename contains invalid characters");
    });

    it("should reject unsupported MIME type", () => {
      const fileData = {
        filename: "script.exe",
        mimeType: "application/x-executable",
        size: 1024000,
      };
      const result = validateFileUpload(fileData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Unsupported file type");
    });

    it("should reject oversized files", () => {
      const fileData = {
        filename: "large.jpg",
        mimeType: "image/jpeg",
        size: 50000000, // 50MB
      };
      const result = validateFileUpload(fileData);
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("exceeds maximum limit"))
      ).toBe(true);
    });
  });

  describe("validatePostContent", () => {
    it("should validate correct post content", () => {
      const postData = {
        text: "Hello world!",
        tags: ["hello", "world"],
        visibility: "public",
      };
      const result = validatePostContent(postData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject oversized text", () => {
      const postData = {
        text: "a".repeat(2001),
        visibility: "public",
      };
      const result = validatePostContent(postData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Post text must be less than 2000 characters"
      );
    });

    it("should reject malicious content", () => {
      const postData = {
        text: "<script>alert('xss')</script>",
        visibility: "public",
      };
      const result = validatePostContent(postData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Post contains potentially malicious content"
      );
    });

    it("should reject too many tags", () => {
      const postData = {
        text: "Hello",
        tags: Array(11).fill("tag"),
        visibility: "public",
      };
      const result = validatePostContent(postData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Maximum 10 tags allowed");
    });

    it("should reject invalid tag format", () => {
      const postData = {
        text: "Hello",
        tags: ["valid-tag", "Invalid Tag!", "another-valid"],
        visibility: "public",
      };
      const result = validatePostContent(postData);
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("Tags must contain only"))
      ).toBe(true);
    });

    it("should reject invalid visibility", () => {
      const postData = {
        text: "Hello",
        visibility: "invalid",
      };
      const result = validatePostContent(postData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid visibility setting");
    });
  });

  describe("securityHeaders", () => {
    beforeEach(() => {
      app.use(securityHeaders);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });
    });

    it("should add security headers", async () => {
      const response = await request(app).get("/test");

      expect(response.headers).toHaveProperty("content-security-policy");
      expect(response.headers).toHaveProperty(
        "x-content-type-options",
        "nosniff"
      );
      expect(response.headers).toHaveProperty("x-frame-options", "DENY");
      expect(response.headers).toHaveProperty(
        "x-xss-protection",
        "1; mode=block"
      );
      expect(response.headers).toHaveProperty(
        "referrer-policy",
        "strict-origin-when-cross-origin"
      );
      expect(response.headers).toHaveProperty("permissions-policy");
    });

    it("should remove X-Powered-By header", async () => {
      const response = await request(app).get("/test");
      expect(response.headers).not.toHaveProperty("x-powered-by");
    });

    it("should set proper CSP header", async () => {
      const response = await request(app).get("/test");
      const csp = response.headers["content-security-policy"];

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
    });
  });

  describe("secureErrorHandler", () => {
    beforeEach(() => {
      app.get("/validation-error", (req, res, next) => {
        const error = new Error("Validation failed");
        error.name = "ValidationError";
        next(error);
      });

      app.get("/cast-error", (req, res, next) => {
        const error = new Error("Cast failed");
        error.name = "CastError";
        next(error);
      });

      app.get("/duplicate-error", (req, res, next) => {
        const error = new Error("Duplicate key");
        error.code = 11000;
        next(error);
      });

      app.get("/internal-error", (req, res, next) => {
        const error = new Error("Internal server error");
        next(error);
      });

      app.use(secureErrorHandler);
    });

    it("should handle validation errors", async () => {
      const response = await request(app).get("/validation-error");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.message).toBe("Request validation failed");
    });

    it("should handle cast errors", async () => {
      const response = await request(app).get("/cast-error");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_ID_FORMAT");
      expect(response.body.error.message).toBe("Invalid ID format");
    });

    it("should handle duplicate entry errors", async () => {
      const response = await request(app).get("/duplicate-error");

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("DUPLICATE_ENTRY");
      expect(response.body.error.message).toBe("Resource already exists");
    });

    it("should handle internal server errors", async () => {
      const response = await request(app).get("/internal-error");

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(response.body.error.message).toBe("An unexpected error occurred");
    });

    it("should not expose stack trace in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const response = await request(app).get("/internal-error");

      expect(response.body.error).not.toHaveProperty("stack");

      process.env.NODE_ENV = originalEnv;
    });

    it("should include stack trace in development", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const response = await request(app).get("/internal-error");

      expect(response.body.error).toHaveProperty("stack");

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Security Integration", () => {
    beforeEach(() => {
      app.use(securityHeaders);
      app.use(sanitizeInput);
      app.post("/secure-endpoint", (req, res) => {
        res.json({ received: req.body });
      });
      app.use(secureErrorHandler);
    });

    it("should apply all security measures", async () => {
      const response = await request(app).post("/secure-endpoint").send({
        text: "<script>alert('xss')</script>Hello",
        data: "Normal\x00data",
      });

      expect(response.status).toBe(200);
      expect(response.body.received.text).not.toContain("<script>");
      expect(response.body.received.data).toBe("Normaldata");

      // Check security headers
      expect(response.headers).toHaveProperty("content-security-policy");
      expect(response.headers).toHaveProperty(
        "x-content-type-options",
        "nosniff"
      );
    });
  });
});
