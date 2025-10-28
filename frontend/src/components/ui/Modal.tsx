"use client";

import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  showCloseButton?: boolean;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  className = "",
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "modal-content-sm",
    md: "modal-content-md", 
    lg: "modal-content-lg",
    xl: "modal-content-xl",
  };

  return (
    <div className="modal-backdrop">
      <div className={`modal-content ${sizeClasses[size]} ${className}`}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {showCloseButton && (
            <button onClick={onClose} className="modal-close-button">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
