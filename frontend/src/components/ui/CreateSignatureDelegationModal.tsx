"use client";

import React, { useState, useEffect } from "react";
import {
  documentSignaturesAPI,
  filesAPI,
  usersAPI,
  authAPI,
  isReadOnlyUser,
} from "@/lib/api";

interface CreateSignatureDelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  documentId?: string;
}

interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: string;
}

interface File {
  id: string;
  original_name: string;
  filename: string;
}

export default function CreateSignatureDelegationModal({
  isOpen,
  onClose,
  onSuccess,
  documentId,
}: CreateSignatureDelegationModalProps) {
  const [formData, setFormData] = useState({
    document_id: documentId || "",
    delegator_id: "",
    delegate_id: "",
    workflow_type: "delegation",
    expires_at: "",
    reason: "",
  });

  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update formData when documentId prop changes
  useEffect(() => {
    if (documentId) {
      setFormData((prev) => ({
        ...prev,
        document_id: documentId,
      }));
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      // Only fetch users if the current user has a role that can read users
      const currentUser = authAPI.getCurrentUser();
      const role = currentUser?.role?.toLowerCase() || null;
      if (["admin", "manager", "user"].includes(role)) fetchUsers();
      // Always fetch documents to populate the dropdown, even if documentId is pre-selected
      fetchDocuments();
    }
  }, [isOpen, documentId]);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll(1, 1000);
      setUsers(response.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await filesAPI.getAll(1, 1000);
      setDocuments(response.files || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    // If workflow type changes, clear delegator_id for delegation type
    if (name === "workflow_type" && value === "delegation") {
      setFormData((prev) => ({
        ...prev,
        delegator_id: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.document_id) {
      newErrors.document_id = "Document is required";
    }

    // For approval workflow, delegator_id is required
    if (formData.workflow_type === "approval" && !formData.delegator_id) {
      newErrors.delegator_id = "Delegator is required for approval workflow";
    }

    if (!formData.delegate_id) {
      newErrors.delegate_id = "Delegate is required";
    }

    if (formData.delegator_id && formData.delegator_id === formData.delegate_id) {
      newErrors.delegate_id = "Cannot delegate to yourself";
    }

    if (!formData.expires_at) {
      newErrors.expires_at = "Expiration date is required";
    } else {
      const expirationDate = new Date(formData.expires_at);
      const now = new Date();
      if (expirationDate <= now) {
        newErrors.expires_at = "Expiration date must be in the future";
      }
    }

    if (!formData.reason.trim()) {
      newErrors.reason = "Reason is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isReadOnlyUser()) {
        setErrors({ submit: "Bạn không có quyền thực hiện hành động này" });
        return;
      }
      const dataToSend = {
        document_id: formData.document_id,
        delegator_id: formData.workflow_type === "approval" ? formData.delegator_id : undefined,
        delegate_id: formData.delegate_id,
        workflow_type: formData.workflow_type,
        reason: formData.reason,
        end_date: formData.expires_at,
        metadata: {
          created_by: formData.delegator_id || "current_user",
        },
      };

      await documentSignaturesAPI.create(dataToSend);

      onSuccess();
      onClose();

      // Reset form
      setFormData({
        document_id: documentId || "",
        delegator_id: "",
        delegate_id: "",
        workflow_type: "delegation",
        expires_at: "",
        reason: "",
      });
      setErrors({});
    } catch (error: unknown) {
      console.error("Error creating signature delegation:", error);
      const msg =
        error && typeof error === "object" && "message" in error
          ? (error as Record<string, unknown>)["message"]
          : "Failed to create signature delegation";
      setErrors({ submit: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content modal-content-md p-6">
        <div className="modal-header">
          <h2 className="modal-title">
            Create Workflow Authorization
          </h2>
          <button
            onClick={onClose}
            className="modal-close-button"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Document Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document *
            </label>
            <select
              name="document_id"
              value={formData.document_id}
              onChange={handleInputChange}
              disabled={!!documentId}
              className={`w-full px-3 py-2 border rounded-lg ${
                errors.document_id ? "border-red-500" : "border-gray-300"
              } ${documentId ? "bg-gray-100" : ""}`}
            >
              <option value="">Select a document</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.original_name}
                </option>
              ))}
            </select>
            {errors.document_id && (
              <p className="text-red-500 text-sm mt-1">{errors.document_id}</p>
            )}
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type *
            </label>
            <select
              name="workflow_type"
              value={formData.workflow_type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="delegation">Delegation</option>
              <option value="approval">Approval</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              {formData.workflow_type === "delegation" 
                ? "Delegate can sign immediately" 
                : "Delegate must wait for approval before signing"}
            </p>
          </div>

          {/* Delegator Selection - Only show for Approval */}
          {formData.workflow_type === "approval" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delegator (Person giving permission) *
              </label>
              <select
                name="delegator_id"
                value={formData.delegator_id}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.delegator_id ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">Select delegator</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.username} ({user.email}) - {user.role}
                  </option>
                ))}
              </select>
              {errors.delegator_id && (
                <p className="text-red-500 text-sm mt-1">{errors.delegator_id}</p>
              )}
            </div>
          )}

          {/* Delegate Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delegate (Person receiving permission) *
            </label>
            <select
              name="delegate_id"
              value={formData.delegate_id}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg ${
                errors.delegate_id ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select delegate</option>
              {users
                .filter((user) => user.id !== formData.delegator_id)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.username} ({user.email}) -{" "}
                    {user.role}
                  </option>
                ))}
            </select>
            {errors.delegate_id && (
              <p className="text-red-500 text-sm mt-1">{errors.delegate_id}</p>
            )}
          </div>


          {/* Expiration Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiration Date *
            </label>
            <input
              type="datetime-local"
              name="expires_at"
              value={formData.expires_at}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg ${
                errors.expires_at ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.expires_at && (
              <p className="text-red-500 text-sm mt-1">{errors.expires_at}</p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason *
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              rows={3}
              placeholder="Explain why you are delegating signing rights..."
              className={`w-full px-3 py-2 border rounded-lg ${
                errors.reason ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.reason && (
              <p className="text-red-500 text-sm mt-1">{errors.reason}</p>
            )}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Workflow"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
