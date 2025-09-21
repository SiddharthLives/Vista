const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../src/server");
const User = require("../../src/models/User");
const Post = require("../../src/models/Post");
const Report = require("../../src/models/Report");
const jwtService = require("../../src/services/jwtService");

describe("Admin Routes Integration Tests", () => {
  let adminToken;
  let regularUserToken;
  let adminUser;
  let regularUser;

  beforeAll(async () => {
    // Create admin user
    adminUser = new User({
      studentId: "2025AD0001",
      email: "admin@admin.college.edu",
      displayName: "Admin User",
      year: 4,
      department: "CS",
      section: "A",
      isActive: true,
    });
    await adminUser.save();

    // Create regular user
    regularUser = new User({
      studentId: "2025CS0001",
      email: "student@college.edu",
      displayName: "Regular Student",
      year: 2,
      department: "CS",
      section: "B",
      isActive: true,
    });
    await regularUser.save();

    // Generate tokens
    adminToken = jwtService.generateToken({
      studentId: adminUser.studentId,
      email: adminUser.email,
      uid: "admin-uid",
    });

    regularUserToken = jwtService.generateToken({
      studentId: regularUser.studentId,
      email: regularUser.email,
      uid: "regular-uid",
    });

    // Set admin email in environment for testing
    process.env.ADMIN_EMAILS = "admin@admin.college.edu";
  });

  afterAll(async () => {
    await User.deleteMany({});
    delete process.env.ADMIN_EMAILS;
  });

  beforeEach(async () => {
    // Clean up any test users created during tests (except the admin and regular user)
    await User.deleteMany({
      studentId: { $nin: [adminUser.studentId, regularUser.studentId] },
    });

    // Ensure admin and regular users still exist
    const adminExists = await User.findOne({ studentId: adminUser.studentId });
    if (!adminExists) {
      const newAdminUser = new User({
        studentId: "2025AD0001",
        email: "admin@admin.college.edu",
        displayName: "Admin User",
        year: 4,
        department: "CS",
        section: "A",
        isActive: true,
      });
      await newAdminUser.save();
    }

    const regularExists = await User.findOne({
      studentId: regularUser.studentId,
    });
    if (!regularExists) {
      const newRegularUser = new User({
        studentId: "2025CS0001",
        email: "student@college.edu",
        displayName: "Regular Student",
        year: 2,
        department: "CS",
        section: "B",
        isActive: true,
      });
      await newRegularUser.save();
    }
  });

  describe("POST /admin/roster", () => {
    const validCsvData = `studentId,email,displayName,year,department,section
2025CS1001,student1@college.edu,John Doe,2,CS,A
2025ECE1002,student2@college.edu,Jane Smith,3,ECE,B
2025ME1003,student3@college.edu,Bob Johnson,1,ME,C`;

    it("should successfully upload valid roster data", async () => {
      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ csvData: validCsvData })
        .expect(200);

      expect(response.body.message).toBe("Roster upload completed");
      expect(response.body.summary.created).toBe(3);
      expect(response.body.summary.errors).toBe(0);
      expect(response.body.results).toHaveLength(3);

      // Verify users were created in database
      const createdUsers = await User.find({
        studentId: { $in: ["2025CS1001", "2025ECE1002", "2025ME1003"] },
      });
      expect(createdUsers).toHaveLength(3);
    });

    it("should reject access for non-admin users", async () => {
      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .send({ csvData: validCsvData })
        .expect(403);

      expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should reject requests without authentication", async () => {
      const response = await request(app)
        .post("/admin/roster")
        .send({ csvData: validCsvData })
        .expect(401);

      expect(response.body.error.code).toBe("MISSING_TOKEN");
    });

    it("should validate CSV data is provided", async () => {
      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should handle invalid student ID format", async () => {
      const invalidCsvData = `studentId,email,displayName,year,department,section
INVALID_ID,student1@college.edu,John Doe,2,CS,A`;

      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ csvData: invalidCsvData })
        .expect(200);

      expect(response.body.summary.created).toBe(0);
      expect(response.body.summary.errors).toBe(1);
      expect(response.body.errors[0].error).toBe("Invalid student ID format");
    });

    it("should handle invalid email format", async () => {
      const invalidCsvData = `studentId,email,displayName,year,department,section
2025CS1001,invalid-email,John Doe,2,CS,A`;

      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ csvData: invalidCsvData })
        .expect(200);

      expect(response.body.summary.created).toBe(0);
      expect(response.body.summary.errors).toBe(1);
      expect(response.body.errors[0].error).toBe("Invalid email format");
    });

    it("should handle invalid year values", async () => {
      const invalidCsvData = `studentId,email,displayName,year,department,section
2025CS1001,student1@college.edu,John Doe,5,CS,A`;

      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ csvData: invalidCsvData })
        .expect(200);

      expect(response.body.summary.created).toBe(0);
      expect(response.body.summary.errors).toBe(1);
      expect(response.body.errors[0].error).toBe(
        "Year must be between 1 and 4"
      );
    });

    it("should handle invalid department values", async () => {
      const invalidCsvData = `studentId,email,displayName,year,department,section
2025CS1001,student1@college.edu,John Doe,2,INVALID,A`;

      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ csvData: invalidCsvData })
        .expect(200);

      expect(response.body.summary.created).toBe(0);
      expect(response.body.summary.errors).toBe(1);
      expect(response.body.errors[0].error).toContain("Invalid department");
    });

    it("should handle duplicate student IDs", async () => {
      // First upload
      await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ csvData: validCsvData })
        .expect(200);

      // Second upload with same data
      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ csvData: validCsvData })
        .expect(200);

      expect(response.body.summary.created).toBe(0);
      expect(response.body.summary.skipped).toBe(3);
      expect(response.body.duplicates).toHaveLength(3);
    });

    it("should handle missing required fields", async () => {
      const invalidCsvData = `studentId,email,displayName,year,department,section
2025CS1001,,John Doe,2,CS,A`;

      const response = await request(app)
        .post("/admin/roster")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ csvData: invalidCsvData })
        .expect(200);

      expect(response.body.summary.created).toBe(0);
      expect(response.body.summary.errors).toBe(1);
      expect(response.body.errors[0].error).toBe("Missing required fields");
    });
  });

  describe("GET /admin/reports", () => {
    beforeEach(async () => {
      // Create some test data for reports
      const testUsers = [
        {
          studentId: "2025CS2001",
          email: "test1@college.edu",
          displayName: "Test User 1",
          year: 2,
          department: "CS",
          section: "A",
          isActive: true,
        },
        {
          studentId: "2025ECE2002",
          email: "test2@college.edu",
          displayName: "Test User 2",
          year: 3,
          department: "ECE",
          section: "B",
          isActive: true,
        },
      ];

      await User.insertMany(testUsers);
    });

    it("should generate reports for admin users", async () => {
      const response = await request(app)
        .get("/admin/reports")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe("Reports generated successfully");
      expect(response.body.reports).toBeDefined();
      expect(response.body.reports.users).toBeDefined();
      expect(response.body.reports.content).toBeDefined();
      expect(response.body.reports.activity).toBeDefined();
    });

    it("should reject access for non-admin users", async () => {
      const response = await request(app)
        .get("/admin/reports")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should filter reports by type", async () => {
      const response = await request(app)
        .get("/admin/reports?type=users")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.reports.users).toBeDefined();
      expect(response.body.reports.content).toBeUndefined();
      expect(response.body.reports.activity).toBeUndefined();
    });

    it("should validate date parameters", async () => {
      const response = await request(app)
        .get("/admin/reports?startDate=invalid-date")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should include user statistics in reports", async () => {
      const response = await request(app)
        .get("/admin/reports?type=users")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.reports.users.total).toBeGreaterThan(0);
      expect(response.body.reports.users.byYear).toBeDefined();
      expect(response.body.reports.users.byDepartment).toBeDefined();
    });
  });

  describe("GET /admin/export", () => {
    beforeEach(async () => {
      // Create test data for export
      const testUser = new User({
        studentId: "2025CS3001",
        email: "export-test@college.edu",
        displayName: "Export Test User",
        year: 2,
        department: "CS",
        section: "A",
        isActive: true,
      });
      await testUser.save();
    });

    it("should export user data in JSON format", async () => {
      const response = await request(app)
        .get("/admin/export?type=users&format=json")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain(
        "users data exported successfully"
      );
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it("should export user data in CSV format", async () => {
      const response = await request(app)
        .get("/admin/export?type=users&format=csv")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(response.headers["content-disposition"]).toContain(
        "users_export.csv"
      );
      expect(response.text).toContain("studentId,email,displayName");
    });

    it("should reject access for non-admin users", async () => {
      const response = await request(app)
        .get("/admin/export?type=users")
        .set("Authorization", `Bearer ${regularUserToken}`)
        .expect(403);

      expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should validate export type parameter", async () => {
      const response = await request(app)
        .get("/admin/export")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should handle invalid export type", async () => {
      const response = await request(app)
        .get("/admin/export?type=invalid")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Content Moderation", () => {
    let testPost;
    let testReport;

    beforeEach(async () => {
      // Create a test post for moderation
      testPost = new Post({
        authorStudentId: adminUser.studentId,
        type: "text",
        text: "This is a test post for moderation",
        visibility: "public",
      });
      await testPost.save();

      // Create a test report
      testReport = new Report({
        reporterStudentId: adminUser.studentId,
        reportedStudentId: regularUser.studentId,
        contentType: "post",
        contentId: testPost._id,
        reason: "inappropriate_content",
        description: "Test report for moderation",
      });
      await testReport.save();
    });

    afterEach(async () => {
      await Post.deleteMany({ _id: testPost._id });
      await Report.deleteMany({ _id: testReport._id });
    });

    describe("POST /admin/moderate", () => {
      it("should remove content successfully", async () => {
        const response = await request(app)
          .post("/admin/moderate")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            action: "remove_content",
            contentType: "post",
            contentId: testPost._id.toString(),
            reason: "Inappropriate content",
            notes: "Content removed for violating community guidelines",
          })
          .expect(200);

        expect(response.body.message).toBe(
          "Moderation action completed successfully"
        );
        expect(response.body.action).toBe("remove_content");
        expect(response.body.result.contentRemoved).toBe(true);

        // Verify content was marked as removed
        const updatedPost = await Post.findById(testPost._id);
        expect(updatedPost.isRemoved).toBe(true);
      });

      it("should suspend user successfully", async () => {
        const response = await request(app)
          .post("/admin/moderate")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            action: "suspend_user",
            userId: regularUser.studentId,
            reason: "Repeated violations",
            notes: "User suspended for 7 days",
          })
          .expect(200);

        expect(response.body.message).toBe(
          "Moderation action completed successfully"
        );
        expect(response.body.action).toBe("suspend_user");
        expect(response.body.result.userModerated).toBe(true);

        // Verify user was suspended
        const updatedUser = await User.findOne({
          studentId: regularUser.studentId,
        });
        expect(updatedUser.isActive).toBe(false);
        expect(updatedUser.suspendedAt).toBeDefined();
      });

      it("should reject invalid moderation action", async () => {
        const response = await request(app)
          .post("/admin/moderate")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            action: "invalid_action",
            contentType: "post",
            contentId: testPost._id.toString(),
          })
          .expect(400);

        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      });

      it("should reject access for non-admin users", async () => {
        const response = await request(app)
          .post("/admin/moderate")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({
            action: "remove_content",
            contentType: "post",
            contentId: testPost._id.toString(),
          })
          .expect(403);

        expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
      });
    });

    describe("GET /admin/reports/pending", () => {
      it("should get pending reports for admin users", async () => {
        const response = await request(app)
          .get("/admin/reports/pending")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.message).toBe(
          "Pending reports retrieved successfully"
        );
        expect(response.body.reports).toBeDefined();
        expect(Array.isArray(response.body.reports)).toBe(true);
        expect(response.body.pagination).toBeDefined();
      });

      it("should filter reports by content type", async () => {
        const response = await request(app)
          .get("/admin/reports/pending?contentType=post")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.reports).toBeDefined();
        if (response.body.reports.length > 0) {
          expect(response.body.reports[0].contentType).toBe("post");
        }
      });

      it("should reject access for non-admin users", async () => {
        const response = await request(app)
          .get("/admin/reports/pending")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .expect(403);

        expect(response.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
      });
    });

    describe("POST /admin/reports/:reportId/process", () => {
      it("should resolve report successfully", async () => {
        const response = await request(app)
          .post(`/admin/reports/${testReport._id}/process`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            action: "resolve",
            notes: "Report reviewed and resolved",
          })
          .expect(200);

        expect(response.body.message).toBe("Report resolved successfully");
        expect(response.body.report.status).toBe("resolved");

        // Verify report was updated
        const updatedReport = await Report.findById(testReport._id);
        expect(updatedReport.status).toBe("resolved");
        expect(updatedReport.moderatorStudentId).toBe(adminUser.studentId);
      });

      it("should dismiss report successfully", async () => {
        const response = await request(app)
          .post(`/admin/reports/${testReport._id}/process`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            action: "dismiss",
            notes: "Report dismissed as invalid",
          })
          .expect(200);

        expect(response.body.message).toBe("Report dismissed successfully");
        expect(response.body.report.status).toBe("dismissed");
      });

      it("should handle non-existent report", async () => {
        const fakeReportId = new mongoose.Types.ObjectId();
        const response = await request(app)
          .post(`/admin/reports/${fakeReportId}/process`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            action: "resolve",
            notes: "Test notes",
          })
          .expect(404);

        expect(response.body.error.code).toBe("REPORT_NOT_FOUND");
      });
    });

    describe("POST /admin/reports", () => {
      it("should create report successfully", async () => {
        const response = await request(app)
          .post("/admin/reports")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({
            contentType: "post",
            contentId: testPost._id.toString(),
            reportedStudentId: adminUser.studentId,
            reason: "spam",
            description: "This post appears to be spam",
          });

        if (response.status !== 201) {
          console.log("Response status:", response.status);
          console.log("Response body:", response.body);
        }

        expect(response.status).toBe(201);

        expect(response.body.message).toBe("Report submitted successfully");
        expect(response.body.report.contentType).toBe("post");
        expect(response.body.report.reason).toBe("spam");
        expect(response.body.report.status).toBe("pending");

        // Clean up the created report
        await Report.findByIdAndDelete(response.body.report.id);
      });

      it("should prevent duplicate reports", async () => {
        // First report
        await request(app)
          .post("/admin/reports")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({
            contentType: "post",
            contentId: testPost._id.toString(),
            reportedStudentId: adminUser.studentId,
            reason: "spam",
            description: "This post appears to be spam",
          })
          .expect(201);

        // Duplicate report
        const response = await request(app)
          .post("/admin/reports")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({
            contentType: "post",
            contentId: testPost._id.toString(),
            reportedStudentId: adminUser.studentId,
            reason: "spam",
            description: "This post appears to be spam",
          })
          .expect(400);

        expect(response.body.error.code).toBe("ALREADY_REPORTED");

        // Clean up
        await Report.deleteMany({
          reporterStudentId: regularUser.studentId,
          contentId: testPost._id,
        });
      });

      it("should prevent self-reporting", async () => {
        const response = await request(app)
          .post("/admin/reports")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({
            contentType: "post",
            contentId: testPost._id.toString(),
            reportedStudentId: regularUser.studentId, // Same as reporter
            reason: "spam",
            description: "Self report test",
          })
          .expect(400);

        expect(response.body.error.code).toBe("SELF_REPORT_NOT_ALLOWED");
      });

      it("should validate required fields", async () => {
        const response = await request(app)
          .post("/admin/reports")
          .set("Authorization", `Bearer ${regularUserToken}`)
          .send({
            contentType: "post",
            // Missing contentId, reportedStudentId, and reason
          })
          .expect(400);

        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      });
    });
  });
});
