"use client";

import { useEffect, useState } from "react";
import { Shield, Eye, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { apiService } from "@/services/apiService";
import toast from "react-hot-toast";

interface ReportedContent {
  id: string;
  type: "post" | "topic" | "comment";
  content: {
    id: string;
    text: string;
    author: {
      studentId: string;
      displayName: string;
    };
    createdAt: string;
  };
  reports: Array<{
    reason: string;
    reportedBy: string;
    reportedAt: string;
  }>;
  status: "pending" | "approved" | "removed";
}

export default function ContentModeration() {
  const [reportedContent, setReportedContent] = useState<ReportedContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchReportedContent();
  }, [currentPage]);

  const fetchReportedContent = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getReportedContent(currentPage, 10);
      setReportedContent(data.reports || []);
      setTotalPages(Math.ceil((data.total || 0) / 10));
    } catch (error: any) {
      toast.error("Failed to load reported content");
      console.error("Moderation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModerate = async (
    contentId: string,
    action: "approve" | "remove"
  ) => {
    try {
      await apiService.moderateContent(contentId, action);
      toast.success(`Content ${action}d successfully`);
      fetchReportedContent(); // Refresh the list
    } catch (error: any) {
      toast.error(`Failed to ${action} content`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case "removed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <Trash2 className="w-3 h-3 mr-1" />
            Removed
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review and moderate reported content
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Pending Reports
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {
                      reportedContent.filter(
                        (item) => item.status === "pending"
                      ).length
                    }
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
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Approved
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {
                      reportedContent.filter(
                        (item) => item.status === "approved"
                      ).length
                    }
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
                <Trash2 className="h-8 w-8 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Removed
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {
                      reportedContent.filter(
                        (item) => item.status === "removed"
                      ).length
                    }
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reported Content List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {reportedContent.length === 0 ? (
            <li className="px-6 py-8 text-center">
              <Shield className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No reported content
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                All content is currently clean and approved.
              </p>
            </li>
          ) : (
            reportedContent.map((item) => (
              <li key={item.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                          {item.type}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.reports.length} report
                        {item.reports.length !== 1 ? "s" : ""}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-900 font-medium">
                        By: {item.content.author.displayName} (
                        {item.content.author.studentId})
                      </p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                        {item.content.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Posted:{" "}
                        {new Date(item.content.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-900 mb-1">
                        Reports:
                      </h4>
                      <div className="space-y-1">
                        {item.reports.map((report, index) => (
                          <div key={index} className="text-sm text-gray-600">
                            <span className="font-medium">{report.reason}</span>
                            <span className="text-gray-500 ml-2">
                              -{" "}
                              {new Date(report.reportedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {item.status === "pending" && (
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() =>
                          handleModerate(item.content.id, "approve")
                        }
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          handleModerate(item.content.id, "remove")
                        }
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> of{" "}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
