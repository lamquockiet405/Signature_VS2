"use client";

import React, { useState, useEffect } from "react";
import { Shield, Smartphone, Key, Copy, Check, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface TwoFactorAuthCardProps {
  onSetupComplete?: () => void;
}

interface TwoFAStatus {
  isEnabled: boolean;
  secret?: string;
  qrCode?: string;
}

const TwoFactorAuthCard: React.FC<TwoFactorAuthCardProps> = ({ onSetupComplete }) => {
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFAStatus>({ isEnabled: false });
  const [setupMode, setSetupMode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    checkTwoFAStatus();
  }, []);

  const checkTwoFAStatus = async () => {
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/auth/totp/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTwoFAStatus(data.data || data);
      }
    } catch (error) {
      console.error("Failed to check 2FA status:", error);
    }
  };

  const setupTwoFA = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/auth/totp/setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTwoFAStatus({
          isEnabled: false,
          secret: data.data?.secret || data.secret,
          qrCode: data.data?.qrCodeUrl || data.qrCodeUrl,
        });
        setSetupMode(true);
        toast.success("2FA setup initiated. Please scan QR code and enter verification code.");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to setup 2FA");
      }
    } catch (error) {
      console.error("Failed to setup 2FA:", error);
      toast.error("Failed to setup 2FA");
    } finally {
      setLoading(false);
    }
  };

  const verifyTwoFA = async () => {
    if (!verificationCode.trim()) {
      toast.error("Please enter verification code");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/auth/totp/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: verificationCode.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setTwoFAStatus({ isEnabled: true });
          setSetupMode(false);
          setVerificationCode("");
          toast.success("✅ Bạn đã bật xác thực 2 lớp thành công!");
          onSetupComplete?.();
        } else {
          toast.error("Invalid verification code");
        }
      } else {
        const error = await response.json();
        toast.error(error.message || "Verification failed");
      }
    } catch (error) {
      console.error("Failed to verify 2FA:", error);
      toast.error("Failed to verify 2FA");
    } finally {
      setLoading(false);
    }
  };

  const disableTwoFA = async () => {
    if (!confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/auth/totp/disable", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setTwoFAStatus({ isEnabled: false });
        toast.success("2FA disabled successfully");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to disable 2FA");
      }
    } catch (error) {
      console.error("Failed to disable 2FA:", error);
      toast.error("Failed to disable 2FA");
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Bảo mật 2 lớp</h3>
            <p className="text-sm text-gray-600">Xác thực hai yếu tố (2FA)</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!setupMode ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${twoFAStatus.isEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium text-gray-700">Trạng thái:</span>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  twoFAStatus.isEnabled
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {twoFAStatus.isEnabled ? (
                  <>
                    <Shield className="w-4 h-4 mr-1" />
                    Đã bật
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Chưa bật
                  </>
                )}
              </span>
            </div>

            {/* Description */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                {twoFAStatus.isEnabled ? (
                  <>
                    🔐 <strong>Bảo mật đã được kích hoạt!</strong><br />
                    Tài khoản của bạn được bảo vệ bằng xác thực 2 lớp. Mỗi lần đăng nhập hoặc thực hiện các thao tác quan trọng, bạn sẽ cần nhập mã từ Google Authenticator.
                  </>
                ) : (
                  <>
                    ⚠️ <strong>Bảo mật chưa được kích hoạt</strong><br />
                    Kích hoạt xác thực 2 lớp để tăng cường bảo mật cho tài khoản của bạn. Bạn sẽ cần sử dụng Google Authenticator để tạo mã xác thực.
                  </>
                )}
              </p>
            </div>

            {/* Action Button */}
            {twoFAStatus.isEnabled ? (
              <button
                onClick={disableTwoFA}
                disabled={loading}
                className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Đang xử lý..." : "Tắt bảo mật 2 lớp"}
              </button>
            ) : (
              <button
                onClick={setupTwoFA}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Đang xử lý..." : "Kích hoạt bảo mật 2 lớp (2FA)"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Setup Instructions */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Thiết lập Google Authenticator
              </h4>
              <p className="text-sm text-gray-600">
                Quét mã QR hoặc nhập mã thủ công vào ứng dụng Google Authenticator
              </p>
            </div>

            {/* QR Code */}
            {twoFAStatus.qrCode && (
              <div className="text-center">
                <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <img
                    src={twoFAStatus.qrCode}
                    alt="2FA QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>
            )}

            {/* Manual Entry Key */}
            {twoFAStatus.secret && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Hoặc nhập mã thủ công:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={showSecret ? twoFAStatus.secret : "••••••••••••••••"}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                  />
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title={showSecret ? "Ẩn mã" : "Hiện mã"}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(twoFAStatus.secret || "")}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Sao chép"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Hướng dẫn:</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Mở ứng dụng Google Authenticator</li>
                <li>2. Nhấn "+" để thêm tài khoản</li>
                <li>3. Quét mã QR hoặc nhập mã thủ công</li>
                <li>4. Nhập mã xác thực 6 chữ số bên dưới</li>
              </ol>
            </div>

            {/* Verification Code Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nhập mã xác thực từ Google Authenticator:
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setSetupMode(false);
                  setVerificationCode("");
                }}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={verifyTwoFA}
                disabled={loading || verificationCode.length !== 6}
                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? "Đang xác thực..." : "Xác thực & Kích hoạt"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoFactorAuthCard;
