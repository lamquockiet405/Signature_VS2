"use client";

import { MoreVertical } from "lucide-react";

interface ChartsProps {
  totalDocumentsPercent: number;
  userGrowth: number;
}

export default function Charts({
  totalDocumentsPercent,
  userGrowth,
}: ChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Total Documents Chart */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Total Documents
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Document created and received
            </p>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <MoreVertical size={20} className="text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-4xl font-bold text-gray-900">
              {totalDocumentsPercent}%
            </h2>
            <span className="text-sm text-gray-500">0.31% than last Week</span>
          </div>
          <div className="h-32 flex items-end justify-between gap-1">
            {/* Simple line chart representation */}
            <div className="flex-1 h-full bg-gradient-to-t from-red-100 to-transparent rounded-t relative">
              <svg
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="none"
              >
                <path
                  d="M 0,80 Q 25,60 50,70 T 100,50 L 100,100 L 0,100 Z"
                  fill="url(#gradient1)"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M 0,80 Q 25,60 50,70 T 100,50"
                  stroke="#EF4444"
                  strokeWidth="2"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
                <defs>
                  <linearGradient
                    id="gradient1"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#FEE2E2" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FEE2E2" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* User Growth Chart */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">User Growth</h3>
            <p className="text-sm text-gray-500 mt-1">
              New signups website + mobile
            </p>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <MoreVertical size={20} className="text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-4xl font-bold text-gray-900">
              {userGrowth.toLocaleString()}
            </h2>
            <span className="text-sm text-green-600">
              +3.85% than last Week
            </span>
          </div>
          <div className="h-32 flex items-end justify-between gap-1">
            {/* Simple line chart representation */}
            <div className="flex-1 h-full bg-gradient-to-t from-green-100 to-transparent rounded-t relative">
              <svg
                className="absolute inset-0 w-full h-full"
                preserveAspectRatio="none"
              >
                <path
                  d="M 0,90 Q 25,80 50,60 T 100,30 L 100,100 L 0,100 Z"
                  fill="url(#gradient2)"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M 0,90 Q 25,80 50,60 T 100,30"
                  stroke="#10B981"
                  strokeWidth="2"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
                <defs>
                  <linearGradient
                    id="gradient2"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#D1FAE5" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#D1FAE5" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
