const Post = require("../../src/models/Post");

describe("Post Model", () => {
  beforeEach(async () => {
    await Post.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validImagePostData = {
      authorStudentId: "2025CS1001",
      type: "image",
      media: [
        {
          url: "https://res.cloudinary.com/test/image/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/photo.jpg",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/photo",
          width: 800,
          height: 600,
        },
      ],
      text: "Check out this photo!",
      visibility: "public",
      tags: ["campus", "photo"],
    };

    const validTextPostData = {
      authorStudentId: "2025CS1001",
      type: "text",
      text: "This is a text post",
      visibility: "public",
    };

    const validVideoPostData = {
      authorStudentId: "2025CS1001",
      type: "video",
      media: [
        {
          url: "https://res.cloudinary.com/test/video/upload/v123/college/2025-CS/dept-CS/section-A/student-2025CS1001/video.mp4",
          cloudinaryPublicId:
            "college/2025-CS/dept-CS/section-A/student-2025CS1001/video",
          width: 1920,
          height: 1080,
          duration: 30.5,
        },
      ],
      text: "Check out this video!",
      visibility: "year",
    };

    test("should create a valid image post", async () => {
      const post = new Post(validImagePostData);
      const savedPost = await post.save();

      expect(savedPost._id).toBeDefined();
      expect(savedPost.authorStudentId).toBe("2025CS1001");
      expect(savedPost.type).toBe("image");
      expect(savedPost.media).toHaveLength(1);
      expect(savedPost.media[0].url).toBe(validImagePostData.media[0].url);
      expect(savedPost.text).toBe("Check out this photo!");
      expect(savedPost.visibility).toBe("public");
      expect(savedPost.tags).toEqual(["campus", "photo"]);
      expect(savedPost.likesCount).toBe(0);
      expect(savedPost.commentsCount).toBe(0);
      expect(savedPost.isActive).toBe(true);
      expect(savedPost.createdAt).toBeDefined();
    });

    test("should create a valid text post", async () => {
      const post = new Post(validTextPostData);
      const savedPost = await post.save();

      expect(savedPost.type).toBe("text");
      expect(savedPost.text).toBe("This is a text post");
      expect(savedPost.media).toHaveLength(0);
    });

    test("should create a valid video post", async () => {
      const post = new Post(validVideoPostData);
      const savedPost = await post.save();

      expect(savedPost.type).toBe("video");
      expect(savedPost.media[0].duration).toBe(30.5);
      expect(savedPost.visibility).toBe("year");
    });

    test("should require authorStudentId", async () => {
      const postData = { ...validTextPostData };
      delete postData.authorStudentId;

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow(
        "Author student ID is required"
      );
    });

    test("should validate authorStudentId format", async () => {
      const invalidIds = ["invalid", "2025CS", "CS1001", "25CS1001"];

      for (const invalidId of invalidIds) {
        const post = new Post({
          ...validTextPostData,
          authorStudentId: invalidId,
        });
        await expect(post.save()).rejects.toThrow(
          "Author student ID must follow format"
        );
      }
    });

    test("should require post type", async () => {
      const postData = { ...validTextPostData };
      delete postData.type;

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow("Post type is required");
    });

    test("should validate post type enum", async () => {
      const post = new Post({ ...validTextPostData, type: "invalid" });
      await expect(post.save()).rejects.toThrow("Post type must be one of");
    });

    test("should validate media URL format", async () => {
      const postData = {
        ...validImagePostData,
        media: [
          {
            ...validImagePostData.media[0],
            url: "invalid-url",
          },
        ],
      };

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow(
        "Media URL must be a valid HTTP/HTTPS URL"
      );
    });

    test("should validate cloudinary public ID format", async () => {
      const postData = {
        ...validImagePostData,
        media: [
          {
            ...validImagePostData.media[0],
            cloudinaryPublicId: "invalid/path",
          },
        ],
      };

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow(
        "Cloudinary public ID must follow college folder structure"
      );
    });

    test("should validate media dimensions", async () => {
      const postData = {
        ...validImagePostData,
        media: [
          {
            ...validImagePostData.media[0],
            width: -1,
            height: 0,
          },
        ],
      };

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow("Width must be positive");
    });

    test("should validate text length", async () => {
      const post = new Post({
        ...validTextPostData,
        text: "A".repeat(2001),
      });
      await expect(post.save()).rejects.toThrow(
        "Post text cannot exceed 2000 characters"
      );
    });

    test("should validate visibility enum", async () => {
      const post = new Post({ ...validTextPostData, visibility: "invalid" });
      await expect(post.save()).rejects.toThrow("Visibility must be one of");
    });

    test("should validate tag format", async () => {
      const post = new Post({
        ...validTextPostData,
        tags: ["valid-tag", "Invalid Tag!", "123"],
      });
      await expect(post.save()).rejects.toThrow(
        "Tags can only contain lowercase letters"
      );
    });

    test("should validate tag length", async () => {
      const post = new Post({
        ...validTextPostData,
        tags: ["a".repeat(51)],
      });
      await expect(post.save()).rejects.toThrow(
        "Tag cannot exceed 50 characters"
      );
    });

    test("should validate duration only for video posts", async () => {
      const postData = {
        ...validImagePostData,
        media: [
          {
            ...validImagePostData.media[0],
            duration: 30,
          },
        ],
      };

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow(
        "Duration can only be specified for video posts"
      );
    });

    test("should require media for image posts", async () => {
      const postData = {
        ...validImagePostData,
        media: [],
      };

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow(
        "image posts must have at least one media item"
      );
    });

    test("should require media for video posts", async () => {
      const postData = {
        ...validVideoPostData,
        media: [],
      };

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow(
        "video posts must have at least one media item"
      );
    });

    test("should require text for text posts", async () => {
      const postData = {
        ...validTextPostData,
        text: "",
      };

      const post = new Post(postData);
      await expect(post.save()).rejects.toThrow(
        "Text posts must have text content"
      );
    });

    test("should normalize and deduplicate tags", async () => {
      const post = new Post({
        ...validTextPostData,
        tags: ["  Campus  ", "PHOTO", "campus", "photo", ""],
      });
      const savedPost = await post.save();

      expect(savedPost.tags).toEqual(["campus", "photo"]);
    });

    test("should trim text content", async () => {
      const post = new Post({
        ...validTextPostData,
        text: "  This is trimmed text  ",
      });
      const savedPost = await post.save();

      expect(savedPost.text).toBe("This is trimmed text");
    });
  });

  describe("Instance Methods", () => {
    let post;

    beforeEach(async () => {
      post = new Post({
        authorStudentId: "2025CS1001",
        type: "text",
        text: "Test post",
        visibility: "public",
      });
      await post.save();
    });

    test("should increment likes", async () => {
      await post.incrementLikes();
      expect(post.likesCount).toBe(1);

      await post.incrementLikes();
      expect(post.likesCount).toBe(2);
    });

    test("should decrement likes", async () => {
      post.likesCount = 5;
      await post.save();

      await post.decrementLikes();
      expect(post.likesCount).toBe(4);
    });

    test("should not decrement likes below zero", async () => {
      await post.decrementLikes();
      expect(post.likesCount).toBe(0);
    });

    test("should increment comments", async () => {
      await post.incrementComments();
      expect(post.commentsCount).toBe(1);
    });

    test("should decrement comments", async () => {
      post.commentsCount = 3;
      await post.save();

      await post.decrementComments();
      expect(post.commentsCount).toBe(2);
    });

    test("should not decrement comments below zero", async () => {
      await post.decrementComments();
      expect(post.commentsCount).toBe(0);
    });

    test("should add tags", async () => {
      await post.addTag("NewTag");
      expect(post.tags).toContain("newtag");
    });

    test("should not add duplicate tags", async () => {
      await post.addTag("test");
      await post.addTag("TEST");
      expect(post.tags.filter((t) => t === "test")).toHaveLength(1);
    });

    test("should remove tags", async () => {
      post.tags = ["test", "remove"];
      await post.save();

      await post.removeTag("remove");
      expect(post.tags).not.toContain("remove");
      expect(post.tags).toContain("test");
    });

    test("should check visibility permissions", () => {
      // Public post should be viewable by anyone
      expect(post.canBeViewedBy("2025ECE1001", 2, "ECE", "B")).toBe(true);

      // Year visibility
      post.visibility = "year";
      expect(post.canBeViewedBy("2025CS1002", 3, "CS", "A")).toBe(false); // Different year

      // Section visibility
      post.visibility = "section";
      expect(post.canBeViewedBy("2025CS1002", 3, "CS", "A")).toBe(false); // Same year/dept/section but different logic
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const posts = [
        {
          authorStudentId: "2025CS1001",
          type: "text",
          text: "First post",
          visibility: "public",
          tags: ["test", "first"],
        },
        {
          authorStudentId: "2025CS1001",
          type: "text",
          text: "Second post",
          visibility: "year",
          tags: ["test", "second"],
        },
        {
          authorStudentId: "2025ECE1001",
          type: "text",
          text: "Third post",
          visibility: "public",
          tags: ["different"],
        },
        {
          authorStudentId: "2025CS1001",
          type: "text",
          text: "Inactive post",
          visibility: "public",
          isActive: false,
        },
      ];

      await Post.insertMany(posts);
    });

    test("should find posts by author", async () => {
      const posts = await Post.findByAuthor("2025CS1001");
      expect(posts).toHaveLength(2); // Only active posts
      const postTexts = posts.map((p) => p.text);
      expect(postTexts).toContain("First post");
      expect(postTexts).toContain("Second post");
    });

    test("should find posts by visibility", async () => {
      const posts = await Post.findByVisibility("public");
      expect(posts).toHaveLength(2);
    });

    test("should find posts by tags", async () => {
      const posts = await Post.findByTags(["test"]);
      expect(posts).toHaveLength(2);
    });

    test("should search posts by text", async () => {
      const posts = await Post.searchPosts("First");
      expect(posts).toHaveLength(1);
      expect(posts[0].text).toBe("First post");
    });

    test("should get feed with filters", async () => {
      const feed = await Post.getFeed({
        visibility: "public",
        limit: 10,
      });
      expect(feed).toHaveLength(2);
    });

    test("should get feed with cursor pagination", async () => {
      const allPosts = await Post.find({ isActive: true }).sort({
        createdAt: -1,
      });
      const cursor = allPosts[0].createdAt.toISOString();

      const feed = await Post.getFeed({ cursor });
      expect(feed.length).toBeLessThan(allPosts.length);
    });
  });

  describe("Virtuals", () => {
    test("should generate slug virtual", async () => {
      const post = new Post({
        authorStudentId: "2025CS1001",
        type: "text",
        text: "Test post",
      });

      expect(post.slug).toBe(`2025CS1001-${post._id}`);
    });

    test("should check hasMedia virtual", async () => {
      const textPost = new Post({
        authorStudentId: "2025CS1001",
        type: "text",
        text: "Test post",
      });
      expect(textPost.hasMedia).toBe(false);

      const imagePost = new Post({
        authorStudentId: "2025CS1001",
        type: "image",
        media: [
          {
            url: "https://example.com/image.jpg",
            cloudinaryPublicId:
              "college/2025-CS/dept-CS/section-A/student-2025CS1001/image",
          },
        ],
      });
      expect(imagePost.hasMedia).toBe(true);
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await Post.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames.some((name) => name.includes("createdAt_-1"))).toBe(
        true
      );
      expect(
        indexNames.some((name) => name.includes("authorStudentId_1"))
      ).toBe(true);
      expect(indexNames.some((name) => name.includes("visibility_1"))).toBe(
        true
      );
      expect(indexNames.some((name) => name.includes("tags_1"))).toBe(true);
    });
  });
});
