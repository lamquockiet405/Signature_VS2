"use client";

import { useState } from "react";
import { Upload, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "../../../components/ToastProvider";

interface SignatureDetails {
  reason?: string;
  location?: string;
  contactInfo?: string;
  signedBy?: string;
  signedAt?: string;
}

interface VerificationDetails {
  signedBy: string;
  certificateAuthority: string;
  signatureTimestamp: string;
  certificateStatus: string;
  integrity: string;
  status: string;
}

interface VerificationResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  isSigned: boolean;
  isValid: boolean;
  signatures?: SignatureDetails[];
  message?: string;
}

export default function VerifyDocumentPage() {
  const toast = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  const [verificationDetails, setVerificationDetails] =
    useState<VerificationDetails | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploadedFileName(file.name);
    setIsVerifying(true);
    setIsVerified(false);
    setVerificationResult(null);
    setVerificationDetails(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "http://localhost:5000/api/digital-signature/verify-upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Verification failed");
      }

      const result: VerificationResult = await response.json();
      setVerificationResult(result);

      if (result.isSigned && result.isValid) {
        setIsVerified(true);

        // Extract signature details
        const signature = result.signatures?.[0];
        setVerificationDetails({
          signedBy: signature?.signedBy || "Unknown",
          certificateAuthority: "Digital Signature Authority",
          signatureTimestamp: signature?.signedAt || new Date().toISOString(),
          certificateStatus: result.isValid ? "Active" : "Invalid",
          integrity: "Verified",
          status: "Successfully",
        });

        toast.success("Document verified successfully!");
      } else if (result.isSigned && !result.isValid) {
        setIsVerified(false);
        toast.error("Document signature is invalid or has been tampered with");
      } else {
        setIsVerified(false);
        toast.warning("Document is not signed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to verify document"
      );
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBrowseClick = () => {
    document.getElementById("fileInput")?.click();
  };

  return (
    <div className="flex-1 bg-gray-50">
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Verify document
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Dropzone */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Dropzone
            </h2>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-gray-50"
              }`}
            >
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Upload size={32} className="text-gray-400" />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Drop File Here
              </h3>

              <p className="text-sm text-gray-500 mb-4 text-center">
                Drag and drop your PDF document here or browse
                {uploadedFileName && (
                  <>
                    <br />
                    <span className="text-blue-600 font-medium">
                      {uploadedFileName}
                    </span>
                  </>
                )}
              </p>

              <input
                id="fileInput"
                type="file"
                className="hidden"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
              />

              <button
                onClick={handleBrowseClick}
                disabled={isVerifying}
                className="text-blue-600 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? "Verifying..." : "Browse File"}
              </button>
            </div>

            {/* Details Section */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Details
              </h3>

              <div className="space-y-0">
                <div className="flex justify-between items-center py-4 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Signed By</span>
                  <span className="text-sm font-medium text-gray-900">
                    {verificationDetails?.signedBy || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-4 border-b border-gray-200">
                  <span className="text-sm text-gray-600">
                    Certificate Authority
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {verificationDetails?.certificateAuthority || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-4 border-b border-gray-200">
                  <span className="text-sm text-gray-600">
                    Signature Timestamp
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {verificationDetails?.signatureTimestamp || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-4 border-b border-gray-200">
                  <span className="text-sm text-gray-600">
                    Certificate Status
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {verificationDetails?.certificateStatus || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-4 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Integrity</span>
                  <span className="text-sm font-medium text-gray-900">
                    {verificationDetails?.integrity || "-"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-4">
                  <span className="text-sm text-gray-600">Status</span>
                  {verificationDetails?.status === "Successfully" ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {verificationDetails.status}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-gray-900">
                      {verificationDetails?.status || "-"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Verification Result */}
          <div className="bg-white rounded-lg p-8 flex flex-col items-center justify-center min-h-[500px]">
            {isVerifying ? (
              <div className="text-center">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-blue-100 animate-pulse">
                  <Upload size={48} className="text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Verifying Document...
                </h2>
                <p className="text-gray-600">
                  Please wait while we verify the digital signature
                </p>
              </div>
            ) : isVerified ? (
              <div className="text-center">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-green-100">
                  <CheckCircle size={48} className="text-green-500" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Document Verified Successfully
                </h2>

                <p className="text-gray-600 max-w-md leading-relaxed">
                  The document is authentic and has not been altered since it
                  was signed.
                  <br />
                  All digital signatures are valid and the signing certificates
                  are trusted.
                </p>

                {verificationResult && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">File:</span>{" "}
                      {verificationResult.fileName}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Size:</span>{" "}
                      {(verificationResult.fileSize / 1024).toFixed(2)} KB
                    </p>
                    {verificationResult.signatures &&
                      verificationResult.signatures.length > 0 && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Signatures:</span>{" "}
                          {verificationResult.signatures.length}
                        </p>
                      )}
                  </div>
                )}
              </div>
            ) : verificationResult && !verificationResult.isValid ? (
              <div className="text-center">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-red-100">
                  <XCircle size={48} className="text-red-500" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Verification Failed
                </h2>

                <p className="text-gray-600 max-w-md leading-relaxed">
                  {verificationResult.message ||
                    "The document signature is invalid or the document has been tampered with."}
                </p>
              </div>
            ) : verificationResult && !verificationResult.isSigned ? (
              <div className="text-center">
                <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-yellow-100">
                  <AlertCircle size={48} className="text-yellow-500" />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Document Not Signed
                </h2>

                <p className="text-gray-600 max-w-md leading-relaxed">
                  This document does not contain any digital signatures.
                </p>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-8">
                  <Upload size={48} className="text-gray-300" />
                </div>
                <p className="text-lg text-gray-500">
                  Upload a PDF document to verify
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
