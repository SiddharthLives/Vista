import { render, screen, fireEvent } from "@testing-library/react";
import { jest } from "@jest/globals";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import { authService } from "@/services/authService";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock auth service
jest.mock("@/services/authService", () => ({
  authService: {
    logout: jest.fn(),
  },
}));

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

describe("Sidebar", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    });
    mockUsePathname.mockReturnValue("/dashboard");
    jest.clearAllMocks();
  });

  it("renders navigation items", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Roster Upload")).toBeInTheDocument();
    expect(screen.getByText("Content Moderation")).toBeInTheDocument();
    expect(screen.getByText("User Management")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
  });

  it("highlights active navigation item", () => {
    mockUsePathname.mockReturnValue("/dashboard/roster");
    render(<Sidebar />);

    const rosterLink = screen.getByText("Roster Upload").closest("a");
    expect(rosterLink).toHaveClass("bg-primary-100", "text-primary-900");
  });

  it("renders college social admin title", () => {
    render(<Sidebar />);

    expect(screen.getByText("College Social Admin")).toBeInTheDocument();
  });

  it("calls logout and redirects on sign out", () => {
    render(<Sidebar />);

    const signOutButton = screen.getByText("Sign out");
    fireEvent.click(signOutButton);

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("renders mobile menu button on small screens", () => {
    render(<Sidebar />);

    // The mobile menu button should be present but hidden on desktop
    const menuButtons = screen.getAllByRole("button");
    const mobileMenuButton = menuButtons.find((button) =>
      button.querySelector("svg")?.classList.contains("h-6")
    );
    expect(mobileMenuButton).toBeInTheDocument();
  });

  it("has correct navigation links", () => {
    render(<Sidebar />);

    const dashboardLink = screen.getByText("Dashboard").closest("a");
    const rosterLink = screen.getByText("Roster Upload").closest("a");
    const moderationLink = screen.getByText("Content Moderation").closest("a");
    const usersLink = screen.getByText("User Management").closest("a");
    const reportsLink = screen.getByText("Reports").closest("a");

    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
    expect(rosterLink).toHaveAttribute("href", "/dashboard/roster");
    expect(moderationLink).toHaveAttribute("href", "/dashboard/moderation");
    expect(usersLink).toHaveAttribute("href", "/dashboard/users");
    expect(reportsLink).toHaveAttribute("href", "/dashboard/reports");
  });

  it("renders navigation icons", () => {
    render(<Sidebar />);

    // Check that icons are rendered (they should be SVG elements)
    const svgElements = screen.getAllByRole("img", { hidden: true });
    expect(svgElements.length).toBeGreaterThan(0);
  });
});
