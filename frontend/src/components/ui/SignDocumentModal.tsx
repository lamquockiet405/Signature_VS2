"use client";

import React, { useState, useEffect } from "react";
import { documentSignaturesAPI, usersAPI, companyAPI } from "@/lib/api";

interface SignDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  delegation: {
    id: string;
    document_id: string;
    document_name: string;
    delegate_id: string;
    delegate_name: string;
    delegator_name: string;
    reason: string;
  };
}

export default function SignDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  delegation,
}: SignDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totpToken, setTotpToken] = useState("");
  const [showTotpInput, setShowTotpInput] = useState(false);
  const [formData, setFormData] = useState({
    name: delegation.delegate_name || "",
    reason: delegation.reason || "Document approval",
    location: "Vietnam",
    contact: "",
    organizationUnit: "",
    organizationName: "",
    // ✅ keyId removed - auto-key system handles this on backend
  });

  // Load user and company data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadUserAndCompanyData();
    }
  }, [isOpen, delegation.delegate_id]);

  const loadUserAndCompanyData = async () => {
    setLoadingData(true);
    try {
      // Fetch user and company info in parallel
      const [userData, companyData] = await Promise.all([
        usersAPI.getById(delegation.delegate_id),
        companyAPI.get(),
      ]);

      console.log("👤 User data:", userData);
      console.log("🏢 Company data:", companyData);

      // Auto-fill form with database values
      setFormData((prev) => ({
        ...prev,
        contact: userData.email || "",
        organizationUnit: userData.department || companyData.department || "",
        organizationName: companyData.name || "",
      }));
    } catch (err) {
      console.error("❌ Failed to load user/company data:", err);
      // Non-critical error, allow user to continue
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Check if TOTP is required
      if (!showTotpInput) {
        // First step: Check if user has 2FA enabled
        const token = localStorage.getItem("access_token") || localStorage.getItem("token");
        const response = await fetch("http://localhost:5000/api/auth/totp/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.data?.isEnabled) {
            setShowTotpInput(true);
            setLoading(false);
            return; // Show TOTP input
          }
        }
      }

      // Validate TOTP if required
      if (showTotpInput && !totpToken.trim()) {
        throw new Error("Please enter your 2FA verification code");
      }

      // Validate document_id
      if (!delegation.document_id) {
        throw new Error(
          "Document ID is missing. This delegation may not be linked to a document. Please contact administrator."
        );
      }

      const requestBody = {
        documentId: delegation.document_id,
        // ✅ keyId removed - auto-key system handles this on backend
        placeholder: "{{SIGNATURE_PLACEHOLDER}}",
        totpToken: showTotpInput ? totpToken.trim() : undefined, // Include TOTP if provided
        metadata: {
          name: formData.name,
          reason: formData.reason,
          location: formData.location,
          contact: formData.contact,
          organizationUnit: formData.organizationUnit,
          organizationName: formData.organizationName,
        },
      };

      // Call document signatures sign endpoint (for delegation workflow)
      console.log("🔐 === SIGNING DOCUMENT via DELEGATION (AUTO-KEY) ===");
      console.log("Delegation ID:", delegation.id);
      console.log("Document ID:", delegation.document_id);
      console.log("Delegate ID:", delegation.delegate_id);
      console.log("Request Body:", JSON.stringify(requestBody, null, 2));

      const result = await documentSignaturesAPI.sign(delegation.id, {
        ...requestBody,
        userId: delegation.delegate_id, // Pass user ID for auth
      });

      console.log("✅ Signature result:", result);

      alert(
        "✅ Document signed successfully!\n\nFile saved at: " +
          result.signedPath
      );
      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("❌ Signing error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/30 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Sign Document with Digital Signature
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Document: {delegation.document_name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                <svg
                  className="h-6 w-6"
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
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            {loadingData && (
              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center">
                  <svg
                    className="animate-spin h-5 w-5 text-blue-600 mr-3"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <p className="text-sm text-blue-600">
                    Đang tải thông tin từ database...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
              <div className="flex">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    PAdES Compliant Signature
                  </h4>
                  <p className="mt-1 text-sm text-blue-700">
                    This will create a digital signature that is recognized by
                    Adobe Acrobat Reader as valid according to PAdES (PDF
                    Advanced Electronic Signature) standards.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Signer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signer Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Signing *
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Document approval, Contract signing"
                  required
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Hanoi, Ho Chi Minh City"
                  required
                />
              </div>

              {/* Contact Email (Auto-filled from database) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  � Tu dong lay tu thong tin nguoi dung trong database
                </p>
              </div>

              {/* Organization Unit (Auto-filled from database) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Unit
                </label>
                <input
                  type="text"
                  value={formData.organizationUnit}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  🏢 Tu dong lay tu phong ban trong database
                </p>
              </div>

              {/* Organization Name (Auto-filled from database) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={formData.organizationName}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  🏛️ Tu dong lay tu thong tin cong ty trong database
                </p>
              </div>

              {/* 2FA Verification */}
              {showTotpInput && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <div className="flex">
                    <svg
                      className="h-5 w-5 text-yellow-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-800">
                        🔐 Two-Factor Authentication Required
                      </h4>
                      <p className="mt-1 text-sm text-yellow-700">
                        Please enter your 6-digit verification code from your authenticator app.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Verification Code *
                    </label>
                    <input
                      type="text"
                      value={totpToken}
                      onChange={(e) => setTotpToken(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      autoComplete="off"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter the 6-digit code from your Google Authenticator or similar app.
                    </p>
                  </div>
                </div>
              )}

              {/* ✅ HSM Key ID - AN (AUTO-KEY SYSTEM) */}
              {/* He thong tu dong sinh va quan ly key cho user */}
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex">
                  <svg
                    className="h-5 w-5 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-green-800">
                      🔐 Auto-Key Signing System
                    </h4>
                    <p className="mt-1 text-sm text-green-700">
                      He thong se tu dong tao va quan ly khoa ky so cho ban. Ban
                      khong can nhap hoac chon key ID.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Delegation Info */}
            <div className="mt-6 rounded-lg bg-gray-50 border border-gray-200 p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Delegation Information
              </h4>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-gray-600">Delegated by:</span>{" "}
                  <span className="font-medium">
                    {delegation.delegator_name}
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">Delegate:</span>{" "}
                  <span className="font-medium">
                    {delegation.delegate_name}
                  </span>
                </p>
                <p>
                  <span className="text-gray-600">Original reason:</span>{" "}
                  <span className="font-medium">{delegation.reason}</span>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {showTotpInput ? "Verifying..." : "Signing..."}
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {showTotpInput ? "Verify & Sign Document" : "Sign Document"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
