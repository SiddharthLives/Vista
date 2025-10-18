"use client";

import { useEffect, useState } from "react";
import { Users, FileText, MessageSquare, TrendingUp } from "lucide-react";
import { apiService } from "@/services/apiService";
import toast from "react-hot-toast";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalTopics: number;
  totalMessages: number;
  recentActivity: {
    newUsers: number;
    newPosts: number;
    newTopics: number;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiService.getDashboardStats();
        setStats(data);
      } catch (error: any) {
        toast.error("Failed to load dashboard stats");
        console.error("Dashboard stats error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const statCards = [
    {
      name: "Total Users",
      value: stats?.totalUsers || 0,
      change: stats?.recentActivity.newUsers || 0,
      icon: Users,
      color: "bg-blue-500",
    },
    {
      name: "Active Users",
      value: stats?.activeUsers || 0,
      change: null,
      icon: TrendingUp,
      color: "bg-green-500",
    },
    {
      name: "Total Posts",
      value: stats?.totalPosts || 0,
      change: stats?.recentActivity.newPosts || 0,
      icon: FileText,
      color: "bg-purple-500",
    },
    {
      name: "Total Topics",
      value: stats?.totalTopics || 0,
      change: stats?.recentActivity.newTopics || 0,
      icon: MessageSquare,
      color: "bg-orange-500",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome to the College Social Media Admin Dashboard
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${stat.color} p-3 rounded-md`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {stat.value.toLocaleString()}
                      </div>
                      {stat.change !== null && (
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                          +{stat.change}
                        </div>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Recent Activity (Last 7 days)
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats?.recentActivity.newUsers || 0}
              </div>
              <div className="text-sm text-blue-800">New Users</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats?.recentActivity.newPosts || 0}
              </div>
              <div className="text-sm text-purple-800">New Posts</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats?.recentActivity.newTopics || 0}
              </div>
              <div className="text-sm text-orange-800">New Topics</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
