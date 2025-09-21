const User = require("../../src/models/User");

describe("User Model", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("Schema Validation", () => {
    const validUserData = {
      studentId: "2025CS1001",
      email: "john.doe@college.edu",
      displayName: "John Doe",
      year: 3,
      department: "CS",
      section: "A",
    };

    test("should create a valid user", async () => {
      const user = new User(validUserData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.studentId).toBe("2025CS1001");
      expect(savedUser.email).toBe("john.doe@college.edu");
      expect(savedUser.displayName).toBe("John Doe");
      expect(savedUser.year).toBe(3);
      expect(savedUser.department).toBe("CS");
      expect(savedUser.section).toBe("A");
      expect(savedUser.createdAt).toBeDefined();
      expect(savedUser.joinedAt).toBeDefined();
      expect(savedUser.isActive).toBe(true);
      expect(savedUser.settings.notifications).toBe(true);
    });

    test("should require studentId", async () => {
      const userData = { ...validUserData };
      delete userData.studentId;

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow("Student ID is required");
    });

    test("should validate studentId format", async () => {
      const invalidIds = [
        "invalid",
        "2025CS",
        "CS1001",
        "25CS1001",
        "2025cs1001",
      ];

      for (const invalidId of invalidIds) {
        const user = new User({ ...validUserData, studentId: invalidId });
        await expect(user.save()).rejects.toThrow(
          "Student ID must follow format"
        );
      }
    });

    test("should enforce studentId uniqueness", async () => {
      const user1 = new User(validUserData);
      await user1.save();

      const user2 = new User({
        ...validUserData,
        email: "different@college.edu",
      });
      await expect(user2.save()).rejects.toThrow();
    });

    test("should make studentId immutable", async () => {
      const user = new User(validUserData);
      const savedUser = await user.save();

      savedUser.studentId = "2025CS1002";
      await expect(savedUser.save()).rejects.toThrow(
        "Student ID cannot be modified"
      );
    });

    test("should validate email format", async () => {
      const invalidEmails = ["invalid-email", "test@", "@college.edu"];

      for (const invalidEmail of invalidEmails) {
        const user = new User({ ...validUserData, email: invalidEmail });
        await expect(user.save()).rejects.toThrow(
          "Please provide a valid email address"
        );
      }
    });

    test("should enforce email uniqueness", async () => {
      const user1 = new User(validUserData);
      await user1.save();

      const user2 = new User({ ...validUserData, studentId: "2025CS1002" });
      await expect(user2.save()).rejects.toThrow();
    });

    test("should require displayName", async () => {
      const userData = { ...validUserData };
      delete userData.displayName;

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow("Display name is required");
    });

    test("should validate displayName length", async () => {
      const user1 = new User({ ...validUserData, displayName: "A" });
      await expect(user1.save()).rejects.toThrow(
        "Display name must be at least 2 characters"
      );

      const user2 = new User({ ...validUserData, displayName: "A".repeat(51) });
      await expect(user2.save()).rejects.toThrow(
        "Display name cannot exceed 50 characters"
      );
    });

    test("should validate year range", async () => {
      const user1 = new User({ ...validUserData, year: 0 });
      await expect(user1.save()).rejects.toThrow(
        "Year must be between 1 and 4"
      );

      const user2 = new User({ ...validUserData, year: 5 });
      await expect(user2.save()).rejects.toThrow(
        "Year must be between 1 and 4"
      );
    });

    test("should validate department enum", async () => {
      const user = new User({ ...validUserData, department: "INVALID" });
      await expect(user.save()).rejects.toThrow("Department must be one of");
    });

    test("should validate section format", async () => {
      const invalidSections = ["1", "AA"];

      for (const invalidSection of invalidSections) {
        const user = new User({ ...validUserData, section: invalidSection });
        await expect(user.save()).rejects.toThrow(
          "Section must be a single uppercase letter"
        );
      }

      // Test empty string separately as it triggers required validation
      const userWithEmptySection = new User({ ...validUserData, section: "" });
      await expect(userWithEmptySection.save()).rejects.toThrow(
        "Section is required"
      );
    });

    test("should validate bio length", async () => {
      const user = new User({ ...validUserData, bio: "A".repeat(501) });
      await expect(user.save()).rejects.toThrow(
        "Bio cannot exceed 500 characters"
      );
    });

    test("should validate photoUrl format", async () => {
      const user = new User({ ...validUserData, photoUrl: "invalid-url" });
      await expect(user.save()).rejects.toThrow(
        "Photo URL must be a valid HTTP/HTTPS URL"
      );
    });

    test("should auto-uppercase department and section", async () => {
      const user = new User({
        ...validUserData,
        department: "cs",
        section: "a",
      });
      const savedUser = await user.save();

      expect(savedUser.department).toBe("CS");
      expect(savedUser.section).toBe("A");
    });

    test("should trim whitespace from string fields", async () => {
      const user = new User({
        ...validUserData,
        displayName: "  John Doe  ",
        bio: "  This is my bio  ",
      });
      const savedUser = await user.save();

      expect(savedUser.displayName).toBe("John Doe");
      expect(savedUser.bio).toBe("This is my bio");
    });
  });

  describe("Instance Methods", () => {
    let user;

    beforeEach(async () => {
      user = new User({
        studentId: "2025CS1001",
        email: "john.doe@college.edu",
        displayName: "John Doe",
        year: 3,
        department: "CS",
        section: "A",
      });
      await user.save();
    });

    test("should add FCM token", async () => {
      const token = "fcm-token-123";
      await user.addFCMToken(token);

      expect(user.fcmTokens).toContain(token);
    });

    test("should not add duplicate FCM token", async () => {
      const token = "fcm-token-123";
      await user.addFCMToken(token);
      await user.addFCMToken(token);

      expect(user.fcmTokens.filter((t) => t === token)).toHaveLength(1);
    });

    test("should remove FCM token", async () => {
      const token = "fcm-token-123";
      await user.addFCMToken(token);
      await user.removeFCMToken(token);

      expect(user.fcmTokens).not.toContain(token);
    });

    test("should update last login", async () => {
      const beforeLogin = user.lastLoginAt;
      await user.updateLastLogin();

      expect(user.lastLoginAt).not.toBe(beforeLogin);
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    test("should check profile view permissions", async () => {
      const viewer = new User({
        studentId: "2025CS1002",
        email: "jane.doe@college.edu",
        displayName: "Jane Doe",
        year: 3,
        department: "CS",
        section: "B",
      });

      expect(user.canViewProfile(viewer)).toBe(true);
      expect(user.canViewProfile(user)).toBe(true);
      expect(user.canViewProfile(null)).toBe(false);
    });
  });

  describe("Static Methods", () => {
    beforeEach(async () => {
      const users = [
        {
          studentId: "2025CS1001",
          email: "john.doe@college.edu",
          displayName: "John Doe",
          year: 3,
          department: "CS",
          section: "A",
        },
        {
          studentId: "2025ECE1001",
          email: "jane.smith@college.edu",
          displayName: "Jane Smith",
          year: 2,
          department: "ECE",
          section: "B",
        },
        {
          studentId: "2025CS1002",
          email: "bob.wilson@college.edu",
          displayName: "Bob Wilson",
          year: 3,
          department: "CS",
          section: "A",
          isActive: false,
        },
      ];

      await User.insertMany(users);
    });

    test("should find user by studentId", async () => {
      const user = await User.findByStudentId("2025CS1001");
      expect(user).toBeTruthy();
      expect(user.displayName).toBe("John Doe");
    });

    test("should not find inactive user by studentId", async () => {
      const user = await User.findByStudentId("2025CS1002");
      expect(user).toBeNull();
    });

    test("should find user by email", async () => {
      const user = await User.findByEmail("john.doe@college.edu");
      expect(user).toBeTruthy();
      expect(user.studentId).toBe("2025CS1001");
    });

    test("should find users by year, department, section", async () => {
      const users = await User.findByYearDeptSection(3, "CS", "A");
      expect(users).toHaveLength(1);
      expect(users[0].displayName).toBe("John Doe");
    });

    test("should search users by text", async () => {
      const users = await User.searchUsers("John");
      expect(users).toHaveLength(1);
      expect(users[0].displayName).toBe("John Doe");
    });
  });

  describe("Virtuals", () => {
    test("should generate fullStudentId virtual", async () => {
      const user = new User({
        studentId: "2025CS1001",
        email: "john.doe@college.edu",
        displayName: "John Doe",
        year: 3,
        department: "CS",
        section: "A",
      });

      expect(user.fullStudentId).toBe("3CSA-2025CS1001");
    });
  });

  describe("JSON Transform", () => {
    test("should exclude sensitive fields from JSON", async () => {
      const user = new User({
        studentId: "2025CS1001",
        email: "john.doe@college.edu",
        displayName: "John Doe",
        year: 3,
        department: "CS",
        section: "A",
      });
      user.fcmTokens.push("sensitive-token");

      const json = user.toJSON();
      expect(json.fcmTokens).toBeUndefined();
      expect(json.__v).toBeUndefined();
      expect(json.displayName).toBe("John Doe");
    });
  });

  describe("Indexes", () => {
    test("should have required indexes", async () => {
      const indexes = await User.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames).toContain("studentId_1");
      expect(indexNames).toContain("email_1");
      expect(
        indexNames.some((name) =>
          name.includes("year_1_department_1_section_1")
        )
      ).toBe(true);
    });
  });
});
