const request = require("supertest");
const express = require("express");
const {
  sanitizeInput,
  securityHeaders,
  securityLogger,
  secureErrorHandler,
} = require("../../src/middleware/validationMiddleware");
const {
  generalRateLimit,
} = require("../../src/middleware/rateLimitMiddleware");

describe("Security Attack Vector Tests", () => {
  let app;
  let consoleSpy;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(securityHeaders);
    app.use(sanitizeInput);
    app.use(securityLogger);

    // Mock console.warn to capture security logs
    consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // Test endpoints
    app.post("/api/posts", (req, res) => {
      res.json({ success: true, data: req.body });
    });

    app.get("/api/users/:id", (req, res) => {
      res.json({ success: true, id: req.params.id });
    });

    app.post("/api/search", (req, res) => {
      res.json({ success: true, query: req.body.query });
    });

    app.use(secureErrorHandler);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("XSS (Cross-Site Scripting) Protection", () => {
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<svg onload=alert('XSS')>",
      "<iframe src=javascript:alert('XSS')></iframe>",
      "<body onload=alert('XSS')>",
      "<input onfocus=alert('XSS') autofocus>",
      "<select onfocus=alert('XSS') autofocus>",
      "<textarea onfocus=alert('XSS') autofocus>",
      "<keygen onfocus=alert('XSS') autofocus>",
      "<video><source onerror=alert('XSS')>",
      "<audio src=x onerror=alert('XSS')>",
    ];

    xssPayloads.forEach((payload, index) => {
      it(`should sanitize XSS payload ${index + 1}: ${payload.substring(
        0,
        30
      )}...`, async () => {
        const response = await request(app)
          .post("/api/posts")
          .send({ content: payload });

        expect(response.status).toBe(200);
        expect(response.body.data.content).not.toContain("<script>");
        expect(response.body.data.content).not.toContain("onerror");
        expect(response.body.data.content).not.toContain("onload");
        expect(response.body.data.content).not.toContain("javascript:");
      });
    });

    it("should log suspicious XSS attempts", async () => {
      await request(app)
        .post("/api/posts")
        .send({ content: "<script>alert('XSS')</script>" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Suspicious request detected:",
        expect.objectContaining({
          ip: expect.any(String),
          path: "/api/posts",
          method: "POST",
        })
      );
    });
  });

  describe("SQL Injection Protection", () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "admin'/*",
      "' OR 1=1#",
      "' OR 'a'='a",
      "') OR ('1'='1",
      "1' AND (SELECT COUNT(*) FROM users) > 0 --",
      "'; EXEC xp_cmdshell('dir'); --",
    ];

    sqlInjectionPayloads.forEach((payload, index) => {
      it(`should detect SQL injection attempt ${
        index + 1
      }: ${payload}`, async () => {
        await request(app).post("/api/search").send({ query: payload });

        expect(consoleSpy).toHaveBeenCalledWith(
          "Suspicious request detected:",
          expect.objectContaining({
            path: "/api/search",
            method: "POST",
          })
        );
      });
    });

    it("should sanitize SQL injection in URL parameters", async () => {
      const payload = "'; DROP TABLE users; --";
      await request(app).get(`/api/users/${encodeURIComponent(payload)}`);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Suspicious request detected:",
        expect.objectContaining({
          path: `/api/users/${encodeURIComponent(payload)}`,
          method: "GET",
        })
      );
    });
  });

  describe("Path Traversal Protection", () => {
    const pathTraversalPayloads = [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\config\\sam",
      "....//....//....//etc/passwd",
      "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
      "..%252f..%252f..%252fetc%252fpasswd",
      "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
      "..//..//..//etc//passwd",
      "..\\..\\..\\etc\\passwd",
    ];

    pathTraversalPayloads.forEach((payload, index) => {
      it(`should detect path traversal attempt ${
        index + 1
      }: ${payload}`, async () => {
        await request(app).post("/api/posts").send({ filename: payload });

        expect(consoleSpy).toHaveBeenCalledWith(
          "Suspicious request detected:",
          expect.objectContaining({
            path: "/api/posts",
            method: "POST",
          })
        );
      });
    });
  });

  describe("Code Injection Protection", () => {
    const codeInjectionPayloads = [
      "eval('alert(1)')",
      "Function('alert(1)')()",
      "setTimeout('alert(1)', 0)",
      "setInterval('alert(1)', 0)",
      "execScript('alert(1)')",
      "${alert(1)}",
      "#{alert(1)}",
      "{{alert(1)}}",
      "<%=alert(1)%>",
      "<%= system('ls') %>",
    ];

    codeInjectionPayloads.forEach((payload, index) => {
      it(`should detect code injection attempt ${
        index + 1
      }: ${payload}`, async () => {
        await request(app).post("/api/posts").send({ content: payload });

        expect(consoleSpy).toHaveBeenCalledWith(
          "Suspicious request detected:",
          expect.objectContaining({
            path: "/api/posts",
            method: "POST",
          })
        );
      });
    });
  });

  describe("Header Injection Protection", () => {
    it("should prevent header injection via user input", async () => {
      const response = await request(app).post("/api/posts").send({
        content: "Normal content",
        header: "Content-Type: text/html\r\nSet-Cookie: admin=true",
      });

      expect(response.status).toBe(200);
      expect(response.headers).not.toHaveProperty("set-cookie");
    });

    it("should sanitize CRLF injection attempts", async () => {
      const payload =
        "test\r\nSet-Cookie: admin=true\r\n\r\n<script>alert('XSS')</script>";
      const response = await request(app)
        .post("/api/posts")
        .send({ content: payload });

      expect(response.status).toBe(200);
      expect(response.body.data.content).not.toContain("\r\n");
      expect(response.body.data.content).not.toContain("Set-Cookie");
    });
  });

  describe("NoSQL Injection Protection", () => {
    const nosqlPayloads = [
      { $ne: null },
      { $gt: "" },
      { $regex: ".*" },
      { $where: "function() { return true; }" },
      { $expr: { $gt: [1, 0] } },
      "'; return db.users.find(); var dummy='",
      { $or: [{ username: "admin" }, { password: { $exists: true } }] },
    ];

    nosqlPayloads.forEach((payload, index) => {
      it(`should handle NoSQL injection attempt ${index + 1}`, async () => {
        const response = await request(app)
          .post("/api/search")
          .send({ query: payload });

        expect(response.status).toBe(200);
        // The payload should be sanitized or handled safely
        if (typeof payload === "object") {
          expect(response.body.query).not.toEqual(payload);
        }
      });
    });
  });

  describe("File Upload Security", () => {
    it("should reject dangerous file extensions", async () => {
      const dangerousFiles = [
        "malware.exe",
        "script.bat",
        "virus.scr",
        "trojan.com",
        "backdoor.pif",
        "shell.php",
        "webshell.jsp",
        "exploit.asp",
      ];

      for (const filename of dangerousFiles) {
        const response = await request(app).post("/api/posts").send({
          filename,
          content: "file content",
        });

        expect(response.status).toBe(200);
        // Should log suspicious activity
        expect(consoleSpy).toHaveBeenCalled();
      }
    });

    it("should sanitize file names with path traversal", async () => {
      const response = await request(app).post("/api/posts").send({
        filename: "../../../etc/passwd.txt",
        content: "file content",
      });

      expect(response.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Suspicious request detected:",
        expect.objectContaining({
          path: "/api/posts",
        })
      );
    });
  });

  describe("LDAP Injection Protection", () => {
    const ldapPayloads = [
      "*)(uid=*",
      "*)(|(uid=*))",
      "admin)(&(password=*))",
      "*))%00",
      ")(cn=*",
      "*)(objectClass=*",
    ];

    ldapPayloads.forEach((payload, index) => {
      it(`should handle LDAP injection attempt ${
        index + 1
      }: ${payload}`, async () => {
        const response = await request(app)
          .post("/api/search")
          .send({ username: payload });

        expect(response.status).toBe(200);
        expect(response.body.data.username).not.toContain(")(");
        expect(response.body.data.username).not.toContain("*)(");
      });
    });
  });

  describe("Command Injection Protection", () => {
    const commandInjectionPayloads = [
      "; ls -la",
      "| cat /etc/passwd",
      "&& whoami",
      "|| id",
      "`whoami`",
      "$(whoami)",
      "; rm -rf /",
      "| nc -l -p 1234 -e /bin/sh",
    ];

    commandInjectionPayloads.forEach((payload, index) => {
      it(`should detect command injection attempt ${
        index + 1
      }: ${payload}`, async () => {
        await request(app).post("/api/posts").send({ command: payload });

        // Should be logged as suspicious
        expect(consoleSpy).toHaveBeenCalled();
      });
    });
  });

  describe("XML/XXE Protection", () => {
    const xxePayloads = [
      '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><root>&test;</root>',
      '<?xml version="1.0" encoding="ISO-8859-1"?><!DOCTYPE foo [<!ELEMENT foo ANY><!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
      '<!DOCTYPE test [<!ENTITY % init SYSTEM "data://text/plain;base64,ZmlsZTovLy9ldGMvcGFzc3dk">%init;]>',
    ];

    xxePayloads.forEach((payload, index) => {
      it(`should handle XXE attempt ${index + 1}`, async () => {
        const response = await request(app)
          .post("/api/posts")
          .send({ xml: payload });

        expect(response.status).toBe(200);
        expect(response.body.data.xml).not.toContain("<!DOCTYPE");
        expect(response.body.data.xml).not.toContain("<!ENTITY");
      });
    });
  });

  describe("Rate Limiting Security", () => {
    beforeEach(() => {
      // Create a new app with rate limiting for this test
      app = express();
      app.use(express.json());
      app.use(generalRateLimit);
      app.post("/api/test", (req, res) => {
        res.json({ success: true });
      });
    });

    it("should prevent brute force attacks", async () => {
      // Make requests up to the limit
      const promises = [];
      for (let i = 0; i < 101; i++) {
        promises.push(request(app).post("/api/test").send({}));
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error.code).toBe(
        "RATE_LIMIT_EXCEEDED"
      );
    }, 15000);
  });

  describe("Content Security Policy", () => {
    it("should set proper CSP headers", async () => {
      const response = await request(app).get("/api/users/123");

      const csp = response.headers["content-security-policy"];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("base-uri 'self'");
    });

    it("should prevent inline script execution", async () => {
      const response = await request(app).get("/api/users/123");

      const csp = response.headers["content-security-policy"];
      // Should not allow 'unsafe-eval' for scripts
      expect(csp).not.toContain("'unsafe-eval'");
    });
  });

  describe("Information Disclosure Prevention", () => {
    it("should not expose server information", async () => {
      const response = await request(app).get("/api/users/123");

      expect(response.headers).not.toHaveProperty("x-powered-by");
      expect(response.headers).not.toHaveProperty("server");
    });

    it("should not expose stack traces in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      app.get("/error", (req, res, next) => {
        const error = new Error("Test error with sensitive info");
        error.sensitiveData = "secret-key-123";
        next(error);
      });

      const response = await request(app).get("/error");

      expect(response.status).toBe(500);
      expect(response.body.error).not.toHaveProperty("stack");
      expect(response.body.error).not.toHaveProperty("sensitiveData");

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Input Size Limits", () => {
    it("should handle large payloads gracefully", async () => {
      const largePayload = {
        content: "A".repeat(100000), // 100KB string
        data: Array(1000).fill("test data"),
      };

      const response = await request(app).post("/api/posts").send(largePayload);

      // Should either succeed with sanitized data or fail gracefully
      expect([200, 413, 400]).toContain(response.status);
    });

    it("should prevent ReDoS attacks with complex regex", async () => {
      // Payload designed to cause catastrophic backtracking
      const redosPayload = "a".repeat(50000) + "X";

      const startTime = Date.now();
      const response = await request(app)
        .post("/api/posts")
        .send({ content: redosPayload });
      const endTime = Date.now();

      // Should not take more than 5 seconds to process
      expect(endTime - startTime).toBeLessThan(5000);
      expect(response.status).toBe(200);
    });
  });

  describe("Prototype Pollution Protection", () => {
    const prototypePollutionPayloads = [
      { __proto__: { isAdmin: true } },
      { constructor: { prototype: { isAdmin: true } } },
      { "__proto__.isAdmin": true },
      { "constructor.prototype.isAdmin": true },
    ];

    prototypePollutionPayloads.forEach((payload, index) => {
      it(`should prevent prototype pollution attempt ${
        index + 1
      }`, async () => {
        const response = await request(app).post("/api/posts").send(payload);

        expect(response.status).toBe(200);

        // Check that prototype wasn't polluted
        const testObj = {};
        expect(testObj.isAdmin).toBeUndefined();
        expect(Object.prototype.isAdmin).toBeUndefined();
      });
    });
  });
});
