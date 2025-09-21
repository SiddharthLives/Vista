const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../src/server");
const Story = require("../../src/models/Story");
const User = require("../../src/models/User");
const jwtService = require("../../src/services/jwtService");

// Helper function to generate correct cloudinary public ID
const generateCloudinaryPublicId = (
  year,
  department,
  section,
  studentId,
  filename
) => {
  return `college/${year}-${department}/dept-${department}/section-${section}/student-${studentId}/${filename}`;
};

describe("Stories API", () => {
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
    await Story.deleteMany({});
    await User.deleteMany({});

    // Create test users from different years/departments/sections
    testUser1 = await User.create({
      studentId: "2025CS1001",
      email: "student1@college.edu",
      displayName: "Test Student 1",
      year: 3,
      department: "CS",
      section: "A",
      bio: "Test bio 1",
    });

    testUser2 = await User.create({
      studentId: "2025CS1002",
      email: "student2@college.edu",
      displayName: "Test Student 2",
      year: 3,
      department: "CS",
      section: "B",
      bio: "Test bio 2",
    });

    testUser3 = await User.create({
      studentId: "2025ECE1001",
      email: "student3@college.edu",
      displayName: "Test Student 3",
      year: 2,
      department: "ECE",
      section: "A",
      bio: "Test bio 3",
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

  describe("POST /stories", () => {
    it("should create an image story", async () => {
      const storyData = {
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "story1.jpg"
          ),
          width: 800,
          height: 600,
          type: "image",
        },
      };

      const response = await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(storyData)
        .expect(201);

      expect(response.body.message).toBe("Story created successfully");
      expect(response.body.story.authorStudentId).toBe(testUser1.studentId);
      expect(response.body.story.media.url).toBe(storyData.media.url);
      expect(response.body.story.media.type).toBe("image");
      expect(response.body.story.author.displayName).toBe(
        testUser1.displayName
      );
      expect(response.body.story.expiresAt).toBeDefined();
      expect(response.body.story.viewsCount).toBe(0);
    });

    it("should create a video story", async () => {
      const storyData = {
        media: {
          url: "https://res.cloudinary.com/test/video/upload/v1/test.mp4",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "story1.mp4"
          ),
          width: 1920,
          height: 1080,
          duration: 15.5,
          type: "video",
        },
      };

      const response = await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(storyData)
        .expect(201);

      expect(response.body.story.media.type).toBe("video");
      expect(response.body.story.media.duration).toBe(15.5);
    });

    it("should reject story without authentication", async () => {
      const storyData = {
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "story1.jpg"
          ),
          type: "image",
        },
      };

      await request(app).post("/stories").send(storyData).expect(401);
    });

    it("should validate media ownership", async () => {
      const storyData = {
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "B",
            "2025CS1002",
            "story1.jpg"
          ), // Wrong user
          type: "image",
        },
      };

      const response = await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(storyData)
        .expect(403);

      expect(response.body.error.code).toBe("INVALID_MEDIA_OWNERSHIP");
    });

    it("should validate story data", async () => {
      // Invalid media URL
      await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          media: {
            url: "invalid-url",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "A",
              "2025CS1001",
              "story1.jpg"
            ),
            type: "image",
          },
        })
        .expect(400);

      // Invalid cloudinary public ID format
      await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
            cloudinaryPublicId: "invalid/format",
            type: "image",
          },
        })
        .expect(400);

      // Invalid media type
      await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "A",
              "2025CS1001",
              "story1.jpg"
            ),
            type: "invalid",
          },
        })
        .expect(400);

      // Duration too long
      await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          media: {
            url: "https://res.cloudinary.com/test/video/upload/v1/test.mp4",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "A",
              "2025CS1001",
              "story1.mp4"
            ),
            duration: 65, // Over 60 seconds
            type: "video",
          },
        })
        .expect(400);
    });

    it("should set automatic expiration", async () => {
      const storyData = {
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "story1.jpg"
          ),
          type: "image",
        },
      };

      const response = await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send(storyData)
        .expect(201);

      const expiresAt = new Date(response.body.story.expiresAt);
      const createdAt = new Date(response.body.story.createdAt);
      const timeDiff = expiresAt.getTime() - createdAt.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      expect(hoursDiff).toBeCloseTo(24, 1); // Should be approximately 24 hours
    });
  });

  describe("GET /stories", () => {
    beforeEach(async () => {
      // Create test stories
      await Story.create([
        {
          authorStudentId: testUser1.studentId,
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/story1.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "A",
              "2025CS1001",
              "story1.jpg"
            ),
            width: 800,
            height: 600,
            type: "image",
          },
        },
        {
          authorStudentId: testUser2.studentId,
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/story2.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "B",
              "2025CS1002",
              "story2.jpg"
            ),
            width: 800,
            height: 600,
            type: "image",
          },
        },
        {
          authorStudentId: testUser3.studentId,
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/story3.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "ECE",
              "A",
              "2025ECE1001",
              "story3.jpg"
            ),
            width: 800,
            height: 600,
            type: "image",
          },
        },
      ]);
    });

    it("should get stories feed with authentication", async () => {
      const response = await request(app)
        .get("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.stories).toHaveLength(2); // Only CS stories visible to CS user
      expect(response.body.stories[0].author).toBeDefined();
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it("should require authentication", async () => {
      await request(app).get("/stories").expect(401);
    });

    it("should filter stories by year", async () => {
      const response = await request(app)
        .get("/stories")
        .query({ year: 3 })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.stories).toHaveLength(2);
      expect(
        response.body.stories.every((story) => story.author.year === 3)
      ).toBe(true);
    });

    it("should filter stories by department", async () => {
      const response = await request(app)
        .get("/stories")
        .query({ department: "CS" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.stories).toHaveLength(2);
      expect(
        response.body.stories.every((story) => story.author.department === "CS")
      ).toBe(true);
    });

    it("should filter stories by section", async () => {
      const response = await request(app)
        .get("/stories")
        .query({ section: "A" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.stories).toHaveLength(1); // Only testUser1's story (CS A) visible to testUser1
      expect(
        response.body.stories.every((story) => story.author.section === "A")
      ).toBe(true);
    });

    it("should filter stories by author", async () => {
      const response = await request(app)
        .get("/stories")
        .query({ authorStudentId: testUser1.studentId })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.stories).toHaveLength(1);
      expect(response.body.stories[0].authorStudentId).toBe(
        testUser1.studentId
      );
    });

    it("should implement cursor-based pagination", async () => {
      // Create additional stories to ensure we have enough for pagination
      await Story.create([
        {
          authorStudentId: testUser1.studentId,
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/story4.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "A",
              "2025CS1001",
              "story4.jpg"
            ),
            type: "image",
          },
        },
        {
          authorStudentId: testUser2.studentId,
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/story5.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "B",
              "2025CS1002",
              "story5.jpg"
            ),
            type: "image",
          },
        },
      ]);

      const firstResponse = await request(app)
        .get("/stories")
        .query({ limit: 2 })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(firstResponse.body.stories).toHaveLength(2);
      expect(firstResponse.body.pagination.hasMore).toBe(true);
      expect(firstResponse.body.pagination.nextCursor).toBeDefined();

      const secondResponse = await request(app)
        .get("/stories")
        .query({
          limit: 2,
          cursor: firstResponse.body.pagination.nextCursor,
        })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(secondResponse.body.stories.length).toBeGreaterThan(0);
      expect(secondResponse.body.stories[0]._id).not.toBe(
        firstResponse.body.stories[0]._id
      );
    });

    it("should validate query parameters", async () => {
      await request(app)
        .get("/stories")
        .query({ limit: 100 })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(400);

      await request(app)
        .get("/stories")
        .query({ year: 5 })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(400);

      await request(app)
        .get("/stories")
        .query({ department: "INVALID" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(400);

      await request(app)
        .get("/stories")
        .query({ section: "invalid" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(400);

      await request(app)
        .get("/stories")
        .query({ authorStudentId: "invalid" })
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(400);
    });

    it("should not return expired stories", async () => {
      // Create an expired story
      const expiredStory = await Story.create({
        authorStudentId: testUser1.studentId,
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/expired.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "expired.jpg"
          ),
          type: "image",
        },
        expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      });

      const response = await request(app)
        .get("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      // Should not include the expired story
      expect(
        response.body.stories.some(
          (story) => story._id === expiredStory._id.toString()
        )
      ).toBe(false);
    });
  });

  describe("GET /stories/:id", () => {
    let testStory;

    beforeEach(async () => {
      testStory = await Story.create({
        authorStudentId: testUser1.studentId,
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "test.jpg"
          ),
          width: 800,
          height: 600,
          type: "image",
        },
      });
    });

    it("should get a specific story", async () => {
      const response = await request(app)
        .get(`/stories/${testStory._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.story._id).toBe(testStory._id.toString());
      expect(response.body.story.media.url).toBe(testStory.media.url);
      expect(response.body.story.author.displayName).toBe(
        testUser1.displayName
      );
    });

    it("should require authentication", async () => {
      await request(app).get(`/stories/${testStory._id}`).expect(401);
    });

    it("should return 404 for non-existent story", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/stories/${fakeId}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);
    });

    it("should return 404 for expired story", async () => {
      // Create an expired story
      const expiredStory = await Story.create({
        authorStudentId: testUser1.studentId,
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/expired.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "expired.jpg"
          ),
          type: "image",
        },
        expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      });

      await request(app)
        .get(`/stories/${expiredStory._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);
    });

    it("should validate story ID format", async () => {
      await request(app)
        .get("/stories/invalid-id")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(400);
    });

    it("should record view when accessing story", async () => {
      const response = await request(app)
        .get(`/stories/${testStory._id}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      // Check that view was recorded
      const updatedStory = await Story.findById(testStory._id);
      expect(updatedStory.viewsCount).toBe(1);
      expect(updatedStory.viewedBy).toHaveLength(1);
      expect(updatedStory.viewedBy[0].studentId).toBe(testUser2.studentId);
    });

    it("should not record duplicate views", async () => {
      // View the story twice with the same user
      await request(app)
        .get(`/stories/${testStory._id}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      await request(app)
        .get(`/stories/${testStory._id}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      // Check that only one view was recorded
      const updatedStory = await Story.findById(testStory._id);
      expect(updatedStory.viewsCount).toBe(1);
      expect(updatedStory.viewedBy).toHaveLength(1);
    });
  });

  describe("POST /stories/:id/view", () => {
    let testStory;

    beforeEach(async () => {
      testStory = await Story.create({
        authorStudentId: testUser1.studentId,
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/test.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "test.jpg"
          ),
          width: 800,
          height: 600,
          type: "image",
        },
      });
    });

    it("should record a story view", async () => {
      const response = await request(app)
        .post(`/stories/${testStory._id}/view`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.message).toBe("Story view recorded successfully");
      expect(response.body.viewsCount).toBe(1);

      // Verify in database
      const updatedStory = await Story.findById(testStory._id);
      expect(updatedStory.viewsCount).toBe(1);
      expect(updatedStory.viewedBy).toHaveLength(1);
      expect(updatedStory.viewedBy[0].studentId).toBe(testUser2.studentId);
    });

    it("should require authentication", async () => {
      await request(app).post(`/stories/${testStory._id}/view`).expect(401);
    });

    it("should return 404 for non-existent story", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .post(`/stories/${fakeId}/view`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);
    });

    it("should return 404 for expired story", async () => {
      // Create an expired story
      const expiredStory = await Story.create({
        authorStudentId: testUser1.studentId,
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/expired.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "expired.jpg"
          ),
          type: "image",
        },
        expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      });

      await request(app)
        .post(`/stories/${expiredStory._id}/view`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(404);
    });

    it("should not record duplicate views", async () => {
      // Record view twice
      await request(app)
        .post(`/stories/${testStory._id}/view`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      const response = await request(app)
        .post(`/stories/${testStory._id}/view`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.viewsCount).toBe(1);

      // Verify in database
      const updatedStory = await Story.findById(testStory._id);
      expect(updatedStory.viewsCount).toBe(1);
      expect(updatedStory.viewedBy).toHaveLength(1);
    });
  });

  describe("GET /stories/cleanup/expired", () => {
    it("should cleanup expired stories", async () => {
      // Create some expired stories
      await Story.create([
        {
          authorStudentId: testUser1.studentId,
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/expired1.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "A",
              "2025CS1001",
              "expired1.jpg"
            ),
            type: "image",
          },
          expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        },
        {
          authorStudentId: testUser2.studentId,
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/expired2.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "B",
              "2025CS1002",
              "expired2.jpg"
            ),
            type: "image",
          },
          expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        },
        {
          authorStudentId: testUser1.studentId,
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v1/active.jpg",
            cloudinaryPublicId: generateCloudinaryPublicId(
              2025,
              "CS",
              "A",
              "2025CS1001",
              "active.jpg"
            ),
            type: "image",
          },
          // This one is not expired
        },
      ]);

      const response = await request(app)
        .get("/stories/cleanup/expired")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.message).toBe("Expired stories cleanup completed");
      expect(response.body.deletedCount).toBe(2);
      expect(response.body.timestamp).toBeDefined();

      // Verify that only active stories remain
      const remainingStories = await Story.find({});
      expect(remainingStories).toHaveLength(1);
      expect(remainingStories[0].media.cloudinaryPublicId).toContain(
        "active.jpg"
      );
    });

    it("should require authentication", async () => {
      await request(app).get("/stories/cleanup/expired").expect(401);
    });
  });

  describe("Story visibility and permissions", () => {
    let storyFromUser1, storyFromUser2, storyFromUser3;

    beforeEach(async () => {
      storyFromUser1 = await Story.create({
        authorStudentId: testUser1.studentId, // 3rd year CS A
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/story1.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "A",
            "2025CS1001",
            "story1.jpg"
          ),
          type: "image",
        },
      });

      storyFromUser2 = await Story.create({
        authorStudentId: testUser2.studentId, // 3rd year CS B
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/story2.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "CS",
            "B",
            "2025CS1002",
            "story2.jpg"
          ),
          type: "image",
        },
      });

      storyFromUser3 = await Story.create({
        authorStudentId: testUser3.studentId, // 2nd year ECE A
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v1/story3.jpg",
          cloudinaryPublicId: generateCloudinaryPublicId(
            2025,
            "ECE",
            "A",
            "2025ECE1001",
            "story3.jpg"
          ),
          type: "image",
        },
      });
    });

    it("should allow users to view stories from same year", async () => {
      // User1 (3rd year CS A) should be able to view User2's story (3rd year CS B)
      await request(app)
        .get(`/stories/${storyFromUser2._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);
    });

    it("should allow users to view stories from same department", async () => {
      // User1 (3rd year CS A) should be able to view User2's story (3rd year CS B)
      await request(app)
        .get(`/stories/${storyFromUser2._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);
    });

    it("should allow users to view their own stories", async () => {
      await request(app)
        .get(`/stories/${storyFromUser1._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);
    });

    it("should filter stories based on visibility in feed", async () => {
      const response = await request(app)
        .get("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      // User1 should see only CS stories (same department) - not ECE stories
      expect(response.body.stories).toHaveLength(2);
    });
  });
});
