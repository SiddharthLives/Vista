const request = require("supertest");
const { app } = require("../src/server");

describe("Server Setup", () => {
  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toHaveProperty("status", "OK");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("environment");
    });
  });

  describe("GET /", () => {
    it("should return API information", async () => {
      const response = await request(app).get("/").expect(200);

      expect(response.body).toHaveProperty(
        "message",
        "College Social Media API"
      );
      expect(response.body).toHaveProperty("version", "1.0.0");
      expect(response.body).toHaveProperty("status", "running");
    });
  });

  describe("GET /nonexistent", () => {
    it("should return 404 for non-existent routes", async () => {
      const response = await request(app).get("/nonexistent").expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("code", "NOT_FOUND");
      expect(response.body.error).toHaveProperty("message", "Route not found");
    });
  });
});
