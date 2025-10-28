"use client";

import React, { useState, useEffect } from "react";
import { X, Shield, Key, Loader2 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface ApprovalTOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
  workflowId: string;
  documentName?: string;
}

const ApprovalTOTPModal: React.FC<ApprovalTOTPModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  workflowId,
  documentName,
}) => {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const toast = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setToken("");
      setError("");
      checkTotpStatus();
    }
  }, [isOpen]);

  const checkTotpStatus = async () => {
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("http://localhost:5000/api/auth/totp/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setTotpEnabled(result.data?.isEnabled || false);
      }
    } catch (error) {
      console.error("Failed to check TOTP status:", error);
    }
  };

  const verifyTotp = async () => {
    if (!token || token.length !== 6) {
      setError("Vui lòng nhập mã 6 chữ số");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const authToken = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!authToken) {
        throw new Error("No authentication token found");
      }

      // Use the verify-token endpoint for approval
      const response = await fetch("http://localhost:5000/api/auth/totp/verify-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Mã không hợp lệ");
      }

      const result = await response.json();
      console.log("✅ TOTP verification successful:", result);
      
      toast.success("Xác thực TOTP thành công!");
      onSuccess(token);
      onClose();
    } catch (error) {
      console.error("❌ TOTP verification failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Mã không hợp lệ";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setToken(value);
    setError("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && token.length === 6) {
      verifyTotp();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content modal-content-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Xác thực phê duyệt
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Xác thực phê duyệt tài liệu
              </h3>
              <p className="text-sm text-gray-600">
                {documentName && (
                  <span className="block mb-2 font-medium text-gray-800">
                    Tài liệu: {documentName}
                  </span>
                )}
                Nhập mã 6 chữ số từ Google Authenticator để phê duyệt
              </p>
            </div>

            {!totpEnabled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Shield className="w-5 h-5 text-yellow-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-yellow-800">2FA chưa được kích hoạt</h4>
                    <p className="text-sm text-yellow-700">
                      Vui lòng kích hoạt 2FA trong trang Profile trước khi phê duyệt tài liệu.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {totpEnabled && (
              <>
                {/* Token Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Mã xác thực (6 chữ số)
                  </label>
                  <input
                    type="text"
                    value={token}
                    onChange={handleTokenChange}
                    onKeyPress={handleKeyPress}
                    placeholder="123456"
                    className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    maxLength={6}
                    autoComplete="off"
                  />
                  {error && (
                    <p className="text-sm text-red-600 flex items-center">
                      <X className="w-4 h-4 mr-1" />
                      {error}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={verifyTotp}
                    disabled={loading || token.length !== 6}
                    className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Đang xác thực...
                      </>
                    ) : (
                      "Phê duyệt"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalTOTPModal;
