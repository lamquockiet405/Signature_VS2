"use client";

import React, { useState } from "react";

export interface SplitButtonOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface SplitButtonProps {
  options: SplitButtonOption[];
  defaultOption?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function SplitButton({
  options,
  defaultOption,
  variant = "primary",
  size = "md",
  className = "",
}: SplitButtonProps) {
  const [selectedOption, setSelectedOption] = useState<SplitButtonOption>(
    options.find((opt) => opt.id === defaultOption) || options[0]
  );


  // Size styles
  const sizeStyles = {
    sm: "text-sm px-3 py-1.5",
    md: "text-base px-4 py-2",
    lg: "text-lg px-5 py-3",
  };

  const buttonSize = sizeStyles[size];

  return (
    <div className={`inline-flex ${className}`}>
      {/* Toggle Button with Segments */}
      <div className="flex border border-gray-300 rounded-lg overflow-hidden">
        {options.map((option, index) => (
          <button
            key={option.id}
            onClick={() => {
              setSelectedOption(option);
              option.onClick();
            }}
            className={`
              ${buttonSize}
              flex items-center gap-2
              font-medium
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${
                selectedOption.id === option.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }
              ${index === 0 ? "rounded-l-lg" : ""}
              ${index === options.length - 1 ? "rounded-r-lg" : ""}
              ${index > 0 ? "border-l border-gray-300" : ""}
            `}
          >
            {option.icon && <span>{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

