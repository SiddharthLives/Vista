"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Download,
  Calendar,
  Users,
  FileText,
  MessageSquare,
  TrendingUp,
  Activity,
} from "lucide-react";
import { apiService } from "@/services/apiService";
import toast from "react-hot-toast";

interface AnalyticsData {
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    userGrowthRate: number;
  };
  contentMetrics: {
    totalPosts: number;
    totalTopics: number;
    totalComments: number;
    postsToday: number;
    topicsToday: number;
    engagementRate: number;
  };
  activityMetrics: {
    dailyActiveUsers: number[];
    weeklyPosts: number[];
    weeklyTopics: number[];
    dates: string[];
  };
}

interface ExportOptions {
  type: "users" | "content" | "activity";
  format: "csv" | "json";
  dateRange: string;
}

export default function Reports() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("7d");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe]);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);

      // Mock data - in real implementation, this would come from API
      const mockAnalytics: AnalyticsData = {
        userMetrics: {
          totalUsers: 1250,
          activeUsers: 890,
          newUsersToday: 15,
          newUsersThisWeek: 87,
          userGrowthRate: 12.5,
        },
        contentMetrics: {
          totalPosts: 3420,
          totalTopics: 156,
          totalComments: 8930,
          postsToday: 45,
          topicsToday: 3,
          engagementRate: 68.5,
        },
        activityMetrics: {
          dailyActiveUsers: [120, 135, 98, 156, 189, 167, 145],
          weeklyPosts: [234, 267, 189, 298, 345, 312, 278],
          weeklyTopics: [12, 15, 8, 18, 22, 19, 16],
          dates: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        },
      };

      setAnalytics(mockAnalytics);
    } catch (error: any) {
      toast.error("Failed to load analytics data");
      console.error("Analytics error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (options: ExportOptions) => {
    try {
      setIsExporting(true);

      // Mock export - in real implementation, this would call API
      const filename = `${options.type}_report_${options.dateRange}.${options.format}`;

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success(`Report exported: ${filename}`);
    } catch (error: any) {
      toast.error("Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No analytics data
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Unable to load analytics data.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Analytics & Reports
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Platform usage metrics and data exports
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Users
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {analytics.userMetrics.totalUsers.toLocaleString()}
                    </div>
                    <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                      +{analytics.userMetrics.userGrowthRate}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-8 w-8 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Users
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {analytics.userMetrics.activeUsers.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-8 w-8 text-purple-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Posts
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {analytics.contentMetrics.totalPosts.toLocaleString()}
                    </div>
                    <div className="ml-2 text-sm text-gray-600">
                      +{analytics.contentMetrics.postsToday} today
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MessageSquare className="h-8 w-8 text-orange-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Engagement Rate
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {analytics.contentMetrics.engagementRate}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Daily Active Users Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Daily Active Users
          </h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {analytics.activityMetrics.dailyActiveUsers.map((users, index) => {
              const maxUsers = Math.max(
                ...analytics.activityMetrics.dailyActiveUsers
              );
              const height = (users / maxUsers) * 100;
              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div
                    className="bg-blue-500 rounded-t w-full min-h-[4px] flex items-end justify-center text-xs text-white font-medium"
                    style={{ height: `${height}%` }}
                  >
                    {users > 50 ? users : ""}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {analytics.activityMetrics.dates[index]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Creation Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Weekly Content Creation
          </h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {analytics.activityMetrics.weeklyPosts.map((posts, index) => {
              const topics = analytics.activityMetrics.weeklyTopics[index];
              const maxContent = Math.max(
                ...analytics.activityMetrics.weeklyPosts
              );
              const postHeight = (posts / maxContent) * 80;
              const topicHeight =
                (topics / Math.max(...analytics.activityMetrics.weeklyTopics)) *
                20;

              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div className="flex flex-col w-full space-y-1">
                    <div
                      className="bg-purple-500 rounded-t w-full min-h-[4px] flex items-end justify-center text-xs text-white font-medium"
                      style={{ height: `${postHeight}%` }}
                    >
                      {posts > 100 ? posts : ""}
                    </div>
                    <div
                      className="bg-orange-500 rounded w-full min-h-[4px] flex items-end justify-center text-xs text-white font-medium"
                      style={{ height: `${topicHeight}%` }}
                    >
                      {topics > 5 ? topics : ""}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {analytics.activityMetrics.dates[index]}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center space-x-4 mt-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">Posts</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">Topics</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Export Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Export</h3>
        <p className="text-sm text-gray-600 mb-6">
          Export platform data for compliance, analysis, or backup purposes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Data Export */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Users className="h-6 w-6 text-blue-500 mr-2" />
              <h4 className="text-sm font-medium text-gray-900">User Data</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Export user profiles, registration data, and activity metrics.
            </p>
            <div className="space-y-2">
              <button
                onClick={() =>
                  handleExport({
                    type: "users",
                    format: "csv",
                    dateRange: timeframe,
                  })
                }
                disabled={isExporting}
                className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() =>
                  handleExport({
                    type: "users",
                    format: "json",
                    dateRange: timeframe,
                  })
                }
                disabled={isExporting}
                className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </button>
            </div>
          </div>

          {/* Content Data Export */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <FileText className="h-6 w-6 text-purple-500 mr-2" />
              <h4 className="text-sm font-medium text-gray-900">
                Content Data
              </h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Export posts, topics, comments, and engagement metrics.
            </p>
            <div className="space-y-2">
              <button
                onClick={() =>
                  handleExport({
                    type: "content",
                    format: "csv",
                    dateRange: timeframe,
                  })
                }
                disabled={isExporting}
                className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() =>
                  handleExport({
                    type: "content",
                    format: "json",
                    dateRange: timeframe,
                  })
                }
                disabled={isExporting}
                className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </button>
            </div>
          </div>

          {/* Activity Data Export */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Activity className="h-6 w-6 text-green-500 mr-2" />
              <h4 className="text-sm font-medium text-gray-900">
                Activity Data
              </h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Export user activity logs, session data, and usage analytics.
            </p>
            <div className="space-y-2">
              <button
                onClick={() =>
                  handleExport({
                    type: "activity",
                    format: "csv",
                    dateRange: timeframe,
                  })
                }
                disabled={isExporting}
                className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() =>
                  handleExport({
                    type: "activity",
                    format: "json",
                    dateRange: timeframe,
                  })
                }
                disabled={isExporting}
                className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </button>
            </div>
          </div>
        </div>

        {isExporting && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-blue-800">Preparing export...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
