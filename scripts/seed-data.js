#!/usr/bin/env node

/**
 * Database Seeding Script for Vista Platform
 * Creates initial data for development and testing
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });

// Import models
const User = require("../backend/models/User");
const Post = require("../backend/models/Post");
const Topic = require("../backend/models/Topic");
const Comment = require("../backend/models/Comment");

const logger = console;

/**
 * Sample data for seeding
 */
const SAMPLE_USERS = [
  {
    studentId: "ADMIN001",
    email: "admin@college.edu",
    displayName: "System Administrator",
    year: 4,
    department: "CS",
    section: "A",
    bio: "System administrator for Vista platform",
    role: "admin",
  },
  {
    studentId: "2025CS1001",
    email: "john.doe@college.edu",
    displayName: "John Doe",
    year: 1,
    department: "CS",
    section: "A",
    bio: "Computer Science student passionate about web development",
  },
  {
    studentId: "2025CS1002",
    email: "jane.smith@college.edu",
    displayName: "Jane Smith",
    year: 1,
    department: "CS",
    section: "A",
    bio: "Aspiring software engineer and AI enthusiast",
  },
  {
    studentId: "2024EE2001",
    email: "mike.johnson@college.edu",
    displayName: "Mike Johnson",
    year: 2,
    department: "EE",
    section: "B",
    bio: "Electrical Engineering student interested in robotics",
  },
  {
    studentId: "2023ME3001",
    email: "sarah.wilson@college.edu",
    displayName: "Sarah Wilson",
    year: 3,
    department: "ME",
    section: "A",
    bio: "Mechanical Engineering student and sports enthusiast",
  },
];

const SAMPLE_POSTS = [
  {
    authorStudentId: "2025CS1001",
    type: "text",
    text: "Welcome to Vista! Excited to connect with fellow students here. 🎉",
    visibility: "public",
    tags: ["welcome", "introduction"],
  },
  {
    authorStudentId: "2025CS1002",
    type: "text",
    text: "Just finished my first programming assignment. JavaScript is pretty cool! 💻",
    visibility: "dept",
    tags: ["programming", "javascript", "assignment"],
  },
  {
    authorStudentId: "2024EE2001",
    type: "text",
    text: "Working on a cool robotics project for my circuits class. Anyone interested in collaborating?",
    visibility: "public",
    tags: ["robotics", "circuits", "collaboration"],
  },
  {
    authorStudentId: "2023ME3001",
    type: "text",
    text: "Beautiful sunset from the engineering building today! 🌅",
    visibility: "public",
    tags: ["campus", "sunset", "engineering"],
  },
];

const SAMPLE_TOPICS = [
  {
    title: "Best study spots on campus?",
    body: "I'm looking for quiet places to study on campus. The library gets pretty crowded during exam season. Any recommendations for good study spots?",
    authorStudentId: "2025CS1001",
    tags: ["study", "campus", "recommendations"],
  },
  {
    title: "Programming study group for CS101",
    body: "Anyone interested in forming a study group for CS101? We could meet weekly to work on assignments and prepare for exams together.",
    authorStudentId: "2025CS1002",
    tags: ["study-group", "cs101", "programming"],
  },
  {
    title: "Campus food recommendations",
    body: "New to campus and wondering about the best places to eat. What are your favorite spots for lunch between classes?",
    authorStudentId: "2024EE2001",
    tags: ["food", "campus", "recommendations"],
  },
  {
    title: "Internship opportunities for engineering students",
    body: "Has anyone found good internship opportunities for engineering students? Looking for advice on where to apply and how to prepare.",
    authorStudentId: "2023ME3001",
    tags: ["internship", "engineering", "career"],
  },
];

/**
 * Main seeding function
 */
