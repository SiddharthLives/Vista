"use client";

import { useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { apiService } from "@/services/apiService";
import toast from "react-hot-toast";

interface UploadResult {
  success: boolean;
  message: string;
  processed: number;
  errors: string[];
}

export default function RosterUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type !== "text/csv" &&
        !selectedFile.name.endsWith(".csv")
      ) {
        toast.error("Please select a CSV file");
        return;
      }
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);
    try {
      const result = await apiService.uploadRoster(file);
      setUploadResult(result);
      if (result.success) {
        toast.success("Roster uploaded successfully!");
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById(
          "roster-file"
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        toast.error("Upload completed with errors");
      }
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
      setUploadResult({
        success: false,
        message: error.message || "Upload failed",
        processed: 0,
        errors: [error.message || "Unknown error occurred"],
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Roster Upload</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload student roster CSV files to create user accounts
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Upload CSV File
        </h2>

        {/* File Format Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                CSV Format Requirements
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>The CSV file should contain the following columns:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>
                    <strong>studentId</strong> - Unique student identifier
                    (e.g., 2025CS1001)
                  </li>
                  <li>
                    <strong>email</strong> - Student email address
                    (@college.edu)
                  </li>
                  <li>
                    <strong>year</strong> - Academic year (1-4)
                  </li>
                  <li>
                    <strong>department</strong> - Department code (e.g., CS, EE,
                    ME)
                  </li>
                  <li>
                    <strong>section</strong> - Section identifier (e.g., A, B,
                    C)
                  </li>
                </ul>
                <p className="mt-2">
                  <strong>Example:</strong>{" "}
                  studentId,email,year,department,section
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="roster-file"
              className="block text-sm font-medium text-gray-700"
            >
              Select CSV File
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="roster-file"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="roster-file"
                      name="roster-file"
                      type="file"
                      accept=".csv"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">CSV files only</p>
              </div>
            </div>
          </div>

          {file && (
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">{file.name}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    "Upload Roster"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Results */}
      {uploadResult && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Upload Results
          </h2>

          <div
            className={`rounded-md p-4 ${
              uploadResult.success
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {uploadResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div className="ml-3">
                <h3
                  className={`text-sm font-medium ${
                    uploadResult.success ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {uploadResult.success ? "Upload Successful" : "Upload Failed"}
                </h3>
                <div
                  className={`mt-2 text-sm ${
                    uploadResult.success ? "text-green-700" : "text-red-700"
                  }`}
                >
                  <p>{uploadResult.message}</p>
                  {uploadResult.processed > 0 && (
                    <p className="mt-1">
                      Processed {uploadResult.processed} records
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {uploadResult.errors && uploadResult.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {uploadResult.errors.map((error, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
