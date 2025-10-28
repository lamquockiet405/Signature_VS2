"use client";

import { X, Upload } from "lucide-react";
import { useState } from "react";
import { filesAPI, getCurrentUserId, isReadOnlyUser } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void; // Callback để refresh danh sách
}

export default function UploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: UploadModalProps) {
  const [formData, setFormData] = useState({
    documentName: "",
    documentType: "Reports",
    description: "",
    priority: "Urgent",
    expirationDate: "",
    signerName: "Lindsey Curtis",
    signerEmail: "lindsey@example.com",
    sendNotification: true,
    signerRole: "CEO",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Set document name from filename if not already set
    if (!formData.documentName) {
      setFormData({ ...formData, documentName: file.name });
    }

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(""); // Clear preview for non-image files
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block read-only users from uploading
    if (isReadOnlyUser()) {
      toast.error("Bạn không có quyền thực hiện hành động này");
      return;
    }

    if (!selectedFile) {
      toast.warning("Please select a file to upload");
      return;
    }

    try {
      setUploading(true);

      // Use the authenticated user's id when available
      const userId =
        getCurrentUserId() || "00000000-0000-0000-0000-000000000000";

      console.log("Uploading file:", {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        userId: userId,
        description: formData.description,
      });

      // Normalize document name to include file extension
      let documentNameToSend = formData.documentName.trim();
      const ext = selectedFile.name.includes(".")
        ? "." + selectedFile.name.split(".").pop()
        : "";
      if (
        ext &&
        documentNameToSend &&
        !documentNameToSend.toLowerCase().endsWith(ext.toLowerCase())
      ) {
        documentNameToSend = `${documentNameToSend}${ext}`;
      }

      // Upload file to server
      const result = await filesAPI.upload(
        selectedFile,
        userId,
        formData.description,
        documentNameToSend
      );

      console.log("File uploaded successfully:", result);

      // Show success message
      toast.success("Document uploaded successfully!");

      // Reset form
      setFormData({
        documentName: "",
        documentType: "Reports",
        description: "",
        priority: "Urgent",
        expirationDate: "",
        signerName: "Lindsey Curtis",
        signerEmail: "lindsey@example.com",
        sendNotification: true,
        signerRole: "CEO",
      });
      setSelectedFile(null);
      setFilePreview("");

      // Call callback to refresh documents list
      if (onUploadSuccess) {
        onUploadSuccess();
      }

      // Close modal
      onClose();
    } catch (error: unknown) {
      console.error("Error uploading file:", error);

      // Extract detailed error message
      let errorMessage = "Failed to upload file. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        errorMessage = String((error as { message: unknown }).message);
      }

      console.error("Detailed error:", errorMessage);
      toast.error(errorMessage || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-start justify-end z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl ml-4 mt-12">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Upload new document
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Dropzone */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Dropzone
              </label>
              <label
                htmlFor="file-upload-document"
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center block cursor-pointer hover:border-blue-400 transition-colors"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="text-gray-400" size={20} />
                </div>
                <h4 className="text-sm font-medium text-gray-900 mb-1">
                  Drop file here
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Drag and drop your PDF, PNG, JPG, WebP, SVG files here or
                  browse
                </p>
                <span className="text-sm text-blue-600 hover:underline">
                  Browse file
                </span>
                {selectedFile && (
                  <div className="mt-3 text-sm text-gray-700">
                    Selected:{" "}
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                )}
                {filePreview && (
                  <div className="mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={filePreview}
                      alt="File preview"
                      className="max-w-full max-h-32 mx-auto rounded-lg border border-gray-200"
                    />
                  </div>
                )}
              </label>
              <input
                id="file-upload-document"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Document Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Document Information
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter document name"
                    value={formData.documentName}
                    onChange={(e) =>
                      setFormData({ ...formData, documentName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document type
                  </label>
                  <select
                    value={formData.documentType}
                    onChange={(e) =>
                      setFormData({ ...formData, documentType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option>Reports</option>
                    <option>Forms</option>
                    <option>Contracts</option>
                    <option>Invoices</option>
                    <option>Approvals</option>
                    <option>Agreements</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter your description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option>Urgent</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Date
                  </label>
                  <input
                    type="date"
                    placeholder="dd/mm/yyyy"
                    value={formData.expirationDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expirationDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Signer */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Signer
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full name
                  </label>
                  <select
                    value={formData.signerName}
                    onChange={(e) =>
                      setFormData({ ...formData, signerName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option>Lindsey Curtis</option>
                    <option>John Doe</option>
                    <option>Jane Smith</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.signerEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, signerEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notification"
                    checked={formData.sendNotification}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sendNotification: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="notification"
                    className="text-sm text-gray-900"
                  >
                    Send notification to email
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <input
                    type="text"
                    value={formData.signerRole}
                    onChange={(e) =>
                      setFormData({ ...formData, signerRole: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              <Upload size={16} />
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
