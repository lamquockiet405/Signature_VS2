"use client";

import React, { useState, useEffect } from "react";
import { X, Smartphone, Key, Copy, Check, Loader2, Shield } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface TOTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
  action: "sign" | "approve" | "verify";
  title?: string;
  description?: string;
}

interface TOTPSetupData {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
  otpauthUrl: string;
}

const TOTPModal: React.FC<TOTPModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  action,
  title,
  description,
}) => {
  const [step, setStep] = useState<"setup" | "verify">("verify");
  const [setupData, setSetupData] = useState<TOTPSetupData | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const toast = useToast();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("verify");
      setSetupData(null);
      setToken("");
      setError("");
      setCopied(false);
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
        
        if (!result.data?.isEnabled) {
          // If TOTP is not enabled, show setup
          setStep("setup");
          setupTotp();
        }
      }
    } catch (error) {
      console.error("Failed to check TOTP status:", error);
      // Default to setup if we can't check status
      setStep("setup");
      setupTotp();
    }
  };

  const setupTotp = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("http://localhost:5000/api/auth/totp/setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to setup TOTP");
      }

      const result = await response.json();
      setSetupData(result.data);
      console.log("✅ TOTP setup completed:", result.data);
    } catch (error) {
      console.error("❌ TOTP setup failed:", error);
      setError(error instanceof Error ? error.message : "Failed to setup TOTP");
      toast.error("Không thể tạo TOTP secret");
    } finally {
      setLoading(false);
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

      // For signing/approval, we need to verify the token directly
      if (action === "sign" || action === "approve") {
        // Use the new verify-token endpoint for signing/approval
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
      } else {
        // For setup verification
        const response = await fetch("http://localhost:5000/api/auth/totp/verify", {
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
        setTotpEnabled(true);
        onSuccess(token);
        onClose();
      }
    } catch (error) {
      console.error("❌ TOTP verification failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Mã không hợp lệ";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Đã sao chép!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Không thể sao chép");
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
            {action === "sign" || action === "approve" ? (
              <Shield className="w-6 h-6 text-green-600" />
            ) : (
              <Smartphone className="w-6 h-6 text-blue-600" />
            )}
            <h2 className="text-xl font-semibold text-gray-900">
              {title || (action === "sign" ? "Xác thực ký tài liệu" : action === "approve" ? "Xác thực phê duyệt" : "Xác thực Google Authenticator")}
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
          {step === "setup" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Thiết lập Google Authenticator
                </h3>
                <p className="text-sm text-gray-600">
                  Quét mã QR hoặc nhập mã thủ công vào ứng dụng Google Authenticator
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Đang tạo mã QR...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-4">
                    <X className="w-12 h-12 mx-auto mb-2" />
                    <p className="font-medium">Lỗi thiết lập</p>
                    <p className="text-sm">{error}</p>
                  </div>
                  <button
                    onClick={setupTotp}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Thử lại
                  </button>
                </div>
              ) : setupData ? (
                <>
                  {/* QR Code */}
                  <div className="text-center">
                    <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
                      <img
                        src={setupData.qrCodeUrl}
                        alt="TOTP QR Code"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>

                  {/* Manual Entry Key */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Hoặc nhập mã thủ công:
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={setupData.manualEntryKey}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(setupData.manualEntryKey)}
                        className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Sao chép"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Hướng dẫn:</h4>
                    <ol className="text-sm text-blue-800 space-y-1">
                      <li>1. Mở ứng dụng Google Authenticator</li>
                      <li>2. Nhấn "+" để thêm tài khoản</li>
                      <li>3. Quét mã QR hoặc nhập mã thủ công</li>
                      <li>4. Nhấn "Tiếp tục" để xác thực</li>
                    </ol>
                  </div>

                  {/* Continue Button */}
                  <button
                    onClick={() => setStep("verify")}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Tiếp tục
                  </button>
                </>
              ) : null}
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {action === "sign" ? "Xác thực ký tài liệu" : action === "approve" ? "Xác thực phê duyệt" : "Nhập mã xác thực"}
                </h3>
                <p className="text-sm text-gray-600">
                  {description || (action === "sign" ? "Nhập mã 6 chữ số từ Google Authenticator để ký tài liệu" : action === "approve" ? "Nhập mã 6 chữ số từ Google Authenticator để phê duyệt" : "Nhập mã 6 chữ số từ ứng dụng Google Authenticator")}
                </p>
              </div>

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
                  className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  onClick={() => setStep("setup")}
                  className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Quay lại
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
                    "Xác thực"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TOTPModal;
