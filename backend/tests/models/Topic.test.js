const Topic = require("../../src/models/Topic");

describe("Topic Model", () => {
  beforeEach(async () => {
    await Topic.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validTopicData = {
      title: "How to prepare for technical interviews?",
      body: "I'm looking for advice on how to prepare for technical interviews in software engineering. What resources would you recommend?",
      authorStudentId: "2025CS1001",
      tags: ["career", "interviews", "advice"],
    };

    test("should create a valid topic", async () => {
      const topic = new Topic(validTopicData);
      const savedTopic = await topic.save();

      expect(savedTopic._id).toBeDefined();
      expect(savedTopic.title).toBe(validTopicData.title);
      expect(savedTopic.body).toBe(validTopicData.body);
      expect(savedTopic.authorStudentId).toBe("2025CS1001");
      expect(savedTopic.tags).toEqual(["career", "interviews", "advice"]);
      expect(savedTopic.votes).toBe(0);
      expect(savedTopic.upvotes).toBe(0);
      expect(savedTopic.downvotes).toBe(0);
      expect(savedTopic.commentsCount).toBe(0);
      expect(savedTopic.isActive).toBe(true);
      expect(savedTopic.isPinned).toBe(false);
      expect(savedTopic.isLocked).toBe(false);
      expect(savedTopic.createdAt).toBeDefined();
    });

    test("should require title", async () => {
      const topicData = { ...validTopicData };
      delete topicData.title;

      const topic = new Topic(topicData);
      await expect(topic.save()).rejects.toThrow("Topic title is required");
    });

    test("should validate title length", async () => {
      const shortTitle = new Topic({ ...validTopicData, title: "Hi" });
      await expect(shortTitle.save()).rejects.toThrow(
        "Title must be at least 3 characters"
      );

      const longTitle = new Topic({
        ...validTopicData,
        title: "A".repeat(201),
      });
      await expect(longTitle.save()).rejects.toThrow(
        "Title cannot exceed 200 characters"
      );
    });

    test("should require body", async () => {
      const topicData = { ...validTopicData };
      delete topicData.body;

      const topic = new Topic(topicData);
      await expect(topic.save()).rejects.toThrow("Topic body is required");
    });

    test("should validate body length", async () => {
      const shortBody = new Topic({ ...validTopicData, body: "Short" });
      await expect(shortBody.save()).rejects.toThrow(
        "Body must be at least 10 characters"
      );

      const longBody = new Topic({ ...validTopicData, body: "A".repeat(5001) });
      await expect(longBody.save()).rejects.toThrow(
        "Body cannot exceed 5000 characters"
      );
    });

    test("should require authorStudentId", async () => {
      const topicData = { ...validTopicData };
      delete topicData.authorStudentId;

      const topic = new Topic(topicData);
      await expect(topic.save()).rejects.toThrow(
        "Author student ID is required"
      );
    });

    test("should validate authorStudentId format", async () => {
      const invalidIds = ["invalid", "2025CS", "CS1001", "25CS1001"];

      for (const invalidId of invalidIds) {
        const topic = new Topic({
          ...validTopicData,
          authorStudentId: invalidId,
        });
        await expect(topic.save()).rejects.toThrow(
          "Author student ID must follow format"
        );
      }
    });

    test("should validate tag format", async () => {
      const topic = new Topic({
        ...validTopicData,
        tags: ["valid-tag", "Invalid Tag!", "123"],
      });
      await expect(topic.save()).rejects.toThrow(
        "Tags can only contain lowercase letters"
      );
    });

    test("should validate tag length", async () => {
      const topic = new Topic({
        ...validTopicData,
        tags: ["a".repeat(51)],
      });
      await expect(topic.save()).rejects.toThrow(
        "Tag cannot exceed 50 characters"
      );
    });

    test("should normalize and deduplicate tags", async () => {
      const topic = new Topic({
        ...validTopicData,
        tags: ["  Career  ", "INTERVIEWS", "career", "advice", ""],
      });
      const savedTopic = await topic.save();

      expect(savedTopic.tags).toEqual(["career", "interviews", "advice"]);
    });

    test("should trim title and body", async () => {
      const topic = new Topic({
        ...validTopicData,
        title: "  Trimmed Title  ",
        body: "  This is trimmed body content that is long enough to pass validation  ",
      });
      const savedTopic = await topic.save();

      expect(savedTopic.title).toBe("Trimmed Title");
      expect(savedTopic.body).toBe(
        "This is trimmed body content that is long enough to pass validation"
      );
    });
  });

  describe("Instance Methods", () => {
    let topic;

    beforeEach(async () => {
      topic = new Topic({
        title: "Test Topic",
        body: "This is a test topic for testing instance methods",
        authorStudentId: "2025CS1001",
        tags: ["test"],
      });
      await topic.save();
    });

    test("should upvote topic", async () => {
      await topic.upvote();
      expect(topic.upvotes).toBe(1);
      expect(topic.votes).toBe(1);
    });

    test("should downvote topic", async () => {
      await topic.downvote();
      expect(topic.downvotes).toBe(1);
      expect(topic.votes).toBe(-1);
    });

    test("should remove upvote", async () => {
      topic.upvotes = 3;
      await topic.save();

      await topic.removeUpvote();
      expect(topic.upvotes).toBe(2);
      expect(topic.votes).toBe(2);
    });

    test("should not remove upvote below zero", async () => {
      await topic.removeUpvote();
      expect(topic.upvotes).toBe(0);
    });

    test("should remove downvote", async () => {
      topic.downvotes = 2;
      await topic.save();

      await topic.removeDownvote();
      expect(topic.downvotes).toBe(1);
      expect(topic.votes).toBe(-1);
    });

    test("should increment comments", async () => {
      await topic.incrementComments();
      expect(topic.commentsCount).toBe(1);
    });

    test("should decrement comments", async () => {
      topic.commentsCount = 5;
      await topic.save();

      await topic.decrementComments();
      expect(topic.commentsCount).toBe(4);
    });

    test("should not decrement comments below zero", async () => {
      await topic.decrementComments();
      expect(topic.commentsCount).toBe(0);
    });

    test("should add tags", async () => {
      await topic.addTag("NewTag");
      expect(topic.tags).toContain("newtag");
    });

    test("should not add duplicate tags", async () => {
      await topic.addTag("test");
      await topic.addTag("TEST");
      expect(topic.tags.filter((t) => t === "test")).toHaveLength(1);
    });

    test("should remove tags", async () => {
      topic.tags = ["test", "remove", "keep"];
      await topic.save();

      await topic.removeTag("remove");
      expect(topic.tags).not.toContain("remove");
      expect(topic.tags).toContain("test");
      expect(topic.tags).toContain("keep");
    });

    test("should pin and unpin topic", async () => {
      await topic.pin();
      expect(topic.isPinned).toBe(true);

      await topic.unpin();
      expect(topic.isPinned).toBe(false);
    });

    test("should lock and unlock topic", async () => {
      await topic.lock();
      expect(topic.isLocked).toBe(true);

      await topic.unlock();
      expect(topic.isLocked).toBe(false);
    });
  });

  describe("Virtuals", () => {
    test("should generate slug virtual", async () => {
      const topic = new Topic({
        title: "How to Learn JavaScript Quickly?",
        body: "I need to learn JavaScript for my internship",
        authorStudentId: "2025CS1001",
      });

      const slug = topic.slug;
      expect(slug).toMatch(/^how-to-learn-javascript-quickly-[a-f0-9]{24}$/);
    });

    test("should calculate vote score", async () => {
      const topic = new Topic({
        title: "Test Topic",
        body: "This is a test topic for vote score calculation",
        authorStudentId: "2025CS1001",
        upvotes: 10,
        downvotes: 3,
      });

      expect(topic.voteScore).toBe(7);
    });

    test("should calculate engagement score", async () => {
      const topic = new Topic({
        title: "Test Topic",
        body: "This is a test topic for engagement score calculation",
        authorStudentId: "2025CS1001",
        votes: 5,
        commentsCount: 12,
      });

      expect(topic.engagementScore).toBe(17);
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const topics = [
        {
          title: "First Topic",
          body: "This is the first topic for testing static methods",
          authorStudentId: "2025CS1001",
          tags: ["test", "first"],
          votes: 10,
          upvotes: 12,
          downvotes: 2,
        },
        {
          title: "Second Topic",
          body: "This is the second topic for testing static methods",
          authorStudentId: "2025CS1001",
          tags: ["test", "second"],
          votes: 5,
          upvotes: 7,
          downvotes: 2,
        },
        {
          title: "Third Topic",
          body: "This is the third topic for testing static methods",
          authorStudentId: "2025ECE1001",
          tags: ["different"],
          votes: 15,
          upvotes: 16,
          downvotes: 1,
        },
        {
          title: "Inactive Topic",
          body: "This topic is inactive for testing purposes",
          authorStudentId: "2025CS1001",
          tags: ["test"],
          isActive: false,
        },
      ];

      await Topic.insertMany(topics);
    });

    test("should find topics by author", async () => {
      const topics = await Topic.findByAuthor("2025CS1001");
      expect(topics).toHaveLength(2); // Only active topics

      const topicTitles = topics.map((t) => t.title);
      expect(topicTitles).toContain("First Topic");
      expect(topicTitles).toContain("Second Topic");
      expect(topicTitles).not.toContain("Inactive Topic");
    });

    test("should find topics by tags", async () => {
      const topics = await Topic.findByTags(["test"]);
      expect(topics).toHaveLength(2);
    });

    test("should find popular topics", async () => {
      const topics = await Topic.findPopular();
      expect(topics).toHaveLength(3);
      expect(topics[0].title).toBe("Third Topic"); // Highest votes first
    });

    test("should search topics by text", async () => {
      const topics = await Topic.searchTopics("First");
      expect(topics).toHaveLength(1);
      expect(topics[0].title).toBe("First Topic");
    });

    test("should get topics feed with recent sort", async () => {
      const feed = await Topic.getTopicsFeed({
        sortBy: "recent",
        limit: 10,
      });
      expect(feed).toHaveLength(3);
    });

    test("should get topics feed with popular sort", async () => {
      const feed = await Topic.getTopicsFeed({
        sortBy: "popular",
        limit: 10,
      });
      expect(feed).toHaveLength(3);
      expect(feed[0].title).toBe("Third Topic"); // Highest votes first
    });

    test("should get topics feed with tag filter", async () => {
      const feed = await Topic.getTopicsFeed({
        tags: ["test"],
        limit: 10,
      });
      expect(feed).toHaveLength(2);
    });

    test("should get topics feed with author filter", async () => {
      const feed = await Topic.getTopicsFeed({
        authorStudentId: "2025ECE1001",
        limit: 10,
      });
      expect(feed).toHaveLength(1);
      expect(feed[0].title).toBe("Third Topic");
    });
  });

  describe("Pre-save Middleware", () => {
    test("should recalculate votes from upvotes and downvotes", async () => {
      const topic = new Topic({
        title: "Vote Test Topic",
        body: "This topic is for testing vote calculation",
        authorStudentId: "2025CS1001",
        upvotes: 8,
        downvotes: 3,
      });

      const savedTopic = await topic.save();
      expect(savedTopic.votes).toBe(5); // 8 - 3
    });

    test("should update updatedAt timestamp", async () => {
      const topic = new Topic({
        title: "Update Test Topic",
        body: "This topic is for testing timestamp updates",
        authorStudentId: "2025CS1001",
      });

      const savedTopic = await topic.save();
      const originalUpdatedAt = savedTopic.updatedAt;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      savedTopic.title = "Updated Title";
      await savedTopic.save();

      expect(savedTopic.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Topic.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames.some((name) => name.includes("createdAt_-1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("votes_-1"))).toBe(true);
      expect(
        indexNames.some((name) => name.includes("authorStudentId_1"))
      ).toBe(true);
      expect(indexNames.some((name) => name.includes("tags_1"))).toBe(true);
    });
  });
});
