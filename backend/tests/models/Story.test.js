const Story = require("../../src/models/Story");

describe("Story Model", () => {
  beforeEach(async () => {
    await Story.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validImageStoryData = {
      authorStudentId: "2025CS1001",
      media: {
        url: "https://res.cloudinary.com/test/image/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/story.jpg",
        cloudinaryPublicId:
          "college/2025-CS/dept-CS/section-A/student-2025CS1001/story",
        width: 800,
        height: 600,
        type: "image",
      },
    };

    const validVideoStoryData = {
      authorStudentId: "2025CS1001",
      media: {
        url: "https://res.cloudinary.com/test/video/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/story.mp4",
        cloudinaryPublicId:
          "college/2025-CS/dept-CS/section-A/student-2025CS1001/story",
        width: 1080,
        height: 1920,
        duration: 15.5,
        type: "video",
      },
    };

    test("should create a valid image story", async () => {
      const story = new Story(validImageStoryData);
      const savedStory = await story.save();

      expect(savedStory._id).toBeDefined();
      expect(savedStory.authorStudentId).toBe("2025CS1001");
      expect(savedStory.media.url).toBe(validImageStoryData.media.url);
      expect(savedStory.media.type).toBe("image");
      expect(savedStory.viewsCount).toBe(0);
      expect(savedStory.isActive).toBe(true);
      expect(savedStory.createdAt).toBeDefined();
      expect(savedStory.expiresAt).toBeDefined();
      expect(savedStory.viewedBy).toHaveLength(0);

      // Check that expiresAt is approximately 24 hours from now
      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(
        savedStory.expiresAt.getTime() - expectedExpiry.getTime()
      );
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    test("should create a valid video story", async () => {
      const story = new Story(validVideoStoryData);
      const savedStory = await story.save();

      expect(savedStory.media.type).toBe("video");
      expect(savedStory.media.duration).toBe(15.5);
    });

    test("should require authorStudentId", async () => {
      const storyData = { ...validImageStoryData };
      delete storyData.authorStudentId;

      const story = new Story(storyData);
      await expect(story.save()).rejects.toThrow(
        "Author student ID is required"
      );
    });

    test("should validate authorStudentId format", async () => {
      const invalidIds = ["invalid", "2025CS", "CS1001", "25CS1001"];

      for (const invalidId of invalidIds) {
        const story = new Story({
          ...validImageStoryData,
          authorStudentId: invalidId,
        });
        await expect(story.save()).rejects.toThrow(
          "Author student ID must follow format"
        );
      }
    });

    test("should require media URL", async () => {
      const storyData = { ...validImageStoryData };
      delete storyData.media.url;

      const story = new Story(storyData);
      await expect(story.save()).rejects.toThrow("Media URL is required");
    });

    test("should validate media URL format", async () => {
      const storyData = {
        ...validImageStoryData,
        media: {
          ...validImageStoryData.media,
          url: "invalid-url",
        },
      };

      const story = new Story(storyData);
      await expect(story.save()).rejects.toThrow(
        "Media URL must be a valid HTTP/HTTPS URL"
      );
    });

    test("should require cloudinary public ID", async () => {
      const storyData = { ...validImageStoryData };
      delete storyData.media.cloudinaryPublicId;

      const story = new Story(storyData);
      await expect(story.save()).rejects.toThrow(
        "Cloudinary public ID is required"
      );
    });

    test("should validate cloudinary public ID format", async () => {
      const storyData = {
        ...validImageStoryData,
        media: {
          ...validImageStoryData.media,
          cloudinaryPublicId: "invalid/path",
        },
      };

      const story = new Story(storyData);
      await expect(story.save()).rejects.toThrow(
        "Cloudinary public ID must follow college folder structure"
      );
    });

    test("should validate media dimensions", async () => {
      const storyData = {
        ...validImageStoryData,
        media: {
          ...validImageStoryData.media,
          width: -1,
          height: 0,
        },
      };

      const story = new Story(storyData);
      await expect(story.save()).rejects.toThrow("Width must be positive");
    });

    test("should validate duration limits", async () => {
      const storyData = {
        ...validVideoStoryData,
        media: {
          ...validVideoStoryData.media,
          duration: 65, // Exceeds 60 second limit
        },
      };

      const story = new Story(storyData);
      await expect(story.save()).rejects.toThrow(
        "Story duration cannot exceed 60 seconds"
      );
    });

    test("should validate media type enum", async () => {
      const storyData = {
        ...validImageStoryData,
        media: {
          ...validImageStoryData.media,
          type: "invalid",
        },
      };

      const story = new Story(storyData);
      await expect(story.save()).rejects.toThrow(
        "Story media type must be either image or video"
      );
    });

    test("should auto-set media type based on duration", async () => {
      // Test video type auto-detection
      const videoStoryData = {
        authorStudentId: "2025CS1001",
        media: {
          url: "https://res.cloudinary.com/test/video/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/story.mp4",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/story",
          width: 1080,
          height: 1920,
          duration: 10,
          // type is intentionally omitted
        },
      };

      const videoStory = new Story(videoStoryData);
      const savedVideoStory = await videoStory.save();
      expect(savedVideoStory.media.type).toBe("video");

      // Test image type default
      const imageStoryData = {
        authorStudentId: "2025CS1002",
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1002/story.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1002/story",
          width: 800,
          height: 600,
          // type is intentionally omitted, no duration
        },
      };

      const imageStory = new Story(imageStoryData);
      const savedImageStory = await imageStory.save();
      expect(savedImageStory.media.type).toBe("image");
    });

    test("should validate viewedBy student IDs", async () => {
      const story = new Story({
        ...validImageStoryData,
        viewedBy: [{ studentId: "invalid-id" }],
      });

      await expect(story.save()).rejects.toThrow(
        "Student ID must follow format"
      );
    });
  });

  describe("Instance Methods", () => {
    let story;

    beforeEach(async () => {
      story = new Story({
        authorStudentId: "2025CS1001",
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/story.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/story",
          width: 800,
          height: 600,
          type: "image",
        },
      });
      await story.save();
    });

    test("should add view from new viewer", async () => {
      await story.addView("2025CS1002");

      expect(story.viewsCount).toBe(1);
      expect(story.viewedBy).toHaveLength(1);
      expect(story.viewedBy[0].studentId).toBe("2025CS1002");
      expect(story.viewedBy[0].viewedAt).toBeDefined();
    });

    test("should not add duplicate views", async () => {
      await story.addView("2025CS1002");
      await story.addView("2025CS1002");

      expect(story.viewsCount).toBe(1);
      expect(story.viewedBy).toHaveLength(1);
    });

    test("should get viewers list", async () => {
      await story.addView("2025CS1002");
      await story.addView("2025ECE1001");

      const viewers = story.getViewers();
      expect(viewers).toHaveLength(2);
      expect(viewers[0].studentId).toBe("2025CS1002");
      expect(viewers[1].studentId).toBe("2025ECE1001");
      expect(viewers[0].viewedAt).toBeDefined();
    });

    test("should check view permissions", () => {
      // Author can view their own story
      expect(
        story.canBeViewedBy("2025CS1001", 3, "CS", "A", 3, "CS", "A")
      ).toBe(true);

      // Same year viewer
      expect(
        story.canBeViewedBy("2025ECE1001", 3, "ECE", "B", 3, "CS", "A")
      ).toBe(true);

      // Same department viewer
      expect(
        story.canBeViewedBy("2025CS1002", 2, "CS", "B", 3, "CS", "A")
      ).toBe(true);

      // Same section viewer
      expect(
        story.canBeViewedBy("2025CS1003", 3, "CS", "A", 3, "CS", "A")
      ).toBe(true);
    });

    test("should not allow viewing inactive stories", () => {
      story.isActive = false;
      expect(
        story.canBeViewedBy("2025CS1002", 3, "CS", "A", 3, "CS", "A")
      ).toBe(false);
    });

    test("should mark story as inactive", async () => {
      await story.markAsInactive();
      expect(story.isActive).toBe(false);
    });
  });

  describe("Virtuals", () => {
    let story;

    beforeEach(async () => {
      story = new Story({
        authorStudentId: "2025CS1001",
        media: {
          url: "https://res.cloudinary.com/test/image/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/story.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/story",
          width: 800,
          height: 600,
          type: "image",
        },
      });
      await story.save();
    });

    test("should check if story is expired", () => {
      // Fresh story should not be expired
      expect(story.isExpired).toBe(false);

      // Manually set expiry to past
      story.expiresAt = new Date(Date.now() - 1000);
      expect(story.isExpired).toBe(true);
    });

    test("should calculate time remaining", () => {
      const timeRemaining = story.timeRemaining;
      expect(timeRemaining).toBeGreaterThan(0);
      expect(timeRemaining).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // Less than or equal to 24 hours
    });

    test("should check if viewed by specific user", async () => {
      await story.addView("2025CS1002");

      const hasBeenViewedBy = story.hasBeenViewedBy;
      expect(hasBeenViewedBy("2025CS1002")).toBe(true);
      expect(hasBeenViewedBy("2025ECE1001")).toBe(false);
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const now = new Date();
      const stories = [
        {
          authorStudentId: "2025CS1001",
          media: {
            url: "https://example.com/story1.jpg",
            cloudinaryPublicId:
              "college/2025-CS/dept-CS/section-A/student-2025CS1001/story1",
            type: "image",
          },
          createdAt: new Date(now.getTime() - 1000),
          expiresAt: new Date(now.getTime() + 23 * 60 * 60 * 1000), // 23 hours from now
        },
        {
          authorStudentId: "2025CS1001",
          media: {
            url: "https://example.com/story2.jpg",
            cloudinaryPublicId:
              "college/2025-CS/dept-CS/section-A/student-2025CS1001/story2",
            type: "image",
          },
          createdAt: new Date(now.getTime() - 2000),
          expiresAt: new Date(now.getTime() + 22 * 60 * 60 * 1000), // 22 hours from now
        },
        {
          authorStudentId: "2025ECE1001",
          media: {
            url: "https://example.com/story3.jpg",
            cloudinaryPublicId:
              "college/2025-ECE/dept-ECE/section-B/student-2025ECE1001/story3",
            type: "image",
          },
          createdAt: new Date(now.getTime() - 3000),
          expiresAt: new Date(now.getTime() + 21 * 60 * 60 * 1000), // 21 hours from now
        },
        {
          authorStudentId: "2025CS1001",
          media: {
            url: "https://example.com/expired.jpg",
            cloudinaryPublicId:
              "college/2025-CS/dept-CS/section-A/student-2025CS1001/expired",
            type: "image",
          },
          createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
          expiresAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // Expired 1 hour ago
        },
        {
          authorStudentId: "2025CS1001",
          media: {
            url: "https://example.com/inactive.jpg",
            cloudinaryPublicId:
              "college/2025-CS/dept-CS/section-A/student-2025CS1001/inactive",
            type: "image",
          },
          isActive: false,
        },
      ];

      await Story.insertMany(stories);
    });

    test("should find stories by author", async () => {
      const stories = await Story.findByAuthor("2025CS1001");
      expect(stories).toHaveLength(2); // Only active, non-expired stories

      const storyUrls = stories.map((s) => s.media.url);
      expect(storyUrls).toContain("https://example.com/story1.jpg");
      expect(storyUrls).toContain("https://example.com/story2.jpg");
      expect(storyUrls).not.toContain("https://example.com/expired.jpg");
      expect(storyUrls).not.toContain("https://example.com/inactive.jpg");
    });

    test("should find active stories", async () => {
      const stories = await Story.findActiveStories();
      expect(stories).toHaveLength(3); // All active, non-expired stories
    });

    test("should get stories feed", async () => {
      const feed = await Story.getStoriesFeed({ limit: 10 });
      expect(feed).toHaveLength(3); // All active, non-expired stories
    });

    test("should get stories feed with author filter", async () => {
      const feed = await Story.getStoriesFeed({
        authorStudentIds: ["2025CS1001"],
        limit: 10,
      });
      expect(feed).toHaveLength(2); // Only CS1001's active, non-expired stories
    });

    test("should get story stats", async () => {
      // Add some views to stories
      const stories = await Story.findByAuthor("2025CS1001");
      if (stories.length > 0) {
        await stories[0].addView("2025ECE1001");
        await stories[0].addView("2025ME1001");
      }

      const stats = await Story.getStoryStats("2025CS1001");
      expect(stats).toHaveLength(1);
      expect(stats[0].totalStories).toBe(2);
      expect(stats[0].totalViews).toBeGreaterThanOrEqual(0);
    });

    test("should cleanup expired stories", async () => {
      const deletedCount = await Story.cleanupExpiredStories();
      expect(deletedCount.deletedCount).toBe(1); // One expired story

      const remainingStories = await Story.find({});
      expect(remainingStories).toHaveLength(4); // 4 remaining (3 active + 1 inactive)
    });
  });

  describe("TTL Functionality", () => {
    test("should set default expiration time", async () => {
      const story = new Story({
        authorStudentId: "2025CS1001",
        media: {
          url: "https://example.com/story.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/story",
          type: "image",
        },
      });

      const savedStory = await story.save();

      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(
        savedStory.expiresAt.getTime() - expectedExpiry.getTime()
      );

      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    test("should respect custom expiration time", async () => {
      const customExpiry = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

      const story = new Story({
        authorStudentId: "2025CS1001",
        media: {
          url: "https://example.com/story.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/story",
          type: "image",
        },
        expiresAt: customExpiry,
      });

      const savedStory = await story.save();
      expect(savedStory.expiresAt.getTime()).toBe(customExpiry.getTime());
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Story.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(
        indexNames.some((name) => name.includes("authorStudentId_1"))
      ).toBe(true);
      expect(indexNames.some((name) => name.includes("createdAt_-1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("expiresAt_1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("isActive_1"))).toBe(true);
    });
  });
});
