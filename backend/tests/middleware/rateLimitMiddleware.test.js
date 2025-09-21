const request = require("supertest");
const express = require("express");
const {
  generalRateLimit,
  authRateLimit,
  mediaUploadRateLimit,
  contentCreationRateLimit,
  interactionRateLimit,
  adminRateLimit,
  messagingRateLimit,
  searchRateLimit,
  createSocketRateLimit,
  socketRateLimitStore,
} = require("../../src/middleware/rateLimitMiddleware");

describe("Rate Limiting Middleware", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    // Clear rate limit store between tests
    if (socketRateLimitStore && socketRateLimitStore.store) {
      socketRateLimitStore.store.clear();
    }
    // Clear any timers
    jest.clearAllTimers();
  });

  describe("General Rate Limiting", () => {
    beforeEach(() => {
      app.use(generalRateLimit);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });
    });

    it("should allow requests within rate limit", async () => {
      const response = await request(app).get("/test");
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("success");
    });

    it("should include rate limit headers", async () => {
      const response = await request(app).get("/test");
      expect(response.headers).toHaveProperty("ratelimit-limit");
      expect(response.headers).toHaveProperty("ratelimit-remaining");
      expect(response.headers).toHaveProperty("ratelimit-reset");
    });

    it("should block requests when rate limit exceeded", async () => {
      // Make requests up to the limit (100 requests in 15 minutes)
      const promises = [];
      for (let i = 0; i < 101; i++) {
        promises.push(request(app).get("/test"));
      }

      const responses = await Promise.allSettled(promises);

      // Count successful and rate-limited responses
      const successfulResponses = responses.filter(
        (r) => r.status === "fulfilled" && r.value.status === 200
      );
      const rateLimitedResponses = responses.filter(
        (r) => r.status === "fulfilled" && r.value.status === 429
      );

      expect(successfulResponses.length).toBe(100);
      expect(rateLimitedResponses.length).toBe(1);

      // Check rate limit error response
      if (rateLimitedResponses.length > 0) {
        const rateLimitResponse = rateLimitedResponses[0].value;
        expect(rateLimitResponse.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
        expect(rateLimitResponse.body.error.message).toContain(
          "Too many requests"
        );
      }
    }, 15000);
  });

  describe("Authentication Rate Limiting", () => {
    beforeEach(() => {
      app.use(authRateLimit);
      app.post("/auth", (req, res) => {
        res.json({ message: "authenticated" });
      });
    });

    it("should allow auth requests within limit", async () => {
      const response = await request(app).post("/auth").send({});
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("authenticated");
    });

    it("should block auth requests when limit exceeded", async () => {
      // Make 11 requests (limit is 10)
      const promises = [];
      for (let i = 0; i < 11; i++) {
        promises.push(request(app).post("/auth").send({}));
      }

      const responses = await Promise.allSettled(promises);

      const successfulResponses = responses.filter(
        (r) => r.status === "fulfilled" && r.value.status === 200
      );
      const rateLimitedResponses = responses.filter(
        (r) => r.status === "fulfilled" && r.value.status === 429
      );

      expect(successfulResponses.length).toBe(10);
      expect(rateLimitedResponses.length).toBe(1);

      if (rateLimitedResponses.length > 0) {
        const rateLimitResponse = rateLimitedResponses[0].value;
        expect(rateLimitResponse.body.error.code).toBe(
          "AUTH_RATE_LIMIT_EXCEEDED"
        );
      }
    }, 15000);
  });

  describe("Media Upload Rate Limiting", () => {
    beforeEach(() => {
      app.use(mediaUploadRateLimit);
      app.post("/media", (req, res) => {
        res.json({ message: "media uploaded" });
      });
    });

    it("should allow media uploads within limit", async () => {
      const response = await request(app).post("/media").send({});
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("media uploaded");
    });

    it("should use user-specific rate limiting when user is authenticated", async () => {
      // Mock authenticated user
      app.use((req, res, next) => {
        req.user = { studentId: "2025CS1001" };
        next();
      });

      const response = await request(app).post("/media").send({});
      expect(response.status).toBe(200);
    });
  });

  describe("Content Creation Rate Limiting", () => {
    beforeEach(() => {
      app.use(contentCreationRateLimit);
      app.post("/content", (req, res) => {
        res.json({ message: "content created" });
      });
    });

    it("should allow content creation within limit", async () => {
      const response = await request(app).post("/content").send({});
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("content created");
    });

    it("should block content creation when limit exceeded", async () => {
      // Make 31 requests (limit is 30 per hour)
      const promises = [];
      for (let i = 0; i < 31; i++) {
        promises.push(request(app).post("/content").send({}));
      }

      const responses = await Promise.all(promises);

      const successfulResponses = responses.filter((r) => r.status === 200);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(successfulResponses.length).toBe(30);
      expect(rateLimitedResponses.length).toBe(1);

      const rateLimitResponse = rateLimitedResponses[0];
      expect(rateLimitResponse.body.error.code).toBe(
        "CONTENT_CREATION_RATE_LIMIT_EXCEEDED"
      );
    }, 15000);
  });

  describe("Interaction Rate Limiting", () => {
    beforeEach(() => {
      app.use(interactionRateLimit);
      app.post("/interact", (req, res) => {
        res.json({ message: "interaction recorded" });
      });
    });

    it("should allow interactions within limit", async () => {
      const response = await request(app).post("/interact").send({});
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("interaction recorded");
    });
  });

  describe("Admin Rate Limiting", () => {
    beforeEach(() => {
      app.use(adminRateLimit);
      app.get("/admin", (req, res) => {
        res.json({ message: "admin action" });
      });
    });

    it("should allow admin requests within higher limit", async () => {
      const response = await request(app).get("/admin");
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("admin action");
    });
  });

  describe("Messaging Rate Limiting", () => {
    beforeEach(() => {
      app.use(messagingRateLimit);
      app.post("/message", (req, res) => {
        res.json({ message: "message sent" });
      });
    });

    it("should allow messaging within limit", async () => {
      const response = await request(app).post("/message").send({});
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("message sent");
    });

    it("should block messaging when limit exceeded", async () => {
      // Make 31 requests (limit is 30 per minute)
      const promises = [];
      for (let i = 0; i < 31; i++) {
        promises.push(request(app).post("/message").send({}));
      }

      const responses = await Promise.all(promises);

      const successfulResponses = responses.filter((r) => r.status === 200);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(successfulResponses.length).toBe(30);
      expect(rateLimitedResponses.length).toBe(1);

      const rateLimitResponse = rateLimitedResponses[0];
      expect(rateLimitResponse.body.error.code).toBe(
        "MESSAGING_RATE_LIMIT_EXCEEDED"
      );
    }, 10000);
  });

  describe("Search Rate Limiting", () => {
    beforeEach(() => {
      app.use(searchRateLimit);
      app.get("/search", (req, res) => {
        res.json({ message: "search results" });
      });
    });

    it("should allow search requests within limit", async () => {
      const response = await request(app).get("/search");
      expect(response.status).toBe(200);
      expect(response.body.message).toBe("search results");
    });

    it("should block search requests when limit exceeded", async () => {
      // Make 21 requests (limit is 20 per minute)
      const promises = [];
      for (let i = 0; i < 21; i++) {
        promises.push(request(app).get("/search"));
      }

      const responses = await Promise.all(promises);

      const successfulResponses = responses.filter((r) => r.status === 200);
      const rateLimitedResponses = responses.filter((r) => r.status === 429);

      expect(successfulResponses.length).toBe(20);
      expect(rateLimitedResponses.length).toBe(1);

      const rateLimitResponse = rateLimitedResponses[0];
      expect(rateLimitResponse.body.error.code).toBe(
        "SEARCH_RATE_LIMIT_EXCEEDED"
      );
    }, 10000);
  });

  describe("Socket Rate Limiting", () => {
    describe("SocketRateLimitStore", () => {
      it("should allow requests within limit", () => {
        const result = socketRateLimitStore.checkLimit(
          "user1",
          "sendMessage",
          30,
          60000
        );
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(29);
      });

      it("should block requests when limit exceeded", () => {
        // Make requests up to the limit
        for (let i = 0; i < 30; i++) {
          socketRateLimitStore.checkLimit("user1", "sendMessage", 30, 60000);
        }

        // Next request should be blocked
        const result = socketRateLimitStore.checkLimit(
          "user1",
          "sendMessage",
          30,
          60000
        );
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.resetTime).toBeDefined();
      });

      it("should reset limits after window expires", (done) => {
        // Use a short window for testing
        const windowMs = 100;

        // Exhaust the limit
        for (let i = 0; i < 5; i++) {
          socketRateLimitStore.checkLimit("user2", "test", 5, windowMs);
        }

        // Should be blocked
        let result = socketRateLimitStore.checkLimit(
          "user2",
          "test",
          5,
          windowMs
        );
        expect(result.allowed).toBe(false);

        // Wait for window to expire
        setTimeout(() => {
          result = socketRateLimitStore.checkLimit(
            "user2",
            "test",
            5,
            windowMs
          );
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(4);
          done();
        }, 150);
      });

      it("should handle different users independently", () => {
        const result1 = socketRateLimitStore.checkLimit(
          "user1",
          "sendMessage",
          30,
          60000
        );
        const result2 = socketRateLimitStore.checkLimit(
          "user2",
          "sendMessage",
          30,
          60000
        );

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
        expect(result1.remaining).toBe(29);
        expect(result2.remaining).toBe(29);
      });

      it("should handle different event types independently", () => {
        const result1 = socketRateLimitStore.checkLimit(
          "user1",
          "sendMessage",
          30,
          60000
        );
        const result2 = socketRateLimitStore.checkLimit(
          "user1",
          "typing",
          60,
          60000
        );

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
        expect(result1.remaining).toBe(29);
        expect(result2.remaining).toBe(59);
      });
    });

    describe("createSocketRateLimit", () => {
      it("should create middleware function", () => {
        const middleware = createSocketRateLimit("sendMessage");
        expect(typeof middleware).toBe("function");
      });

      it("should call next() when within rate limit", (done) => {
        const middleware = createSocketRateLimit("sendMessage");
        const mockSocket = {
          user: { studentId: "2025CS1001" },
          handshake: { address: "127.0.0.1" },
        };

        middleware(mockSocket, (error) => {
          expect(error).toBeUndefined();
          expect(mockSocket.rateLimit).toBeDefined();
          expect(mockSocket.rateLimit.eventType).toBe("sendMessage");
          done();
        });
      });

      it("should call next() with error when rate limit exceeded", (done) => {
        const middleware = createSocketRateLimit("test");
        const mockSocket = {
          user: { studentId: "2025CS1002" },
          handshake: { address: "127.0.0.1" },
        };

        // Exhaust the limit (using general limit of 100)
        for (let i = 0; i < 100; i++) {
          socketRateLimitStore.checkLimit("2025CS1002", "test", 100, 60000);
        }

        middleware(mockSocket, (error) => {
          expect(error).toBeDefined();
          expect(error.message).toBe("Rate limit exceeded");
          expect(error.data.code).toBe("SOCKET_RATE_LIMIT_EXCEEDED");
          expect(error.data.retryAfter).toBeDefined();
          done();
        });
      });

      it("should use IP address when no user is authenticated", (done) => {
        const middleware = createSocketRateLimit("general");
        const mockSocket = {
          handshake: { address: "192.168.1.1" },
        };

        middleware(mockSocket, (error) => {
          expect(error).toBeUndefined();
          expect(mockSocket.rateLimit).toBeDefined();
          done();
        });
      });
    });
  });

  describe("Rate Limit Key Generation", () => {
    it("should use user ID when available", async () => {
      app.use((req, res, next) => {
        req.user = { studentId: "2025CS1001" };
        next();
      });
      app.use(generalRateLimit);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });

      const response = await request(app).get("/test");
      expect(response.status).toBe(200);
    });

    it("should fall back to IP when no user", async () => {
      app.use(generalRateLimit);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });

      const response = await request(app).get("/test");
      expect(response.status).toBe(200);
    });
  });

  describe("Rate Limit Headers", () => {
    beforeEach(() => {
      app.use(generalRateLimit);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });
    });

    it("should include standard rate limit headers", async () => {
      const response = await request(app).get("/test");

      expect(response.headers).toHaveProperty("ratelimit-limit");
      expect(response.headers).toHaveProperty("ratelimit-remaining");
      expect(response.headers).toHaveProperty("ratelimit-reset");

      // Should not include legacy headers
      expect(response.headers).not.toHaveProperty("x-ratelimit-limit");
      expect(response.headers).not.toHaveProperty("x-ratelimit-remaining");
    });
  });
});
