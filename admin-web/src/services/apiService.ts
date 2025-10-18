import axios, { AxiosInstance } from "axios";
import { authService } from "./authService";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });

    // Add auth interceptor
    this.api.interceptors.request.use((config) => {
      const headers = authService.getAuthHeaders();
      Object.assign(config.headers, headers);
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          authService.logout();
          window.location.href = "/";
        }
        return Promise.reject(error);
      }
    );
  }

  // Roster management
  async uploadRoster(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("roster", file);

    const response = await this.api.post("/admin/roster", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }

  // Content moderation
  async getReportedContent(page = 1, limit = 20): Promise<any> {
    const response = await this.api.get(
      `/admin/reports?page=${page}&limit=${limit}`
    );
    return response.data;
  }

  async moderateContent(
    contentId: string,
    action: "approve" | "remove"
  ): Promise<any> {
    const response = await this.api.post("/admin/moderate", {
      contentId,
      action,
    });
    return response.data;
  }

  async banUser(studentId: string, reason: string): Promise<any> {
    const response = await this.api.post("/admin/ban", {
      studentId,
      reason,
    });
    return response.data;
  }

  // Analytics
  async getDashboardStats(): Promise<any> {
    const response = await this.api.get("/admin/stats");
    return response.data;
  }

  async getUserMetrics(timeframe: string = "7d"): Promise<any> {
    const response = await this.api.get(
      `/admin/metrics/users?timeframe=${timeframe}`
    );
    return response.data;
  }

  async getContentMetrics(timeframe: string = "7d"): Promise<any> {
    const response = await this.api.get(
      `/admin/metrics/content?timeframe=${timeframe}`
    );
    return response.data;
  }

  // User management
  async getUsers(
    page = 1,
    limit = 20,
    search?: string,
    status?: string
  ): Promise<any> {
    let url = `/admin/users?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status) url += `&status=${status}`;

    const response = await this.api.get(url);
    return response.data;
  }

  // Data export
  async exportData(
    type: string,
    format: string,
    timeframe: string
  ): Promise<any> {
    const response = await this.api.get(
      `/admin/export/${type}?format=${format}&timeframe=${timeframe}`,
      {
        responseType: "blob",
      }
    );
    return response.data;
  }
}

export const apiService = new ApiService();
