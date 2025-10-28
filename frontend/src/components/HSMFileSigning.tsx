import React, { useState, useEffect } from 'react';
import { hsmFileSigningAPI, filesAPI } from '../lib/api';
import { useToast } from '../hooks/useToast';

interface UserFile {
  id: number;
  original_filename: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  status: string;
}

interface HSMKey {
  keyId: string;
  keyType: string;
  keySize: number;
  algorithm: string;
  keyLabel: string;
  status: string;
  createdAt: string;
}

interface HSMFileSigningProps {
  onSigningComplete?: (signatureId: string) => void;
}

const HSMFileSigning: React.FC<HSMFileSigningProps> = ({
  onSigningComplete,
}) => {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [hsmKeys, setHsmKeys] = useState<HSMKey[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [signerInfo, setSignerInfo] = useState({
    signerName: '',
    signerEmail: '',
    reason: 'Digital signature',
    location: 'Vietnam',
  });
  const [isSigning, setIsSigning] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const toast = useToast();

  // Load files and HSM keys on component mount
  useEffect(() => {
    loadFiles();
    loadHSMKeys();
  }, []);

  const loadFiles = async () => {
    try {
      const response = await filesAPI.getFiles();
      if (response.data?.success !== false) {
        const list = response.data.data?.files || [];
        // Only show files that haven't been signed yet
        const unsignedFiles = list.filter((file: UserFile) => file.status !== 'signed');
        setFiles(unsignedFiles);
        if (unsignedFiles.length > 0) {
          setSelectedFileId(unsignedFiles[0].id.toString());
        }
      }
    } catch (e) {
      console.error('Error loading files:', e);
      setError('Không thể tải danh sách file');
    }
  };

  const loadHSMKeys = async () => {
    try {
      setIsLoadingKeys(true);
      const response = await hsmFileSigningAPI.listKeys({
        status: 'active',
        keyType: 'RSA',
      });
      
      if (response.success) {
        const keys = response.data.keys || [];
        setHsmKeys(keys);
        if (keys.length > 0) {
          setSelectedKeyId(keys[0].keyId);
        }
      }
    } catch (e) {
      console.error('Error loading HSM keys:', e);
      setError('Không thể tải danh sách HSM keys');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const generateNewKey = async () => {
    try {
      setIsLoadingKeys(true);
      const response = await hsmFileSigningAPI.generateKey({
        keyType: 'RSA',
        keySize: 2048,
        label: `HSM_SignKey_${Date.now()}`,
        usage: 'sign',
      });

      if (response.success) {
        toast.success('HSM key generated successfully!');
        await loadHSMKeys(); // Reload keys
      } else {
        throw new Error(response.message || 'Failed to generate key');
      }
    } catch (e: any) {
      console.error('Error generating HSM key:', e);
      toast.error(e.message || 'Failed to generate HSM key');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const signFileWithHSM = async () => {
    if (!selectedFileId) {
      setError('Vui lòng chọn file');
      return;
    }

    if (!signerInfo.signerName.trim()) {
      setError('Vui lòng nhập tên người ký');
      return;
    }

    setIsSigning(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔐 Starting HSM file signing process...');
      console.log('📄 File ID:', selectedFileId);
      console.log('🔑 Key ID:', selectedKeyId);
      console.log('👤 Signer Info:', signerInfo);

      const response = await hsmFileSigningAPI.signFile({
        fileId: selectedFileId,
        keyId: selectedKeyId || undefined,
        signerInfo: {
          signerName: signerInfo.signerName,
          signerEmail: signerInfo.signerEmail || undefined,
          reason: signerInfo.reason || undefined,
          location: signerInfo.location || undefined,
        },
        metadata: {
          signingMethod: 'hsm',
          timestamp: new Date().toISOString(),
        },
      });

      if (response.success) {
        setSuccess('File đã được ký số thành công bằng HSM!');
        toast.success('File signed successfully with HSM!');
        
        if (onSigningComplete) {
          onSigningComplete(response.signatureId);
        }

        // Reset form
        setSignerInfo({
          signerName: '',
          signerEmail: '',
          reason: 'Digital signature',
          location: 'Vietnam',
        });

        // Reload files to update status
        await loadFiles();
      } else {
        throw new Error(response.message || 'Failed to sign file');
      }
    } catch (e: any) {
      console.error('❌ HSM signing failed:', e);
      const errorMessage = e.message || 'Có lỗi xảy ra khi ký file';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSigning(false);
    }
  };

  const downloadSignedFile = async (signatureId: string) => {
    try {
      const { blob, filename } = await hsmFileSigningAPI.downloadSignedFile(signatureId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('File downloaded successfully!');
    } catch (e: any) {
      console.error('❌ Download failed:', e);
      toast.error(e.message || 'Failed to download signed file');
    }
  };

  return (
    <div className="hsm-file-signing-container max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        🔐 HSM File Signing
      </h2>
      
      {/* File Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chọn File để Ký
        </label>
        <select
          value={selectedFileId}
          onChange={(e) => setSelectedFileId(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Chọn file --</option>
          {files.map((file) => (
            <option key={file.id} value={file.id.toString()}>
              {file.original_filename} ({file.file_type})
            </option>
          ))}
        </select>
        {files.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Không có file nào để ký. Vui lòng upload file trước.
          </p>
        )}
      </div>

      {/* HSM Key Selection */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            HSM Key để Ký
          </label>
          <button
            onClick={generateNewKey}
            disabled={isLoadingKeys}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm"
          >
            {isLoadingKeys ? 'Generating...' : 'Generate New Key'}
          </button>
        </div>
        
        <select
          value={selectedKeyId}
          onChange={(e) => setSelectedKeyId(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoadingKeys}
        >
          <option value="">-- Auto-select key --</option>
          {hsmKeys.map((key) => (
            <option key={key.keyId} value={key.keyId}>
              {key.keyLabel} ({key.keyType}-{key.keySize})
            </option>
          ))}
        </select>
        
        {hsmKeys.length === 0 && !isLoadingKeys && (
          <p className="text-sm text-gray-500 mt-2">
            Chưa có HSM key nào. Nhấn "Generate New Key" để tạo key mới.
          </p>
        )}
      </div>

      {/* Signer Information */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tên người ký *
          </label>
          <input
            type="text"
            value={signerInfo.signerName}
            onChange={(e) => setSignerInfo({ ...signerInfo, signerName: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nhập tên người ký"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email người ký
          </label>
          <input
            type="email"
            value={signerInfo.signerEmail}
            onChange={(e) => setSignerInfo({ ...signerInfo, signerEmail: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nhập email người ký"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Lý do ký
          </label>
          <input
            type="text"
            value={signerInfo.reason}
            onChange={(e) => setSignerInfo({ ...signerInfo, reason: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nhập lý do ký"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Địa điểm ký
          </label>
          <input
            type="text"
            value={signerInfo.location}
            onChange={(e) => setSignerInfo({ ...signerInfo, location: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nhập địa điểm ký"
          />
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={signFileWithHSM}
          disabled={!selectedFileId || !signerInfo.signerName.trim() || isSigning}
          className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSigning ? '🔐 Đang ký với HSM...' : '🔐 Ký File với HSM'}
        </button>
        
        <button
          onClick={() => {
            setError('');
            setSuccess('');
            setSignerInfo({
              signerName: '',
              signerEmail: '',
              reason: 'Digital signature',
              location: 'Vietnam',
            });
          }}
          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* HSM Status */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">🔐 HSM Information</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Available Keys:</strong> {hsmKeys.length}</p>
          <p><strong>Selected Key:</strong> {selectedKeyId || 'Auto-select'}</p>
          <p><strong>Signing Method:</strong> HSM (Hardware Security Module)</p>
          <p><strong>Security Level:</strong> High (Private keys never leave HSM)</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-medium text-yellow-800 mb-2">📋 Hướng dẫn sử dụng HSM:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Chọn file cần ký từ danh sách (chỉ hiển thị file chưa ký)</li>
          <li>• Chọn HSM key hoặc để hệ thống tự động chọn</li>
          <li>• Nhập thông tin người ký (tên là bắt buộc)</li>
          <li>• Nhấn "Ký File với HSM" để bắt đầu quá trình ký</li>
          <li>• File sẽ được gửi lên HSM service để ký số an toàn</li>
          <li>• Private key luôn nằm trong HSM, không bao giờ rời khỏi hardware</li>
        </ul>
      </div>
    </div>
  );
};

export default HSMFileSigning;
