import { render, screen, waitFor } from "@testing-library/react";
import { jest } from "@jest/globals";
import Dashboard from "../page";
import { apiService } from "@/services/apiService";

// Mock the API service
jest.mock("@/services/apiService", () => ({
  apiService: {
    getDashboardStats: jest.fn(),
  },
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe("Dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dashboard with loading state initially", () => {
    mockApiService.getDashboardStats.mockImplementation(
      () => new Promise(() => {})
    );

    render(<Dashboard />);

    expect(
      screen.getByRole("heading", { name: /dashboard/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/welcome to the college social media admin dashboard/i)
    ).toBeInTheDocument();
  });

  it("displays stats when data is loaded successfully", async () => {
    const mockStats = {
      totalUsers: 1250,
      activeUsers: 890,
      totalPosts: 3420,
      totalTopics: 156,
      recentActivity: {
        newUsers: 15,
        newPosts: 45,
        newTopics: 3,
      },
    };

    mockApiService.getDashboardStats.mockResolvedValue(mockStats);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("1,250")).toBeInTheDocument(); // Total users
      expect(screen.getByText("890")).toBeInTheDocument(); // Active users
      expect(screen.getByText("3,420")).toBeInTheDocument(); // Total posts
    });

    expect(
      screen.getByText("Recent Activity (Last 7 days)")
    ).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument(); // New users
    expect(screen.getByText("45")).toBeInTheDocument(); // New posts
    expect(screen.getByText("3")).toBeInTheDocument(); // New topics
  });

  it("handles API error gracefully", async () => {
    mockApiService.getDashboardStats.mockRejectedValue(new Error("API Error"));

    render(<Dashboard />);

    await waitFor(() => {
      // Should show default values (0) when API fails
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  it("displays all stat cards with correct icons and labels", async () => {
    const mockStats = {
      totalUsers: 100,
      activeUsers: 80,
      totalPosts: 200,
      totalTopics: 10,
      recentActivity: {
        newUsers: 5,
        newPosts: 20,
        newTopics: 2,
      },
    };

    mockApiService.getDashboardStats.mockResolvedValue(mockStats);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Total Users")).toBeInTheDocument();
      expect(screen.getByText("Active Users")).toBeInTheDocument();
      expect(screen.getByText("Total Posts")).toBeInTheDocument();
      expect(screen.getByText("Total Topics")).toBeInTheDocument();
    });
  });

  it("shows recent activity section with correct data", async () => {
    const mockStats = {
      totalUsers: 100,
      activeUsers: 80,
      totalPosts: 200,
      totalTopics: 10,
      recentActivity: {
        newUsers: 5,
        newPosts: 20,
        newTopics: 2,
      },
    };

    mockApiService.getDashboardStats.mockResolvedValue(mockStats);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("New Users")).toBeInTheDocument();
      expect(screen.getByText("New Posts")).toBeInTheDocument();
      expect(screen.getByText("New Topics")).toBeInTheDocument();
    });
  });
});
