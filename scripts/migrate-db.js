#!/usr/bin/env node

/**
 * Database Migration Script for Vista Platform
 * Creates indexes, collections, and performs data migrations
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

const logger = console;

// Import models to ensure schemas are registered
require("../backend/models/User");
require("../backend/models/Post");
require("../backend/models/Story");
require("../backend/models/Topic");
require("../backend/models/Comment");
require("../backend/models/Conversation");
require("../backend/models/Message");
require("../backend/models/Notification");

/**
 * Database migration configuration
 */
const MIGRATIONS = [
  {
    version: "1.0.0",
    description: "Initial database setup with indexes",
    up: async () => {
      await createInitialIndexes();
      await createCollections();
    },
  },
  {
    version: "1.1.0",
    description: "Add text search indexes",
    up: async () => {
      await createTextSearchIndexes();
    },
  },
  {
    version: "1.2.0",
    description: "Add performance optimization indexes",
    up: async () => {
      await createPerformanceIndexes();
    },
  },
];

/**
 * Main migration function
 */
async function migrate() {
  try {
    logger.log("🚀 Starting database migration...");

    // Connect to MongoDB
    await connectToDatabase();

    // Get current migration version
    const currentVersion = await getCurrentMigrationVersion();
    logger.log(`📊 Current migration version: ${currentVersion || "none"}`);

    // Run pending migrations
    const pendingMigrations = MIGRATIONS.filter(
      (migration) => !currentVersion || migration.version > currentVersion
    );

    if (pendingMigrations.length === 0) {
      logger.log("✅ No pending migrations");
      return;
    }

    logger.log(`📋 Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      logger.log(
        `⚡ Running migration ${migration.version}: ${migration.description}`
      );

      try {
        await migration.up();
        await updateMigrationVersion(migration.version);
        logger.log(`✅ Migration ${migration.version} completed`);
      } catch (error) {
        logger.error(`❌ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    logger.log("🎉 All migrations completed successfully");
  } catch (error) {
    logger.error("💥 Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Connect to MongoDB
 */
async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  logger.log("🔌 Connecting to MongoDB...");

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  logger.log("✅ Connected to MongoDB");
}

/**
 * Get current migration version from database
 */
async function getCurrentMigrationVersion() {
  try {
    const db = mongoose.connection.db;
    const migrations = db.collection("migrations");
    const result = await migrations.findOne({}, { sort: { version: -1 } });
    return result ? result.version : null;
  } catch (error) {
    // Collection doesn't exist yet
    return null;
  }
}

/**
 * Update migration version in database
 */
async function updateMigrationVersion(version) {
  const db = mongoose.connection.db;
  const migrations = db.collection("migrations");

  await migrations.insertOne({
    version,
    appliedAt: new Date(),
    appliedBy: "migration-script",
  });
}

/**
 * Create initial database indexes
 */
async function createInitialIndexes() {
  const db = mongoose.connection.db;

  logger.log("📝 Creating initial indexes...");

  // Users collection indexes
  await db.collection("users").createIndex({ studentId: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { sparse: true });
  await db
    .collection("users")
    .createIndex({ year: 1, department: 1, section: 1 });
  await db.collection("users").createIndex({ createdAt: -1 });

  // Posts collection indexes
  await db.collection("posts").createIndex({ createdAt: -1 });
  await db.collection("posts").createIndex({ authorStudentId: 1 });
  await db.collection("posts").createIndex({ visibility: 1, createdAt: -1 });
  await db.collection("posts").createIndex({ tags: 1 });

  // Stories collection indexes (with TTL)
  await db
    .collection("stories")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("stories").createIndex({ authorStudentId: 1 });
  await db.collection("stories").createIndex({ createdAt: -1 });

  // Topics collection indexes
  await db.collection("topics").createIndex({ createdAt: -1 });
  await db.collection("topics").createIndex({ votes: -1 });
  await db.collection("topics").createIndex({ tags: 1 });
  await db.collection("topics").createIndex({ authorStudentId: 1 });

  // Comments collection indexes
  await db.collection("comments").createIndex({ postId: 1, createdAt: -1 });
  await db.collection("comments").createIndex({ topicId: 1, createdAt: -1 });
  await db.collection("comments").createIndex({ authorStudentId: 1 });

  // Conversations collection indexes
  await db.collection("conversations").createIndex({ participants: 1 });
  await db.collection("conversations").createIndex({ updatedAt: -1 });

  // Messages collection indexes
  await db
    .collection("messages")
    .createIndex({ conversationId: 1, createdAt: -1 });
  await db.collection("messages").createIndex({ senderStudentId: 1 });

  // Notifications collection indexes
  await db
    .collection("notifications")
    .createIndex({ toStudentId: 1, createdAt: -1 });
  await db
    .collection("notifications")
    .createIndex({ isRead: 1, createdAt: -1 });

  logger.log("✅ Initial indexes created");
}

/**
 * Create collections if they don't exist
 */
async function createCollections() {
  const db = mongoose.connection.db;
  const collections = [
    "users",
    "posts",
    "stories",
    "topics",
    "comments",
    "conversations",
    "messages",
    "notifications",
  ];

  logger.log("📁 Creating collections...");

  for (const collectionName of collections) {
    try {
      await db.createCollection(collectionName);
      logger.log(`✅ Created collection: ${collectionName}`);
    } catch (error) {
      if (error.code === 48) {
        // Collection already exists
        logger.log(`ℹ️  Collection already exists: ${collectionName}`);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Create text search indexes
 */
async function createTextSearchIndexes() {
  const db = mongoose.connection.db;

  logger.log("🔍 Creating text search indexes...");

  // Posts text search
  await db.collection("posts").createIndex(
    {
      text: "text",
      "author.displayName": "text",
    },
    {
      name: "posts_text_search",
      weights: {
        text: 10,
        "author.displayName": 5,
      },
    }
  );

  // Topics text search
  await db.collection("topics").createIndex(
    {
      title: "text",
      body: "text",
      tags: "text",
    },
    {
      name: "topics_text_search",
      weights: {
        title: 10,
        body: 5,
        tags: 3,
      },
    }
  );

  // Users text search
  await db.collection("users").createIndex(
    {
      displayName: "text",
      studentId: "text",
      bio: "text",
    },
    {
      name: "users_text_search",
      weights: {
        displayName: 10,
        studentId: 8,
        bio: 3,
      },
    }
  );

  logger.log("✅ Text search indexes created");
}

/**
 * Create performance optimization indexes
 */
async function createPerformanceIndexes() {
  const db = mongoose.connection.db;

  logger.log("⚡ Creating performance optimization indexes...");

  // Compound indexes for common queries
  await db.collection("posts").createIndex({
    visibility: 1,
    authorStudentId: 1,
    createdAt: -1,
  });

  await db.collection("posts").createIndex({
    tags: 1,
    createdAt: -1,
  });

  await db.collection("topics").createIndex({
    tags: 1,
    votes: -1,
  });

  await db.collection("notifications").createIndex({
    toStudentId: 1,
    isRead: 1,
    createdAt: -1,
  });

  // Sparse indexes for optional fields
  await db.collection("users").createIndex({ fcmTokens: 1 }, { sparse: true });
  await db
    .collection("posts")
    .createIndex({ "media.cloudinaryPublicId": 1 }, { sparse: true });

  logger.log("✅ Performance optimization indexes created");
}

/**
 * Rollback function (for future use)
 */
async function rollback(targetVersion) {
  logger.log(`🔄 Rolling back to version ${targetVersion}...`);
  // Implementation for rollback functionality
  // This would require storing rollback scripts for each migration
  logger.log("⚠️  Rollback functionality not implemented yet");
}

/**
 * List all migrations and their status
 */
async function listMigrations() {
  try {
    await connectToDatabase();

    const currentVersion = await getCurrentMigrationVersion();

    logger.log("\n📋 Migration Status:");
    logger.log("==================");

    for (const migration of MIGRATIONS) {
      const status =
        !currentVersion || migration.version > currentVersion
          ? "❌ Pending"
          : "✅ Applied";
      logger.log(`${status} ${migration.version}: ${migration.description}`);
    }

    logger.log(`\nCurrent version: ${currentVersion || "none"}`);
  } catch (error) {
    logger.error("Error listing migrations:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case "up":
    case "migrate":
      migrate();
      break;
    case "list":
    case "status":
      listMigrations();
      break;
    case "rollback":
      const targetVersion = process.argv[3];
      if (!targetVersion) {
        logger.error("Please specify target version for rollback");
        process.exit(1);
      }
      rollback(targetVersion);
      break;
    default:
      logger.log(`
Usage: node migrate-db.js <command>

Commands:
  up, migrate    Run pending migrations
  list, status   List all migrations and their status
  rollback <v>   Rollback to specific version (not implemented)

Examples:
  node migrate-db.js migrate
  node migrate-db.js list
  node migrate-db.js rollback 1.0.0
      `);
  }
}

module.exports = {
  migrate,
  rollback,
  listMigrations,
};
