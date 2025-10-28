"use client";

import React, { useState } from "react";
import { X, Mail, Smartphone, Loader2 } from "lucide-react";
import TOTPModal from "./TOTPModal";

interface OTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string) => void;
  action: "sign" | "approve";
}

const OTPModal: React.FC<OTPModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  action,
}) => {
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailOTP = async () => {
    setLoading(true);
    // TODO: Implement email OTP logic
    setTimeout(() => {
      setLoading(false);
      // For now, just call onSuccess with a dummy token
      onSuccess("email-otp-token");
      onClose();
    }, 2000);
  };

  const handleGoogleAuthenticator = () => {
    setShowTotpModal(true);
  };

  const handleTotpSuccess = (token: string) => {
    onSuccess(token);
    onClose();
  };

  const handleClose = () => {
    setShowTotpModal(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop">
        <div className="modal-content modal-content-sm">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              Chọn phương thức xác thực
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="text-center mb-6">
              <p className="text-gray-600">
                Vui lòng chọn phương thức xác thực để {action === "sign" ? "ký" : "phê duyệt"} tài liệu
              </p>
            </div>

            <div className="space-y-4">
              {/* Email OTP Option */}
              <button
                onClick={handleEmailOTP}
                disabled={loading}
                className="w-full p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">Email OTP</h3>
                    <p className="text-sm text-gray-600">
                      Gửi mã xác thực qua email
                    </p>
                  </div>
                  {loading && (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600 ml-auto" />
                  )}
                </div>
              </button>

              {/* Google Authenticator Option */}
              <button
                onClick={handleGoogleAuthenticator}
                className="w-full p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900">Google Authenticator</h3>
                    <p className="text-sm text-gray-600">
                      Sử dụng ứng dụng Google Authenticator
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Info */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Lưu ý:</strong> Google Authenticator cung cấp bảo mật cao hơn và không phụ thuộc vào kết nối internet.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TOTP Modal */}
      <TOTPModal
        isOpen={showTotpModal}
        onClose={() => setShowTotpModal(false)}
        onSuccess={handleTotpSuccess}
        action={action}
      />
    </>
  );
};

export default OTPModal;
