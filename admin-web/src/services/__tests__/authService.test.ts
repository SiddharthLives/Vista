import { jest } from "@jest/globals";
import axios from "axios";
import { authService } from "../authService";

// Mock axios
jest.mock("axios", () => ({
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  post: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  describe("login", () => {
    it("successfully logs in and stores token", async () => {
      const mockResponse = {
        data: {
          token: "mock-jwt-token",
          user: { id: "1", email: "admin@college.edu", role: "admin" },
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const credentials = {
        email: "admin@college.edu",
        password: "password123",
      };
      const result = await authService.login(credentials);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://localhost:3000/admin/auth/login",
        credentials
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "admin_token",
        "mock-jwt-token"
      );
      expect(result).toEqual(mockResponse.data);
    });

    it("throws error on login failure", async () => {
      const mockError = {
        response: {
          data: {
            error: {
              message: "Invalid credentials",
            },
          },
        },
      };
      mockedAxios.post.mockRejectedValue(mockError);

      const credentials = {
        email: "admin@college.edu",
        password: "wrongpassword",
      };

      await expect(authService.login(credentials)).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("throws generic error when no specific message", async () => {
      mockedAxios.post.mockRejectedValue(new Error("Network error"));

      const credentials = {
        email: "admin@college.edu",
        password: "password123",
      };

      await expect(authService.login(credentials)).rejects.toThrow(
        "Login failed"
      );
    });
  });

  describe("logout", () => {
    it("removes token from localStorage", () => {
      authService.logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith("admin_token");
    });
  });

  describe("getToken", () => {
    it("returns token from localStorage", () => {
      localStorageMock.getItem.mockReturnValue("stored-token");

      const token = authService.getToken();

      expect(localStorageMock.getItem).toHaveBeenCalledWith("admin_token");
      expect(token).toBe("stored-token");
    });

    it("returns null when no token stored", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const token = authService.getToken();

      expect(token).toBeNull();
    });

    it("returns null on server side", () => {
      // Mock window as undefined (server-side)
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const token = authService.getToken();

      expect(token).toBeNull();

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("isTokenValid", () => {
    it("returns true for valid token", () => {
      // Create a mock JWT token with future expiration
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp: futureExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const isValid = authService.isTokenValid(mockToken);

      expect(isValid).toBe(true);
    });

    it("returns false for expired token", () => {
      // Create a mock JWT token with past expiration
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = { exp: pastExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockToken = `header.${encodedPayload}.signature`;

      const isValid = authService.isTokenValid(mockToken);

      expect(isValid).toBe(false);
    });

    it("returns false for malformed token", () => {
      const malformedToken = "invalid.token";

      const isValid = authService.isTokenValid(malformedToken);

      expect(isValid).toBe(false);
    });
  });

  describe("getAuthHeaders", () => {
    it("returns authorization header when token exists", () => {
      localStorageMock.getItem.mockReturnValue("stored-token");

      const headers = authService.getAuthHeaders();

      expect(headers).toEqual({ Authorization: "Bearer stored-token" });
    });

    it("returns empty object when no token", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const headers = authService.getAuthHeaders();

      expect(headers).toEqual({});
    });
  });
});
