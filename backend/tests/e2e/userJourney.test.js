const request = require("supertest");
const app = require("../../src/server");
const User = require("../../src/models/User");
const Post = require("../../src/models/Post");
const Topic = require("../../src/models/Topic");
const Comment = require("../../src/models/Comment");
const Conversation = require("../../src/models/Conversation");
const Message = require("../../src/models/Message");
const Notification = require("../../src/models/Notification");
const jwtService = require("../../src/services/jwtService");

describe("End-to-End User Journey Tests", () => {
  let authToken1, authToken2, authToken3;
  let user1, user2, user3;

  beforeEach(async () => {
    // Clean up all collections
    await User.deleteMany({});
    await Post.deleteMany({});
    await Topic.deleteMany({});
    await Comment.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Notification.deleteMany({});

    // Create test users
    user1 = new User({
      studentId: "2025CS1001",
      email: "alice@college.edu",
      displayName: "Alice Johnson",
      year: 3,
      department: "CS",
      section: "A",
      bio: "Computer Science student interested in AI",
    });
    await user1.save();

    user2 = new User({
      studentId: "2025CS1002",
      email: "bob@college.edu",
      displayName: "Bob Smith",
      year: 3,
      department: "CS",
      section: "A",
      bio: "Full-stack developer and CS student",
    });
    await user2.save();

    user3 = new User({
      studentId: "2025ECE1001",
      email: "carol@college.edu",
      displayName: "Carol Davis",
      year: 2,
      department: "ECE",
      section: "B",
      bio: "Electronics enthusiast",
    });
    await user3.save();

    // Generate auth tokens
    authToken1 = jwtService.generateToken({
      studentId: user1.studentId,
      email: user1.email,
    });
    authToken2 = jwtService.generateToken({
      studentId: user2.studentId,
      email: user2.email,
    });
    authToken3 = jwtService.generateToken({
      studentId: user3.studentId,
      email: user3.email,
    });
  });

  describe("Complete Social Media Journey", () => {
    it("should complete a full user interaction flow", async () => {
      // Step 1: Alice creates a post
      const postResponse = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "Just finished my AI project! Excited to share the results 🤖",
          visibility: "public",
          tags: ["ai", "project", "cs"],
        })
        .expect(201);

      const alicePost = postResponse.body.post;
      expect(alicePost.text).toContain("AI project");
      expect(alicePost.tags).toContain("ai");

      // Step 2: Bob discovers Alice's post in the feed
      const feedResponse = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(feedResponse.body.posts).toHaveLength(1);
      expect(feedResponse.body.posts[0]._id).toBe(alicePost._id);

      // Step 3: Bob likes Alice's post
      const likeResponse = await request(app)
        .post(`/posts/${alicePost._id}/like`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(likeResponse.body.likesCount).toBe(1);

      // Step 4: Bob comments on Alice's post
      const commentResponse = await request(app)
        .post(`/posts/${alicePost._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          text: "That's awesome Alice! Would love to hear more about your approach.",
        })
        .expect(201);

      const bobComment = commentResponse.body.comment;
      expect(bobComment.text).toContain("awesome Alice");

      // Step 5: Carol also discovers and interacts with the post
      await request(app)
        .post(`/posts/${alicePost._id}/like`)
        .set("Authorization", `Bearer ${authToken3}`)
        .expect(200);

      await request(app)
        .post(`/posts/${alicePost._id}/comment`)
        .set("Authorization", `Bearer ${authToken3}`)
        .send({
          text: "Great work! The intersection of AI and electronics is fascinating.",
        })
        .expect(201);

      // Step 6: Alice checks her notifications
      const notificationsResponse = await request(app)
        .get("/notifications")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(notificationsResponse.body.notifications.length).toBeGreaterThan(
        0
      );
      const notificationTypes = notificationsResponse.body.notifications.map(
        (n) => n.type
      );
      expect(notificationTypes).toContain("like");
      expect(notificationTypes).toContain("comment");

      // Step 7: Alice views the updated post with interactions
      const updatedPostResponse = await request(app)
        .get(`/posts/${alicePost._id}`)
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(updatedPostResponse.body.post.likesCount).toBe(2);
      expect(updatedPostResponse.body.post.commentsCount).toBe(2);

      // Step 8: Alice creates a topic for discussion
      const topicResponse = await request(app)
        .post("/topics")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          title: "Best practices for AI model deployment in production",
          body: "I've been working on deploying my AI models and wondering what approaches others have found successful. What tools and strategies do you recommend?",
          tags: ["ai", "deployment", "production", "discussion"],
        })
        .expect(201);

      const aliceTopic = topicResponse.body.topic;
      expect(aliceTopic.title).toContain("AI model deployment");

      // Step 9: Bob finds and engages with the topic
      const topicsResponse = await request(app)
        .get("/topics")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(topicsResponse.body.topics).toHaveLength(1);
      expect(topicsResponse.body.topics[0]._id).toBe(aliceTopic._id);

      // Step 10: Bob upvotes the topic
      await request(app)
        .post(`/topics/${aliceTopic._id}/vote`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({ voteType: "upvote" })
        .expect(200);

      // Step 11: Bob comments on the topic
      await request(app)
        .post(`/topics/${aliceTopic._id}/comment`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          text: "I've had good success with Docker containers and Kubernetes for scaling. Also recommend monitoring with Prometheus.",
        })
        .expect(201);

      // Step 12: Alice starts a direct conversation with Bob
      const conversationResponse = await request(app)
        .post("/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "direct",
          participants: [user2.studentId],
        })
        .expect(201);

      const conversation = conversationResponse.body.conversation;
      expect(conversation.participants).toContain(user1.studentId);
      expect(conversation.participants).toContain(user2.studentId);

      // Step 13: Alice sends a message to Bob
      const messageResponse = await request(app)
        .post(`/conversations/${conversation._id}/messages`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          text: "Hi Bob! Thanks for the helpful comment on my topic. Would you be interested in collaborating on a project?",
        })
        .expect(201);

      const aliceMessage = messageResponse.body.message;
      expect(aliceMessage.text).toContain("collaborating");

      // Step 14: Bob checks his conversations
      const bobConversationsResponse = await request(app)
        .get("/conversations")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(bobConversationsResponse.body.conversations).toHaveLength(1);
      expect(bobConversationsResponse.body.conversations[0]._id).toBe(
        conversation._id
      );

      // Step 15: Bob replies to Alice
      await request(app)
        .post(`/conversations/${conversation._id}/messages`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          text: "Hi Alice! Absolutely, I'd love to collaborate. What kind of project did you have in mind?",
        })
        .expect(201);

      // Step 16: Alice creates a story
      const storyResponse = await request(app)
        .post("/stories")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          media: {
            url: "https://res.cloudinary.com/test/image/upload/v123/college/year-3/dept-CS/section-A/student-2025CS1001/story.jpg",
            cloudinaryPublicId:
              "college/year-3/dept-CS/section-A/student-2025CS1001/story",
            type: "image",
            width: 800,
            height: 600,
          },
        })
        .expect(201);

      const aliceStory = storyResponse.body.story;
      expect(aliceStory.authorStudentId).toBe(user1.studentId);

      // Step 17: Bob views Alice's story
      const storiesResponse = await request(app)
        .get("/stories")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(storiesResponse.body.stories).toHaveLength(1);
      expect(storiesResponse.body.stories[0]._id).toBe(aliceStory._id);

      // Step 18: Verify final state - Alice's profile shows activity
      const aliceProfileResponse = await request(app)
        .get(`/users/${user1.studentId}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(aliceProfileResponse.body.user.displayName).toBe("Alice Johnson");
      expect(aliceProfileResponse.body.user.bio).toContain("AI");

      // Step 19: Verify Bob can search for Alice's content
      const searchResponse = await request(app)
        .get("/posts?search=AI project")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(searchResponse.body.posts).toHaveLength(1);
      expect(searchResponse.body.posts[0]._id).toBe(alicePost._id);

      // Step 20: Verify notification system worked
      const finalNotificationsResponse = await request(app)
        .get("/notifications")
        .set("Authorization", `Bearer ${authToken1}`)
        .expect(200);

      expect(
        finalNotificationsResponse.body.notifications.length
      ).toBeGreaterThan(2);
    });
  });

  describe("Group Conversation Journey", () => {
    it("should handle group conversation creation and management", async () => {
      // Step 1: Alice creates a group conversation
      const groupResponse = await request(app)
        .post("/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "group",
          participants: [user2.studentId, user3.studentId],
          groupName: "AI Study Group",
        })
        .expect(201);

      const group = groupResponse.body.conversation;
      expect(group.type).toBe("group");
      expect(group.groupName).toBe("AI Study Group");
      expect(group.participants).toHaveLength(3);

      // Step 2: Alice sends a welcome message
      await request(app)
        .post(`/conversations/${group._id}/messages`)
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          text: "Welcome to our AI study group! Let's share resources and collaborate on projects.",
        })
        .expect(201);

      // Step 3: Bob and Carol respond
      await request(app)
        .post(`/conversations/${group._id}/messages`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          text: "Great idea Alice! I have some good ML resources to share.",
        })
        .expect(201);

      await request(app)
        .post(`/conversations/${group._id}/messages`)
        .set("Authorization", `Bearer ${authToken3}`)
        .send({
          text: "Excited to learn! I'm particularly interested in neural networks for signal processing.",
        })
        .expect(201);

      // Step 4: Verify all participants can see the conversation
      for (const token of [authToken1, authToken2, authToken3]) {
        const conversationsResponse = await request(app)
          .get("/conversations")
          .set("Authorization", `Bearer ${token}`)
          .expect(200);

        expect(conversationsResponse.body.conversations).toHaveLength(1);
        expect(conversationsResponse.body.conversations[0].groupName).toBe(
          "AI Study Group"
        );
      }

      // Step 5: Verify message history
      const messagesResponse = await request(app)
        .get(`/conversations/${group._id}/messages`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(messagesResponse.body.messages).toHaveLength(3);
      expect(messagesResponse.body.messages[0].text).toContain(
        "signal processing"
      ); // Newest first
    });
  });

  describe("Content Moderation Journey", () => {
    it("should handle content reporting and moderation", async () => {
      // Step 1: Alice creates a post
      const postResponse = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "This is a normal post about studying",
          visibility: "public",
        })
        .expect(201);

      const post = postResponse.body.post;

      // Step 2: Bob reports the post (simulating inappropriate content)
      const reportResponse = await request(app)
        .post(`/posts/${post._id}/report`)
        .set("Authorization", `Bearer ${authToken2}`)
        .send({
          reason: "spam",
          description: "This appears to be spam content",
        })
        .expect(201);

      expect(reportResponse.body.message).toBe("Report submitted successfully");

      // Step 3: Verify the report was created
      const reportsResponse = await request(app)
        .get("/admin/reports")
        .set("Authorization", `Bearer ${authToken1}`) // Assuming Alice has admin privileges for this test
        .expect(200);

      expect(reportsResponse.body.reports).toHaveLength(1);
      expect(reportsResponse.body.reports[0].reason).toBe("spam");
    });
  });

  describe("Search and Discovery Journey", () => {
    beforeEach(async () => {
      // Create diverse content for search testing
      const posts = [
        {
          authorStudentId: user1.studentId,
          type: "text",
          text: "Machine learning algorithms are fascinating",
          visibility: "public",
          tags: ["ml", "algorithms"],
        },
        {
          authorStudentId: user2.studentId,
          type: "text",
          text: "Web development with React and Node.js",
          visibility: "public",
          tags: ["web", "react", "nodejs"],
        },
        {
          authorStudentId: user3.studentId,
          type: "text",
          text: "Signal processing in digital communications",
          visibility: "public",
          tags: ["signals", "communications"],
        },
      ];

      await Post.insertMany(posts);

      const topics = [
        {
          title: "Best machine learning frameworks",
          body: "What are your favorite ML frameworks and why?",
          authorStudentId: user1.studentId,
          tags: ["ml", "frameworks"],
        },
        {
          title: "React vs Vue.js comparison",
          body: "Comparing modern frontend frameworks",
          authorStudentId: user2.studentId,
          tags: ["frontend", "react", "vue"],
        },
      ];

      await Topic.insertMany(topics);
    });

    it("should provide comprehensive search functionality", async () => {
      // Step 1: Search for posts by text
      const postSearchResponse = await request(app)
        .get("/posts?search=machine learning")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(postSearchResponse.body.posts).toHaveLength(1);
      expect(postSearchResponse.body.posts[0].text).toContain(
        "Machine learning"
      );

      // Step 2: Search for posts by tags
      const tagSearchResponse = await request(app)
        .get("/posts?tags=web,react")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(tagSearchResponse.body.posts).toHaveLength(1);
      expect(tagSearchResponse.body.posts[0].tags).toContain("react");

      // Step 3: Search for topics
      const topicSearchResponse = await request(app)
        .get("/topics?search=frameworks")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(topicSearchResponse.body.topics).toHaveLength(2);

      // Step 4: Search for users
      const userSearchResponse = await request(app)
        .get("/users/search?q=Alice")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(userSearchResponse.body.users).toHaveLength(1);
      expect(userSearchResponse.body.users[0].displayName).toBe(
        "Alice Johnson"
      );

      // Step 5: Filter users by department
      const deptFilterResponse = await request(app)
        .get("/users?department=CS")
        .set("Authorization", `Bearer ${authToken3}`)
        .expect(200);

      expect(deptFilterResponse.body.users).toHaveLength(2);
      deptFilterResponse.body.users.forEach((user) => {
        expect(user.department).toBe("CS");
      });
    });
  });

  describe("Real-time Features Journey", () => {
    it("should handle real-time interactions", async () => {
      // This test would typically require WebSocket testing
      // For now, we'll test the HTTP endpoints that support real-time features

      // Step 1: Create a conversation
      const conversationResponse = await request(app)
        .post("/conversations")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "direct",
          participants: [user2.studentId],
        })
        .expect(201);

      const conversation = conversationResponse.body.conversation;

      // Step 2: Send messages rapidly (simulating real-time chat)
      const messages = [
        "Hey Bob, are you online?",
        "I wanted to discuss the project",
        "Let me know when you're free",
      ];

      for (const messageText of messages) {
        await request(app)
          .post(`/conversations/${conversation._id}/messages`)
          .set("Authorization", `Bearer ${authToken1}`)
          .send({ text: messageText })
          .expect(201);
      }

      // Step 3: Bob checks messages
      const messagesResponse = await request(app)
        .get(`/conversations/${conversation._id}/messages`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(messagesResponse.body.messages).toHaveLength(3);

      // Step 4: Bob marks conversation as read
      await request(app)
        .patch(`/conversations/${conversation._id}/read`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      // Step 5: Verify read status
      const updatedConversationResponse = await request(app)
        .get(`/conversations/${conversation._id}`)
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      expect(updatedConversationResponse.body.conversation.readBy).toContain(
        user2.studentId
      );
    });
  });

  describe("Privacy and Visibility Journey", () => {
    it("should respect content visibility settings", async () => {
      // Step 1: Alice creates posts with different visibility levels
      const publicPost = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "Public post - everyone can see this",
          visibility: "public",
        })
        .expect(201);

      const yearPost = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "Year-only post - only 3rd year students",
          visibility: "year",
        })
        .expect(201);

      const deptPost = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "Department post - only CS students",
          visibility: "dept",
        })
        .expect(201);

      const sectionPost = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${authToken1}`)
        .send({
          type: "text",
          text: "Section post - only CS-A students",
          visibility: "section",
        })
        .expect(201);

      // Step 2: Bob (same year, dept, different section) checks feed
      const bobFeedResponse = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${authToken2}`)
        .expect(200);

      const bobVisiblePosts = bobFeedResponse.body.posts;
      const bobPostTexts = bobVisiblePosts.map((p) => p.text);

      expect(bobPostTexts).toContain("Public post - everyone can see this");
      expect(bobPostTexts).toContain("Year-only post - only 3rd year students");
      expect(bobPostTexts).toContain("Department post - only CS students");
      expect(bobPostTexts).not.toContain("Section post - only CS-A students"); // Different section

      // Step 3: Carol (different year, different dept) checks feed
      const carolFeedResponse = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${authToken3}`)
        .expect(200);

      const carolVisiblePosts = carolFeedResponse.body.posts;
      const carolPostTexts = carolVisiblePosts.map((p) => p.text);

      expect(carolPostTexts).toContain("Public post - everyone can see this");
      expect(carolPostTexts).not.toContain(
        "Year-only post - only 3rd year students"
      );
      expect(carolPostTexts).not.toContain(
        "Department post - only CS students"
      );
      expect(carolPostTexts).not.toContain("Section post - only CS-A students");

      // Step 4: Unauthenticated user checks feed (only public posts)
      const publicFeedResponse = await request(app).get("/posts").expect(200);

      const publicPosts = publicFeedResponse.body.posts;
      const publicPostTexts = publicPosts.map((p) => p.text);

      expect(publicPostTexts).toContain("Public post - everyone can see this");
      expect(publicPostTexts).not.toContain(
        "Year-only post - only 3rd year students"
      );
      expect(publicPostTexts).not.toContain(
        "Department post - only CS students"
      );
      expect(publicPostTexts).not.toContain(
        "Section post - only CS-A students"
      );
    });
  });
});
