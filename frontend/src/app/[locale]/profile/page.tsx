"use client";

import React, { useState, useEffect } from "react";
import { User, Shield, Settings } from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  totp_enabled: boolean;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [twoFAStatus, setTwoFAStatus] = useState({ isEnabled: false });
  const [setupMode, setSetupMode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");

  useEffect(() => {
    fetchUserProfile();
    checkTwoFAStatus();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("http://localhost:5000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user || data);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    } finally {
      setLoading(false);
    }
  };

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
        setQrCode(data.data?.qrCodeUrl || data.qrCodeUrl);
        setSecret(data.data?.secret || data.secret);
        setSetupMode(true);
        alert("2FA setup initiated. Please scan QR code and enter verification code.");
      } else {
        const error = await response.json();
        alert(error.message || "Failed to setup 2FA");
      }
    } catch (error) {
      console.error("Failed to setup 2FA:", error);
      alert("Failed to setup 2FA");
    }
  };

  const verifyTwoFA = async () => {
    if (!verificationCode.trim()) {
      alert("Please enter verification code");
      return;
    }

    try {
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
          alert("✅ Bạn đã bật xác thực 2 lớp thành công!");
        } else {
          alert("Invalid verification code");
        }
      } else {
        const error = await response.json();
        alert(error.message || "Verification failed");
      }
    } catch (error) {
      console.error("Failed to verify 2FA:", error);
      alert("Failed to verify 2FA");
    }
  };

  const disableTwoFA = async () => {
    if (!confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) {
      return;
    }

    try {
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
        alert("2FA disabled successfully");
      } else {
        const error = await response.json();
        alert(error.message || "Failed to disable 2FA");
      }
    } catch (error) {
      console.error("Failed to disable 2FA:", error);
      alert("Failed to disable 2FA");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user?.full_name || user?.username}</h1>
              <p className="text-gray-600 text-lg">{user?.email}</p>
              <div className="flex items-center space-x-4 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {user?.role}
                </span>
                {twoFAStatus.isEnabled && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <Shield className="w-4 h-4 mr-1" />
                    2FA Enabled
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Thông tin cá nhân</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tên đăng nhập</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-900 font-medium">{user?.username}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-900 font-medium">{user?.email}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Họ và tên</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-900 font-medium">{user?.full_name}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vai trò</label>
                  <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-900 font-medium">{user?.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="space-y-6">
            {/* Two-Factor Authentication */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Bảo mật 2 lớp</h3>
                  <p className="text-sm text-gray-600">Xác thực hai yếu tố (2FA)</p>
                </div>
              </div>

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
                      {twoFAStatus.isEnabled ? "Đã bật" : "Chưa bật"}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      {twoFAStatus.isEnabled ? (
                        <>
                          🔐 <strong>Bảo mật đã được kích hoạt!</strong><br />
                          Tài khoản của bạn được bảo vệ bằng xác thực 2 lớp.
                        </>
                      ) : (
                        <>
                          ⚠️ <strong>Bảo mật chưa được kích hoạt</strong><br />
                          Kích hoạt xác thực 2 lớp để tăng cường bảo mật.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Action Button */}
                  {twoFAStatus.isEnabled ? (
                    <button
                      onClick={disableTwoFA}
                      className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      Tắt bảo mật 2 lớp
                    </button>
                  ) : (
                    <button
                      onClick={setupTwoFA}
                      className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Kích hoạt bảo mật 2 lớp (2FA)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Setup Instructions */}
                  <div className="text-center">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Thiết lập Google Authenticator
                    </h4>
                    <p className="text-sm text-gray-600">
                      Quét mã QR hoặc nhập mã thủ công vào ứng dụng Google Authenticator
                    </p>
                  </div>

                  {/* QR Code */}
                  {qrCode && (
                    <div className="text-center">
                      <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <img
                          src={qrCode}
                          alt="2FA QR Code"
                          className="w-48 h-48"
                        />
                      </div>
                    </div>
                  )}

                  {/* Manual Entry Key */}
                  {secret && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Hoặc nhập mã thủ công:
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={showSecret ? secret : "••••••••••••••••"}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                        />
                        <button
                          onClick={() => setShowSecret(!showSecret)}
                          className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                          title={showSecret ? "Ẩn mã" : "Hiện mã"}
                        >
                          {showSecret ? "👁️‍🗨️" : "👁️"}
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
                      disabled={verificationCode.length !== 6}
                      className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      Xác thực & Kích hoạt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}