// MongoDB initialization script for college social media app
db = db.getSiblingDB("college-social-media");

// Create collections with validation
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["studentId", "displayName", "year", "department", "section"],
      properties: {
        studentId: {
          bsonType: "string",
          description: "Student ID must be a string and is required",
        },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Email must be a valid email address",
        },
        displayName: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "Display name must be a string between 1-100 characters",
        },
        year: {
          bsonType: "int",
          minimum: 1,
          maximum: 4,
          description: "Year must be an integer between 1-4",
        },
        department: {
          bsonType: "string",
          minLength: 1,
          description: "Department must be a non-empty string",
        },
        section: {
          bsonType: "string",
          minLength: 1,
          description: "Section must be a non-empty string",
        },
      },
    },
  },
});

// Create indexes for users collection
db.users.createIndex({ studentId: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ year: 1, department: 1, section: 1 });

// Create posts collection
db.createCollection("posts");
db.posts.createIndex({ createdAt: -1 });
db.posts.createIndex({ authorStudentId: 1 });
db.posts.createIndex({ "$**": "text" });

// Create stories collection with TTL
db.createCollection("stories");
db.stories.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Create topics collection
db.createCollection("topics");
db.topics.createIndex({ createdAt: -1 });
db.topics.createIndex({ votes: -1 });
db.topics.createIndex({ tags: 1 });

// Create conversations and messages collections
db.createCollection("conversations");
db.conversations.createIndex({ participants: 1, updatedAt: -1 });

db.createCollection("messages");
db.messages.createIndex({ conversationId: 1, createdAt: -1 });

// Create notifications collection
db.createCollection("notifications");
db.notifications.createIndex({ toStudentId: 1, createdAt: -1 });

print("Database initialized successfully with collections and indexes");
