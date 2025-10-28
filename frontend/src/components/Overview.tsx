"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, TrendingUp, TrendingDown } from "lucide-react";
import { useTranslations } from 'next-intl';

interface OverviewProps {
  stats: {
    drafts: number;
    actionNeeded: number;
    pending: number;
    completed: number;
    draftsChange: number;
    actionNeededChange: number;
    pendingChange: number;
    completedChange: number;
  } | null;
  timeFilter: "Weekly" | "Monthly" | "Yearly";
  onTimeFilterChange: (filter: "Weekly" | "Monthly" | "Yearly") => void;
}

export default function Overview({ stats, timeFilter, onTimeFilterChange }: OverviewProps) {
  const router = useRouter();
  const t = useTranslations();

  const handleTimeFilterChange = (filter: "Weekly" | "Monthly" | "Yearly") => {
    onTimeFilterChange(filter);
    const lower = filter.toLowerCase();
    router.replace(`/?period=${lower}`);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toLocaleString();
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? "text-green-600" : "text-red-600";
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? (
      <TrendingUp className="w-3 h-3" />
    ) : (
      <TrendingDown className="w-3 h-3" />
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{t('navigation.overview')}</h1>
        
        {/* Filter Buttons Group */}
        <div className="flex items-center gap-3">
          {/* Time Filter Buttons */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            {(["Weekly", "Monthly", "Yearly"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => handleTimeFilterChange(filter)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  timeFilter === filter
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
          
          {/* Filter Button */}
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
            <Filter className="w-4 h-4" />
            {t('common.filter')}
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-4">
        {/* Drafts Card */}
        <div className="bg-white border border-gray-200 border-r border-gray-200 rounded-l-xl p-6">
          <div className="text-sm text-gray-500 mb-2">{t('dashboard.drafts')}</div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(stats?.drafts || 0)}
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${getChangeColor(stats?.draftsChange || 0)}`}>
              {getChangeIcon(stats?.draftsChange || 0)}
              {formatChange(stats?.draftsChange || 0)}
            </div>
          </div>
        </div>

        {/* Action Needed Card */}
        <div className="bg-white border border-gray-200 border-r border-gray-200 border-l-0 p-6">
          <div className="text-sm text-gray-500 mb-2">{t('dashboard.actionNeeded')}</div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(stats?.actionNeeded || 0)}
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${getChangeColor(stats?.actionNeededChange || 0)}`}>
              {getChangeIcon(stats?.actionNeededChange || 0)}
              {formatChange(stats?.actionNeededChange || 0)}
            </div>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-white border border-gray-200 border-r border-gray-200 border-l-0 p-6">
          <div className="text-sm text-gray-500 mb-2">{t('dashboard.pending')}</div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(stats?.pending || 0)}
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${getChangeColor(stats?.pendingChange || 0)}`}>
              {getChangeIcon(stats?.pendingChange || 0)}
              {formatChange(stats?.pendingChange || 0)}
            </div>
          </div>
        </div>

        {/* Completed Card */}
        <div className="bg-white border border-gray-200 border-l-0 rounded-r-xl p-6">
          <div className="text-sm text-gray-500 mb-2">{t('dashboard.completed')}</div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(stats?.completed || 0)}
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${getChangeColor(stats?.completedChange || 0)}`}>
              {getChangeIcon(stats?.completedChange || 0)}
              {formatChange(stats?.completedChange || 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