async function seedDatabase() {
  try {
    logger.log("🌱 Starting database seeding...");

    // Connect to MongoDB
    await connectToDatabase();

    // Check if data already exists
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      logger.log(
        "⚠️  Database already contains data. Use --force to override."
      );
      if (!process.argv.includes("--force")) {
        return;
      }
      logger.log("🗑️  Clearing existing data...");
      await clearExistingData();
    }

    // Seed data
    await seedUsers();
    await seedPosts();
    await seedTopics();
    await seedComments();

    logger.log("🎉 Database seeding completed successfully!");
  } catch (error) {
    logger.error("💥 Seeding failed:", error);
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
 * Clear existing data
 */
async function clearExistingData() {
  await User.deleteMany({});
  await Post.deleteMany({});
  await Topic.deleteMany({});
  await Comment.deleteMany({});
  logger.log("✅ Existing data cleared");
}

/**
 * Seed users
 */
async function seedUsers() {
  logger.log("👥 Seeding users...");

  const users = [];

  for (const userData of SAMPLE_USERS) {
    const user = new User({
      ...userData,
      createdAt: new Date(),
      joinedAt: new Date(),
      settings: {
        notifications: true,
      },
    });

    users.push(user);
  }

  await User.insertMany(users);
  logger.log(`✅ Created ${users.length} users`);
}

/**
 * Seed posts
 */
async function seedPosts() {
  logger.log("📝 Seeding posts...");

  const posts = [];

  for (const postData of SAMPLE_POSTS) {
    const post = new Post({
      ...postData,
      createdAt: new Date(),
      likesCount: Math.floor(Math.random() * 10),
      commentsCount: Math.floor(Math.random() * 5),
    });

    posts.push(post);
  }

  await Post.insertMany(posts);
  logger.log(`✅ Created ${posts.length} posts`);
}

/**
 * Seed topics
 */
async function seedTopics() {
  logger.log("💬 Seeding topics...");

  const topics = [];

  for (const topicData of SAMPLE_TOPICS) {
    const topic = new Topic({
      ...topicData,
      createdAt: new Date(),
      votes: Math.floor(Math.random() * 20) - 5, // Random votes between -5 and 15
      commentsCount: Math.floor(Math.random() * 8),
    });

    topics.push(topic);
  }

  await Topic.insertMany(topics);
  logger.log(`✅ Created ${topics.length} topics`);
}

/**
 * Seed comments
 */
async function seedComments() {
  logger.log("💭 Seeding comments...");

  // Get some posts and topics to comment on
  const posts = await Post.find().limit(2);
  const topics = await Topic.find().limit(2);

  const comments = [];

  // Comments on posts
  for (const post of posts) {
    const comment = new Comment({
      postId: post._id,
      authorStudentId: "2025CS1002",
      text: "Great post! Thanks for sharing.",
      createdAt: new Date(),
    });
    comments.push(comment);
  }

  // Comments on topics
  for (const topic of topics) {
    const comment = new Comment({
      topicId: topic._id,
      authorStudentId: "2024EE2001",
      text: "I have some experience with this. Happy to help!",
      createdAt: new Date(),
    });
    comments.push(comment);
  }

  if (comments.length > 0) {
    await Comment.insertMany(comments);
    logger.log(`✅ Created ${comments.length} comments`);
  }
}

/**
 * Create admin user
 */
async function createAdminUser() {
  try {
    logger.log("👑 Creating admin user...");

    await connectToDatabase();

    // Check if admin already exists
    const existingAdmin = await User.findOne({ studentId: "ADMIN001" });
    if (existingAdmin) {
      logger.log("ℹ️  Admin user already exists");
      return;
    }

    const adminUser = new User({
      studentId: "ADMIN001",
      email: "admin@college.edu",
      displayName: "System Administrator",
      year: 4,
      department: "ADMIN",
      section: "A",
      bio: "System administrator for Vista platform",
      role: "admin",
      createdAt: new Date(),
      joinedAt: new Date(),
      settings: {
        notifications: true,
      },
    });

    await adminUser.save();
    logger.log("✅ Admin user created successfully");
  } catch (error) {
    logger.error("Error creating admin user:", error);
  } finally {
    await mongoose.disconnect();
  }
}

/**
 * Generate sample roster CSV
 */
function generateRosterCSV() {
  logger.log("📊 Generating sample roster CSV...");

  const fs = require("fs");
  const csvPath = path.join(__dirname, "sample-roster.csv");

  let csvContent = "studentId,email,year,department,section\n";

  // Generate 100 sample students
  const departments = ["CS", "EE", "ME", "CE", "IT"];
  const sections = ["A", "B", "C"];

  for (let i = 1; i <= 100; i++) {
    const year = Math.floor(Math.random() * 4) + 1;
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const section = sections[Math.floor(Math.random() * sections.length)];
    const studentId = `${2025 - year + 1}${dept}${String(i).padStart(4, "0")}`;
    const email = `student${i}@college.edu`;

    csvContent += `${studentId},${email},${year},${dept},${section}\n`;
  }

  fs.writeFileSync(csvPath, csvContent);
  logger.log(`✅ Sample roster CSV generated: ${csvPath}`);
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case "seed":
    case "all":
      seedDatabase();
      break;
    case "admin":
      createAdminUser();
      break;
    case "roster":
      generateRosterCSV();
      break;
    case "clear":
      clearExistingData().then(() => {
        logger.log("✅ Database cleared");
        mongoose.disconnect();
      });
      break;
    default:
      logger.log(`
Usage: node seed-data.js <command>

Commands:
  seed, all      Seed all sample data
  admin          Create admin user only
  roster         Generate sample roster CSV
  clear          Clear all data

Options:
  --force        Override existing data

Examples:
  node seed-data.js seed
  node seed-data.js seed --force
  node seed-data.js admin
  node seed-data.js roster
      `);
  }
}

module.exports = {
  seedDatabase,
  createAdminUser,
  generateRosterCSV,
  clearExistingData,
};
