import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { jest } from "@jest/globals";
import RosterUpload from "../page";
import { apiService } from "@/services/apiService";

// Mock the API service
jest.mock("@/services/apiService", () => ({
  apiService: {
    uploadRoster: jest.fn(),
  },
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe("RosterUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders roster upload page with instructions", () => {
    render(<RosterUpload />);

    expect(
      screen.getByRole("heading", { name: /roster upload/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/upload student roster csv files/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/csv format requirements/i)).toBeInTheDocument();
    expect(screen.getByText(/studentId/i)).toBeInTheDocument();
    expect(screen.getByText(/email/i)).toBeInTheDocument();
  });

  it("shows file upload area", () => {
    render(<RosterUpload />);

    expect(screen.getByText(/upload a file/i)).toBeInTheDocument();
    expect(screen.getByText(/or drag and drop/i)).toBeInTheDocument();
    expect(screen.getByText(/csv files only/i)).toBeInTheDocument();
  });

  it("handles file selection", () => {
    render(<RosterUpload />);

    const fileInput = screen.getByLabelText(/select csv file/i);
    const file = new File(
      ["studentId,email,year,department,section"],
      "roster.csv",
      {
        type: "text/csv",
      }
    );

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText("roster.csv")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload roster/i })
    ).toBeInTheDocument();
  });

  it("successfully uploads roster file", async () => {
    const mockResult = {
      success: true,
      message: "Roster uploaded successfully",
      processed: 100,
      errors: [],
    };

    mockApiService.uploadRoster.mockResolvedValue(mockResult);

    render(<RosterUpload />);

    const fileInput = screen.getByLabelText(/select csv file/i);
    const file = new File(
      ["studentId,email,year,department,section"],
      "roster.csv",
      {
        type: "text/csv",
      }
    );

    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByRole("button", { name: /upload roster/i });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockApiService.uploadRoster).toHaveBeenCalledWith(file);
      expect(screen.getByText(/upload successful/i)).toBeInTheDocument();
      expect(screen.getByText(/processed 100 records/i)).toBeInTheDocument();
    });
  });

  it("handles upload failure with errors", async () => {
    const mockResult = {
      success: false,
      message: "Upload failed",
      processed: 50,
      errors: ["Invalid email format in row 2", "Missing department in row 5"],
    };

    mockApiService.uploadRoster.mockResolvedValue(mockResult);

    render(<RosterUpload />);

    const fileInput = screen.getByLabelText(/select csv file/i);
    const file = new File(["invalid,data"], "roster.csv", {
      type: "text/csv",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByRole("button", { name: /upload roster/i });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      expect(
        screen.getByText(/invalid email format in row 2/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/missing department in row 5/i)
      ).toBeInTheDocument();
    });
  });

  it("shows loading state during upload", async () => {
    mockApiService.uploadRoster.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<RosterUpload />);

    const fileInput = screen.getByLabelText(/select csv file/i);
    const file = new File(["data"], "roster.csv", { type: "text/csv" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByRole("button", { name: /upload roster/i });
    fireEvent.click(uploadButton);

    expect(screen.getByText(/uploading.../i)).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();
  });

  it("prevents upload without file selection", () => {
    render(<RosterUpload />);

    // Try to upload without selecting a file
    const uploadButton = screen.queryByRole("button", {
      name: /upload roster/i,
    });
    expect(uploadButton).not.toBeInTheDocument();
  });

  it("validates file type", () => {
    // This would need to be implemented in the component
    // Currently the component only accepts .csv files through the input accept attribute
    render(<RosterUpload />);

    const fileInput = screen.getByLabelText(/select csv file/i);
    expect(fileInput).toHaveAttribute("accept", ".csv");
  });
});
