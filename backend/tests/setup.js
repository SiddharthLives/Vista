// Test setup file
const mongoose = require("mongoose");

// Set test environment
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://localhost:27017/college-social-media-test";

// Global test setup
beforeAll(async () => {
  // Connect to test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

// Clean up after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Global test teardown
afterAll(async () => {
  // Close database connection
  await mongoose.connection.close();
});
