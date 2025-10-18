const Topic = require("../../src/models/Topic");

describe("Topic Model", () => {
  beforeEach(async () => {
    await Topic.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validTopicData = {
      title: "Test Topic",
      body: "This is a test topic for discussion",
      authorStudentId: "2025CS1001",
      tags: ["test", "discussion"],
    };

    test("should create a valid topic", async () => {
      const topic = new Topic(validTopicData);
      const savedTopic = await topic.save();

      expect(savedTopic._id).toBeDefined();
      expect(savedTopic.title).toBe("Test Topic");
      expect(savedTopic.body).toBe("This is a test topic for discussion");
      expect(savedTopic.authorStudentId).toBe("2025CS1001");
      expect(savedTopic.tags).toEqual(["test", "discussion"]);
      expect(savedTopic.votes).toBe(0);
      expect(savedTopic.commentsCount).toBe(0);
      expect(savedTopic.viewsCount).toBe(0);
      expect(savedTopic.isActive).toBe(true);
      expect(savedTopic.isPinned).toBe(false);
      expect(savedTopic.createdAt).toBeDefined();
    });

    test("should require title", async () => {
      const topicData = { ...validTopicData };
      delete topicData.title;

      const topic = new Topic(topicData);
      await expect(topic.save()).rejects.toThrow("Topic title is required");
    });

    test("should validate title length", async () => {
      const shortTitle = new Topic({ ...validTopicData, title: "A" });
      await expect(shortTitle.save()).rejects.toThrow(
        "Title must be at least 5 characters"
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

      const longBody = new Topic({
        ...validTopicData,
        body: "A".repeat(5001),
      });
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

    test("should limit number of tags", async () => {
      const topic = new Topic({
        ...validTopicData,
        tags: Array(11).fill("tag"),
      });
      await expect(topic.save()).rejects.toThrow(
        "Cannot have more than 10 tags"
      );
    });

    test("should normalize and deduplicate tags", async () => {
      const topic = new Topic({
        ...validTopicData,
        tags: ["  Test  ", "DISCUSSION", "test", "discussion", ""],
      });
      const savedTopic = await topic.save();

      expect(savedTopic.tags).toEqual(["test", "discussion"]);
    });

    test("should trim title and body", async () => {
      const topic = new Topic({
        ...validTopicData,
        title: "  Trimmed Title  ",
        body: "  Trimmed body content  ",
      });
      const savedTopic = await topic.save();

      expect(savedTopic.title).toBe("Trimmed Title");
      expect(savedTopic.body).toBe("Trimmed body content");
    });
  });

  describe("Instance Methods", () => {
    let topic;

    beforeEach(async () => {
      topic = new Topic({
        title: "Test Topic",
        body: "This is a test topic for discussion",
        authorStudentId: "2025CS1001",
        tags: ["test"],
      });
      await topic.save();
    });

    test("should upvote topic", async () => {
      await topic.upvote("2025CS1002");
      expect(topic.votes).toBe(1);
      expect(topic.upvotedBy).toContain("2025CS1002");
    });

    test("should not allow duplicate upvotes", async () => {
      await topic.upvote("2025CS1002");
      await topic.upvote("2025CS1002");
      expect(topic.votes).toBe(1);
      expect(topic.upvotedBy).toHaveLength(1);
    });

    test("should remove upvote", async () => {
      await topic.upvote("2025CS1002");
      await topic.removeUpvote("2025CS1002");
      expect(topic.votes).toBe(0);
      expect(topic.upvotedBy).not.toContain("2025CS1002");
    });

    test("should downvote topic", async () => {
      await topic.downvote("2025CS1002");
      expect(topic.votes).toBe(-1);
      expect(topic.downvotedBy).toContain("2025CS1002");
    });

    test("should not allow duplicate downvotes", async () => {
      await topic.downvote("2025CS1002");
      await topic.downvote("2025CS1002");
      expect(topic.votes).toBe(-1);
      expect(topic.downvotedBy).toHaveLength(1);
    });

    test("should remove downvote", async () => {
      await topic.downvote("2025CS1002");
      await topic.removeDownvote("2025CS1002");
      expect(topic.votes).toBe(0);
      expect(topic.downvotedBy).not.toContain("2025CS1002");
    });

    test("should switch from upvote to downvote", async () => {
      await topic.upvote("2025CS1002");
      await topic.downvote("2025CS1002");
      expect(topic.votes).toBe(-1);
      expect(topic.upvotedBy).not.toContain("2025CS1002");
      expect(topic.downvotedBy).toContain("2025CS1002");
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

    test("should increment views", async () => {
      await topic.incrementViews("2025CS1002");
      expect(topic.viewsCount).toBe(1);
      expect(topic.viewedBy).toContain("2025CS1002");
    });

    test("should not increment views for same user", async () => {
      await topic.incrementViews("2025CS1002");
      await topic.incrementViews("2025CS1002");
      expect(topic.viewsCount).toBe(1);
      expect(topic.viewedBy).toHaveLength(1);
    });

    test("should add tag", async () => {
      await topic.addTag("newtag");
      expect(topic.tags).toContain("newtag");
    });

    test("should not add duplicate tag", async () => {
      await topic.addTag("test");
      expect(topic.tags.filter((t) => t === "test")).toHaveLength(1);
    });

    test("should remove tag", async () => {
      topic.tags = ["test", "remove"];
      await topic.save();

      await topic.removeTag("remove");
      expect(topic.tags).not.toContain("remove");
      expect(topic.tags).toContain("test");
    });

    test("should pin and unpin topic", async () => {
      await topic.pin();
      expect(topic.isPinned).toBe(true);
      expect(topic.pinnedAt).toBeDefined();

      await topic.unpin();
      expect(topic.isPinned).toBe(false);
      expect(topic.pinnedAt).toBeNull();
    });

    test("should mark as inactive", async () => {
      await topic.markAsInactive();
      expect(topic.isActive).toBe(false);
    });

    test("should check if user has voted", () => {
      topic.upvotedBy = ["2025CS1002"];
      topic.downvotedBy = ["2025CS1003"];

      expect(topic.hasUserVoted("2025CS1002")).toBe(true);
      expect(topic.hasUserVoted("2025CS1003")).toBe(true);
      expect(topic.hasUserVoted("2025CS1004")).toBe(false);
    });

    test("should get user vote type", () => {
      topic.upvotedBy = ["2025CS1002"];
      topic.downvotedBy = ["2025CS1003"];

      expect(topic.getUserVoteType("2025CS1002")).toBe("upvote");
      expect(topic.getUserVoteType("2025CS1003")).toBe("downvote");
      expect(topic.getUserVoteType("2025CS1004")).toBeNull();
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const topics = [
        {
          title: "First Topic",
          body: "This is the first topic",
          authorStudentId: "2025CS1001",
          tags: ["test", "first"],
          votes: 5,
          createdAt: new Date(Date.now() - 1000),
        },
        {
          title: "Second Topic",
          body: "This is the second topic",
          authorStudentId: "2025CS1002",
          tags: ["test", "second"],
          votes: 3,
          createdAt: new Date(Date.now() - 2000),
        },
        {
          title: "Popular Topic",
          body: "This is a popular topic",
          authorStudentId: "2025CS1001",
          tags: ["popular"],
          votes: 10,
          isPinned: true,
          createdAt: new Date(Date.now() - 3000),
        },
        {
          title: "Inactive Topic",
          body: "This is an inactive topic",
          authorStudentId: "2025CS1003",
          tags: ["inactive"],
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
      expect(topicTitles).toContain("Popular Topic");
    });

    test("should find topics by tags", async () => {
      const topics = await Topic.findByTags(["test"]);
      expect(topics).toHaveLength(2);
    });

    test("should find popular topics", async () => {
      const topics = await Topic.findPopular({ limit: 2 });
      expect(topics).toHaveLength(2);
      expect(topics[0].title).toBe("Popular Topic"); // Highest votes first
      expect(topics[1].title).toBe("First Topic");
    });

    test("should find recent topics", async () => {
      const topics = await Topic.findRecent({ limit: 2 });
      expect(topics).toHaveLength(2);
      expect(topics[0].title).toBe("First Topic"); // Newest first
      expect(topics[1].title).toBe("Second Topic");
    });

    test("should find pinned topics", async () => {
      const topics = await Topic.findPinned();
      expect(topics).toHaveLength(1);
      expect(topics[0].title).toBe("Popular Topic");
    });

    test("should search topics by text", async () => {
      const topics = await Topic.searchTopics("first");
      expect(topics).toHaveLength(1);
      expect(topics[0].title).toBe("First Topic");
    });

    test("should get trending topics", async () => {
      const topics = await Topic.getTrending({ limit: 2 });
      expect(topics).toHaveLength(2);
      // Should be ordered by recent activity and votes
    });

    test("should get topic stats", async () => {
      const stats = await Topic.getTopicStats("2025CS1001");
      expect(stats.totalTopics).toBe(2);
      expect(stats.totalVotes).toBe(15); // 5 + 10
      expect(stats.totalComments).toBe(0);
    });
  });

  describe("Pre-save Middleware", () => {
    test("should update updatedAt timestamp", async () => {
      const topic = new Topic({
        title: "Test Topic",
        body: "This is a test topic",
        authorStudentId: "2025CS1001",
      });
      await topic.save();

      const originalUpdatedAt = topic.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      topic.title = "Updated Title";
      await topic.save();

      expect(topic.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });
  });

  describe("Virtuals", () => {
    test("should generate slug virtual", async () => {
      const topic = new Topic({
        title: "Test Topic for Slug",
        body: "This is a test topic",
        authorStudentId: "2025CS1001",
      });

      expect(topic.slug).toBe("test-topic-for-slug");
    });

    test("should calculate vote score", async () => {
      const topic = new Topic({
        title: "Test Topic",
        body: "This is a test topic",
        authorStudentId: "2025CS1001",
        votes: 5,
        viewsCount: 100,
        commentsCount: 10,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      });

      const score = topic.voteScore;
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThan(0);
    });

    test("should check if topic is trending", async () => {
      const trendingTopic = new Topic({
        title: "Trending Topic",
        body: "This is trending",
        authorStudentId: "2025CS1001",
        votes: 10,
        viewsCount: 200,
        commentsCount: 20,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      });
      expect(trendingTopic.isTrending).toBe(true);

      const oldTopic = new Topic({
        title: "Old Topic",
        body: "This is old",
        authorStudentId: "2025CS1001",
        votes: 1,
        viewsCount: 10,
        commentsCount: 1,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      });
      expect(oldTopic.isTrending).toBe(false);
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
      expect(indexNames.some((name) => name.includes("tags_1"))).toBe(true);
      expect(
        indexNames.some((name) => name.includes("authorStudentId_1"))
      ).toBe(true);
      expect(indexNames.some((name) => name.includes("isPinned_-1"))).toBe(
        true
      );
    });
  });
});
