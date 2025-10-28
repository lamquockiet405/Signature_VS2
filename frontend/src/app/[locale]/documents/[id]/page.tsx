"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Upload as UploadIcon } from "lucide-react";
import Link from "next/link";
import {
  filesAPI,
  usersAPI,
  logsAPI,
  authAPI,
  isReadOnlyUser,
} from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

interface FileData {
  id: string;
  filename: string;
  original_name: string;
  path: string;
  size: number;
  mime_type: string;
  uploaded_by: string;
  status: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: string;
  avatar_url?: string;
}

interface Activity {
  id: string;
  action: string;
  target: string;
  user_id: string;
  username?: string;
  full_name?: string;
  email?: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface FormData {
  description: string;
  priority: string;
  expirationDate: string;
}

export default function DocumentDetailPage() {
  const toast = useToast();
  const params = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<FileData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<FormData>({
    description: "",
    priority: "Medium",
    expirationDate: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSigner, setSelectedSigner] = useState<string>("");
  const [sendNotification, setSendNotification] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const fileId = params.id as string;

        // Fetch file details
        const fileData = await filesAPI.getById(fileId);
        console.log("File data:", fileData);
        console.log("File path:", fileData.path);
        console.log("File mime_type:", fileData.mime_type);
        setFile(fileData);

        // Set form data from file
        setFormData({
          description: fileData.description || "",
          priority: "Medium",
          expirationDate: "",
        });

        // Set selected signer
        if (fileData.uploaded_by) {
          setSelectedSigner(fileData.uploaded_by);
        }

        // Fetch all users for signer dropdown only if the current user
        // has permission to read users (admin/manager). Regular users
        // are not allowed to read the users list by design.
        const currentUser = authAPI.getCurrentUser();
        const role = currentUser?.role?.toLowerCase() || null;
        if (["admin", "manager", "user"].includes(role)) {
          const usersData = await usersAPI.getAll(1, 1000);
          setUsers(usersData.users || []);
        } else {
          setUsers([]);
        }

        // Fetch activities/logs related to this file
        const logsData = await logsAPI.getAll(1, 10, { target: fileId });
        setActivities(logsData.logs || []);
      } catch (error) {
        console.error("Error fetching document details:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnlyUser()) {
      toast.error("Bạn không có quyền thực hiện hành động này");
      return;
    }
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleBrowseClick = () => {
    if (isReadOnlyUser()) {
      toast.error("Bạn không có quyền thực hiện hành động này");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isReadOnlyUser()) {
      toast.error("Bạn không có quyền thực hiện hành động này");
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFileUrl = (filePath: string) => {
    // Convert absolute path to relative URL
    // From: D:\File thuc tap\CHUKI\backend\uploads\filename.pdf
    // To: /uploads/filename.pdf
    if (filePath.includes("uploads")) {
      const parts = filePath.split("uploads");
      return `/uploads${parts[1].replace(/\\/g, "/")}`;
    }
    return filePath;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    return `${Math.floor(seconds / 2592000)} months ago`;
  };

  const getDocumentType = (mimeType: string) => {
    if (mimeType?.includes("pdf")) return "Reports";
    if (mimeType?.includes("word")) return "Forms";
    if (mimeType?.includes("image")) return "Images";
    return "Documents";
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Document Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            The document you are looking for does not exist.
          </p>
          <Link href="/documents" className="text-blue-600 hover:underline">
            Back to Documents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".png,.jpg,.jpeg,.webp,.svg,.pdf"
        onChange={handleFileSelect}
      />

      {/* Header with right-aligned breadcrumb */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Document Details</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Link href="/documents" className="hover:text-blue-600">
            Documents
          </Link>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-medium">Document Details</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Dropzone */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Dropzone</h3>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg py-13 px-6 text-center hover:border-blue-400 transition-colors cursor-pointer flex items-center justify-center min-h-[200px]"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={handleBrowseClick}
            >
              {selectedFile ? (
                <div>
                  <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UploadIcon className="text-blue-600" size={22} />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1.5">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              ) : file ? (
                <div className="w-full" onClick={(e) => e.stopPropagation()}>
                  {file.mime_type?.includes("pdf") ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <embed
                          src={`http://localhost:5000${getFileUrl(
                            file.path
                          )}#toolbar=1&navpanes=1&scrollbar=1`}
                          type="application/pdf"
                          className="w-full h-[600px] rounded-lg border border-gray-200"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <h4 className="text-sm font-medium text-gray-900">
                            {file.original_name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)} • PDF Document
                          </p>
                        </div>
                        <a
                          href={`http://localhost:5000${getFileUrl(file.path)}`}
                          download={file.original_name}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Download PDF
                        </a>
                      </div>
                    </div>
                  ) : file.mime_type?.includes("image") ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`http://localhost:5000${getFileUrl(file.path)}`}
                          alt={file.original_name}
                          className="max-w-full max-h-[600px] mx-auto rounded-lg object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <h4 className="text-sm font-medium text-gray-900">
                            {file.original_name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)} • Image
                          </p>
                        </div>
                        <a
                          href={`http://localhost:5000${getFileUrl(file.path)}`}
                          download={file.original_name}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Download Image
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <UploadIcon className="text-blue-600" size={22} />
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1.5">
                        {file.original_name}
                      </h4>
                      <p className="text-xs text-gray-500 mb-3">
                        {formatFileSize(file.size)} • {file.mime_type}
                      </p>
                      <a
                        href={`http://localhost:5000${getFileUrl(file.path)}`}
                        download={file.original_name}
                        className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Download file
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="w-11 h-11 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UploadIcon className="text-gray-400" size={22} />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1.5">
                    Drop file here
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Drag and drop your PNG, JPG, WebP, SVG images here or browse
                  </p>
                  <button className="text-xs text-blue-600 hover:underline font-medium">
                    Browse file
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Document Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Document Information
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Document name
                </label>
                <input
                  type="text"
                  value={file.original_name}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Document type
                </label>
                <select
                  value={getDocumentType(file.mime_type)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                  disabled
                >
                  <option>Reports</option>
                  <option>Forms</option>
                  <option>Contracts</option>
                  <option>Invoices</option>
                  <option>Approvals</option>
                  <option>Images</option>
                  <option>Documents</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter your description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option>Urgent</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expirationDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Signer Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Signer
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Full name
                </label>
                <select
                  value={selectedSigner}
                  onChange={(e) => setSelectedSigner(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={
                    users.find((u) => u.id === selectedSigner)?.email || ""
                  }
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="sendNotification"
                  checked={sendNotification}
                  onChange={(e) => setSendNotification(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                  htmlFor="sendNotification"
                  className="text-xs text-gray-900"
                >
                  Send notification to email
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Role
                </label>
                <input
                  type="text"
                  value={users.find((u) => u.id === selectedSigner)?.role || ""}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-900 capitalize"
                />
              </div>
            </div>
          </div>

          {/* Activities */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Activities
            </h3>

            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-xs text-gray-500">No activities yet</p>
              ) : (
                activities.map((activity) => {
                  // Priority: full_name from logs, username from logs, user from users table, fallback to Unknown
                  const displayName =
                    activity.full_name ||
                    activity.username ||
                    users.find((u) => u.id === activity.user_id)?.full_name ||
                    users.find((u) => u.id === activity.user_id)?.username ||
                    activity.email ||
                    "Unknown User";

                  const initials = displayName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  let actionText = activity.action;
                  if (activity.action === "FILE_UPLOAD") {
                    actionText = `uploaded "${file.original_name}"`;
                  } else if (activity.action === "FILE_DELETE") {
                    actionText = "deleted the document";
                  } else if (activity.action === "FILE_VIEW") {
                    actionText = "viewed the document";
                  } else if (activity.action === "USER_UPDATE") {
                    actionText = "USER_UPDATE";
                  } else if (activity.action === "DELEGATION_CREATE") {
                    actionText = "DELEGATION_CREATE";
                  } else if (activity.action === "USER_CREATE") {
                    actionText = "USER_CREATE";
                  } else if (activity.action === "USER_DELETE") {
                    actionText = "USER_DELETE";
                  }

                  return (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-medium">
                          {initials}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-900">
                          <span className="font-medium">{displayName}</span>{" "}
                          <span className="text-gray-600">{actionText}</span>
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {getTimeAgo(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
