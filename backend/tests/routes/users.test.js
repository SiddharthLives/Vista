const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../src/server");
const User = require("../../src/models/User");
const jwtService = require("../../src/services/jwtService");

describe("Users API", () => {
  let testUser1, testUser2, testUser3, authToken1, authToken2, authToken3;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri =
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/college-social-media-test";
    await mongoose.connect(mongoUri);
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});

    // Create test users
    testUser1 = await User.create({
      studentId: "2025CS1001",
      email: "student1@college.edu",
      displayName: "Alice Johnson",
      year: 3,
      department: "CS",
      section: "A",
      bio: "Computer Science student interested in AI and machine learning",
    });

    testUser2 = await User.create({
      studentId: "2025CS1002",
      email: "student2@college.edu",
      displayName: "Bob Smith",
      year: 3,
      department: "CS",
      section: "B",
      bio: "Full-stack developer and open source contributor",
    });

    testUser3 = await User.create({
      studentId: "2025ECE2001",
      email: "student3@college.edu",
      displayName: "Carol Davis",
      year: 2,
      department: "ECE",
      section: "A",
      bio: "Electronics enthusiast and robotics club member",
    });

    // Generate auth tokens
    authToken1 = jwtService.generateToken({
      studentId: testUser1.studentId,
      email: testUser1.email,
      uid: "firebase-uid-1",
    });

    authToken2 = jwtService.generateToken({
      studentId: testUser2.studentId,
      email: testUser2.email,
      uid: "firebase-uid-2",
    });

    authToken3 = jwtService.generateToken({
      studentId: testUser3.studentId,
      email: testUser3.email,
      uid: "firebase-uid-3",
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("GET /users", () => {
    it("should get all users without authentication", async () => {
      const response = await request(app).get("/users").expect(200);

      expect(response.body.users).toHaveLength(3);
      expect(response.body.pagination.totalCount).toBe(3);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.hasMore).toBe(false);

      // Check that sensitive fields are not exposed
      response.body.users.forEach((user) => {
        expect(user.fcmTokens).toBeUndefined();
        expect(user.__v).toBeUndefined();
      });
    });

    it("should filter users by year", async () => {
      const response = await request(app)
        .get("/users")
        .query({ year: 3 })
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      response.body.users.forEach((user) => {
        expect(user.year).toBe(3);
      });
    });

    it("should filter users by department", async () => {
      const response = await request(app)
        .get("/users")
        .query({ department: "CS" })
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      response.body.users.forEach((user) => {
        expect(user.department).toBe("CS");
      });
    });

    it("should filter users by section", async () => {
      const response = await request(app)
        .get("/users")
        .query({ section: "A" })
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      response.body.users.forEach((user) => {
        expect(user.section).toBe("A");
      });
    });

    it("should filter users by multiple criteria", async () => {
      const response = await request(app)
        .get("/users")
        .query({ year: 3, department: "CS", section: "A" })
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].studentId).toBe(testUser1.studentId);
    });

    it("should implement pagination", async () => {
      const response = await request(app)
        .get("/users")
        .query({ limit: 2, page: 1 })
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalPages).toBe(2);
      expect(response.body.pagination.hasMore).toBe(true);

      const secondPageResponse = await request(app)
        .get("/users")
        .query({ limit: 2, page: 2 })
        .expect(200);

      expect(secondPageResponse.body.users).toHaveLength(1);
      expect(secondPageResponse.body.pagination.currentPage).toBe(2);
      expect(secondPageResponse.body.pagination.hasMore).toBe(false);
    });

    it("should search users by text", async () => {
      const response = await request(app)
        .get("/users")
        .query({ search: "Alice" })
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].displayName).toBe("Alice Johnson");
    });

    it("should search users by bio content", async () => {
      const response = await request(app)
        .get("/users")
        .query({ search: "robotics" })
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].displayName).toBe("Carol Davis");
    });

    it("should validate query parameters", async () => {
      // Invalid year
      await request(app).get("/users").query({ year: 5 }).expect(400);

      // Invalid department
      await request(app)
        .get("/users")
        .query({ department: "INVALID" })
        .expect(400);

      // Invalid section
      await request(app).get("/users").query({ section: "AB" }).expect(400);

      // Invalid limit
      await request(app).get("/users").query({ limit: 100 }).expect(400);

      // Invalid page
      await request(app).get("/users").query({ page: 0 }).expect(400);
    });

    it("should return empty results for no matches", async () => {
      const response = await request(app)
        .get("/users")
        .query({ year: 4 })
        .expect(200);

      expect(response.body.users).toHaveLength(0);
      expect(response.body.pagination.totalCount).toBe(0);
    });
  });

  describe("GET /users/search", () => {
    it("should search users with query parameter", async () => {
      const response = await request(app)
        .get("/users/search")
        .query({ q: "Alice" })
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].displayName).toBe("Alice Johnson");
      expect(response.body.query).toBe("Alice");
      expect(response.body.count).toBe(1);
    });

    it("should search users with filters", async () => {
      const response = await request(app)
        .get("/users/search")
        .query({ q: "student", department: "CS" })
        .expect(200);

      expect(response.body.users.length).toBeGreaterThan(0);
      response.body.users.forEach((user) => {
        expect(user.department).toBe("CS");
      });
      expect(response.body.filters.department).toBe("CS");
    });

    it("should limit search results", async () => {
      const response = await request(app)
        .get("/users/search")
        .query({ q: "student", limit: 1 })
        .expect(200);

      expect(response.body.users).toHaveLength(1);
    });

    it("should require search query", async () => {
      await request(app).get("/users/search").expect(400);

      await request(app).get("/users/search").query({ q: "" }).expect(400);
    });

    it("should validate search parameters", async () => {
      // Query too long
      await request(app)
        .get("/users/search")
        .query({ q: "a".repeat(101) })
        .expect(400);

      // Invalid year filter
      await request(app)
        .get("/users/search")
        .query({ q: "test", year: 5 })
        .expect(400);

      // Invalid department filter
      await request(app)
        .get("/users/search")
        .query({ q: "test", department: "INVALID" })
        .expect(400);
    });

    it("should return results with text score", async () => {
      const response = await request(app)
        .get("/users/search")
        .query({ q: "Alice Johnson" })
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].score).toBeDefined();
      expect(response.body.users[0].score).toBeGreaterThan(0);
    });
  });

  describe("GET /users/:studentId", () => {
    it("should get user profile without authentication", async () => {
      const response = await request(app)
        .get(`/users/${testUser1.studentId}`)
        .expect(200);

      expect(response.body.user.studentId).toBe(testUser1.studentId);
      expect(response.body.user.displayName).toBe(testUser1.displayName);
      expect(response.body.user.year).toBe(testUser1.year);
      expect(response.body.user.department).toBe(testUser1.department);
      expect(response.body.user.section).toBe(testUser1.section);
      expect(response.body.user.bio).toBe(testUser1.bio);

      // Sensitive fields should not be exposed
      expect(response.body.user.fcmTokens).toBeUndefined();
      expect(response.body.user.__v).toBeUndefined();
    });

    it("should get user profile with authentication", async () => {
      const response = await request(app)
        .get(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.user.studentId).toBe(testUser1.studentId);
      expect(response.body.user.displayName).toBe(testUser1.displayName);
    });

    it("should return 404 for non-existent user", async () => {
      const response = await request(app).get("/users/2025CS9999").expect(404);

      expect(response.body.error.code).toBe("USER_NOT_FOUND");
    });

    it("should validate student ID format", async () => {
      await request(app).get("/users/invalid-id").expect(400);

      await request(app).get("/users/123").expect(400);

      await request(app).get("/users/2025INVALID123").expect(400);
    });

    it("should handle inactive users", async () => {
      // Deactivate user
      await User.findByIdAndUpdate(testUser1._id, { isActive: false });

      const response = await request(app)
        .get(`/users/${testUser1.studentId}`)
        .expect(404);

      expect(response.body.error.code).toBe("USER_NOT_FOUND");
    });
  });

  describe("PATCH /users/:studentId", () => {
    it("should update own profile", async () => {
      const updateData = {
        displayName: "Alice Updated",
        bio: "Updated bio content",
        photoUrl: "https://example.com/new-photo.jpg",
      };

      const response = await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe("Profile updated successfully");
      expect(response.body.user.displayName).toBe(updateData.displayName);
      expect(response.body.user.bio).toBe(updateData.bio);
      expect(response.body.user.photoUrl).toBe(updateData.photoUrl);

      // Verify in database
      const updatedUser = await User.findById(testUser1._id);
      expect(updatedUser.displayName).toBe(updateData.displayName);
      expect(updatedUser.bio).toBe(updateData.bio);
      expect(updatedUser.photoUrl).toBe(updateData.photoUrl);
    });

    it("should update settings", async () => {
      const updateData = {
        settings: {
          notifications: false,
          privacy: {
            showEmail: true,
            showYear: false,
          },
        },
      };

      const response = await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send(updateData)
        .expect(200);

      expect(response.body.user.settings.notifications).toBe(false);
      expect(response.body.user.settings.privacy.showEmail).toBe(true);
      expect(response.body.user.settings.privacy.showYear).toBe(false);

      // Verify in database
      const updatedUser = await User.findById(testUser1._id);
      expect(updatedUser.settings.notifications).toBe(false);
      expect(updatedUser.settings.privacy.showEmail).toBe(true);
      expect(updatedUser.settings.privacy.showYear).toBe(false);
    });

    it("should not allow updating other user's profile", async () => {
      const updateData = {
        displayName: "Hacked Name",
      };

      const response = await request(app)
        .patch(`/users/${testUser2.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");

      // Verify user was not updated
      const unchangedUser = await User.findById(testUser2._id);
      expect(unchangedUser.displayName).toBe(testUser2.displayName);
    });

    it("should require authentication", async () => {
      const updateData = {
        displayName: "New Name",
      };

      await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .send(updateData)
        .expect(401);
    });

    it("should return 404 for non-existent user", async () => {
      const updateData = {
        displayName: "New Name",
      };

      await request(app)
        .patch("/users/2025CS9999")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(updateData)
        .expect(404);
    });

    it("should validate update data", async () => {
      // Display name too short
      await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ displayName: "A" })
        .expect(400);

      // Display name too long
      await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ displayName: "a".repeat(51) })
        .expect(400);

      // Invalid photo URL
      await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ photoUrl: "not-a-url" })
        .expect(400);

      // Bio too long
      await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ bio: "a".repeat(501) })
        .expect(400);

      // Invalid settings
      await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({ settings: { notifications: "invalid" } })
        .expect(400);
    });

    it("should not allow updating restricted fields", async () => {
      const updateData = {
        studentId: "2025CS9999", // Should be ignored
        email: "newemail@college.edu", // Should be ignored
        year: 4, // Should be ignored
        department: "ECE", // Should be ignored
        section: "B", // Should be ignored
        displayName: "Valid Update",
      };

      const response = await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send(updateData)
        .expect(200);

      // Only displayName should be updated
      expect(response.body.user.displayName).toBe("Valid Update");
      expect(response.body.user.studentId).toBe(testUser1.studentId); // Unchanged
      expect(response.body.user.email).toBe(testUser1.email); // Unchanged
      expect(response.body.user.year).toBe(testUser1.year); // Unchanged
      expect(response.body.user.department).toBe(testUser1.department); // Unchanged
      expect(response.body.user.section).toBe(testUser1.section); // Unchanged
    });

    it("should handle validation errors from model", async () => {
      // This should trigger model validation error
      const updateData = {
        displayName: "", // Empty string should fail model validation
      };

      const response = await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should preserve existing settings when partially updating", async () => {
      // First, set some initial settings
      await User.findByIdAndUpdate(testUser1._id, {
        settings: {
          notifications: true,
          privacy: {
            showEmail: false,
            showYear: true,
          },
        },
      });

      // Update only notifications setting
      const updateData = {
        settings: {
          notifications: false,
        },
      };

      const response = await request(app)
        .patch(`/users/${testUser1.studentId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send(updateData)
        .expect(200);

      // Notifications should be updated, privacy settings should be preserved
      expect(response.body.user.settings.notifications).toBe(false);
      expect(response.body.user.settings.privacy.showEmail).toBe(false);
      expect(response.body.user.settings.privacy.showYear).toBe(true);
    });
  });
});
