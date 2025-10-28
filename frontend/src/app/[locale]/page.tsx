"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DocumentTable from "@/components/DocumentTable";
import Activities from "@/components/Activities";
import Overview from "@/components/Overview";
import { MoreVertical } from "lucide-react";
import { filesAPI, logsAPI, usersAPI, authAPI } from "@/lib/api";
import { useTranslations } from "next-intl";

interface Stats {
  drafts: number;
  actionNeeded: number;
  pending: number;
  completed: number;
  totalDocumentsPercent: number;
  userGrowth: number;
  totalDocumentsThisWeek: number;
  totalDocumentsLastWeek: number;
  weeklyChange: number;
  newUsersThisPeriod: number;
  newUsersLastPeriod: number;
  userGrowthChange: number;
  draftsThisPeriod: number;
  draftsLastPeriod: number;
  draftsChange: number;
  actionNeededThisPeriod: number;
  actionNeededLastPeriod: number;
  actionNeededChange: number;
  pendingThisPeriod: number;
  pendingLastPeriod: number;
  pendingChange: number;
  completedThisPeriod: number;
  completedLastPeriod: number;
  completedChange: number;
}

interface Document {
  originalName: string;
  id: string;
  serialNo: string;
  dueDate: string;
  assignee: string;
  email: string;
  status: string;
}

interface Activity {
  user: string;
  action: string;
  doc: string;
  time: string;
}

interface FileItem {
  id: string;
  status: string;
  created_at: string;
  uploader_name?: string;
  original_name?: string;
  filename?: string;
}

interface LogItem {
  id: string;
  user_id: string;
  user_name?: string;
  username?: string;
  full_name?: string;
  email?: string;
  action: string;
  details: string;
  created_at: string;
}

interface UserItem {
  id: string;
  username: string;
  email: string;
  created_at: string;
  full_name?: string;
  role?: string;
}

export default function Home() {
  const searchParams = useSearchParams();
  const t = useTranslations("dashboard");
  const periodParam = (searchParams.get("period") || "").toLowerCase();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"Weekly" | "Monthly" | "Yearly">(
    "Weekly"
  );

  // Sync time filter from URL (?period=weekly|monthly|yearly) with stable deps
  useEffect(() => {
    const mapped =
      periodParam === "monthly"
        ? "Monthly"
        : periodParam === "yearly"
        ? "Yearly"
        : periodParam === "weekly"
        ? "Weekly"
        : "Weekly"; // default
    setTimeFilter(mapped);
  }, [periodParam]);

  useEffect(() => {
    async function fetchData() {
      try {
        // periodParam is derived from the UI selection (Weekly/Monthly/Yearly)
        // and is sent to backend for aggregated stats only.
        // Note: filesAPI.getAll / usersAPI.getAll currently do NOT accept a
        // `period` param; they fetch pages (page, limit) and the client filters
        // results by created_at to compute period-specific metrics.
        // For large datasets, consider adding `period` to these helpers and
        // implementing server-side filtering to use WHERE created_at >= ...
        const periodParam = timeFilter.toLowerCase();

        // Fetch pages from backend (page=1, limit=100) and request action
        // aggregates for the selected period. Backend endpoints:
        // - GET /api/files?page=1&limit=100
        // - GET /api/logs?page=1&limit=100
        // - GET /api/users?page=1&limit=100
        // - GET /api/logs/stats/actions?period=weekly
        // Determine current user's role and only include usersAPI when
        // the acting user has permission (admin or manager). Regular
        // 'user' role accounts don't have users:read and will receive
        // Forbidden from the backend.
        const currentUser = authAPI.getCurrentUser();
        const role = currentUser?.role?.toLowerCase() || null;
        // Allow admin, manager and regular user roles to fetch users. The
        // backend PermissionsGuard was updated to include users:read for
        // the 'user' role, so we can safely request the list for basic
        // accounts like 'mười'.
        const includeUsers = ["admin", "manager", "user"].includes(role);

        const parallelRequests = [
          filesAPI.getAll(1, 1000),
          logsAPI.getAll(1, 1000),
          logsAPI.getActionStats(periodParam),
        ];

        if (includeUsers) {
          // Insert users fetch before action stats so indexing below stays stable
          parallelRequests.splice(2, 0, usersAPI.getAll(1, 1000));
        }

        const results = await Promise.all(parallelRequests);

        const filesData = results[0];
        const logsData = results[1];
        let usersData: { users?: UserItem[] } = { users: [] };
        const actionStatsData = includeUsers ? results[3] : results[2];

        if (includeUsers) {
          usersData = results[2];
        }

        const files: FileItem[] = filesData.files || [];
        const logs: LogItem[] = logsData.logs || [];
        const users: UserItem[] = usersData.users || [];
        const actionStats = actionStatsData || {
          currentPeriod: 0,
          previousPeriod: 0,
          change: 0,
        };

        console.log("📊 Fetched files:", files.length);
        console.log(
          "📅 Files data:",
          files.map((f) => ({
            id: f.id.substring(0, 8),
            created: f.created_at,
            status: f.status,
          }))
        );

        // Fetch delegations to get signed documents count
        let delegations: { status: string; created_at: string }[] = [];
        try {
          const delegationsResponse = await fetch(
            "http://localhost:5000/api/document-signatures?limit=1000",
            {
              headers: {
                Authorization: `Bearer ${
                  localStorage.getItem("access_token") ||
                  localStorage.getItem("token")
                }`,
              },
            }
          );
          if (delegationsResponse.ok) {
            const delegationsData = await delegationsResponse.json();
            // API returns { signatures: [...], pagination: {...} }
            delegations =
              delegationsData.signatures ||
              delegationsData.delegations ||
              delegationsData.data ||
              [];
            console.log("📊 Fetched delegations:", delegations.length);
            console.log(
              "📋 Delegations data:",
              delegations.map((d) => ({
                status: d.status,
                created: d.created_at,
              }))
            );
          } else {
            console.error(
              "❌ Failed to fetch delegations:",
              delegationsResponse.status,
              delegationsResponse.statusText
            );
          }
        } catch (err) {
          console.warn("⚠️ Could not fetch delegations:", err);
        }

        // Count from files table
        const drafts = files.filter((f) => f.status === "draft").length;
        const filesActionNeeded = files.filter(
          (f) =>
            f.status === "pending" ||
            f.status === "waiting" ||
            f.status === "active"
        ).length;
        const filesPending = files.filter((f) => f.status === "pending").length;

        // Count from delegations table (signed documents)
        const delegationsSigned = delegations.filter(
          (d) => d.status === "signed"
        ).length;
        const delegationsPendingApproval = delegations.filter(
          (d) => d.status === "pending_approval"
        ).length;
        const delegationsApproved = delegations.filter(
          (d) => d.status === "approved"
        ).length;

        // Combine counts
        const actionNeeded =
          filesActionNeeded + delegationsPendingApproval + delegationsApproved;
        const pending = filesPending + delegationsPendingApproval;
        const completed = delegationsSigned;

        console.log("📊 Overview Stats:");
        console.log("  Drafts:", drafts);
        console.log(
          "  Action Needed:",
          actionNeeded,
          "(files:",
          filesActionNeeded,
          "+ delegations pending:",
          delegationsPendingApproval,
          "+ approved:",
          delegationsApproved,
          ")"
        );
        console.log("  Pending:", pending);
        console.log("  Completed (Signed):", completed);

        // Calculate documents based on time filter
        const now = new Date();
        let currentPeriodStart: Date;
        let previousPeriodStart: Date;
        let previousPeriodEnd: Date;

        if (timeFilter === "Weekly") {
          // This week
          currentPeriodStart = new Date(now);
          currentPeriodStart.setDate(now.getDate() - now.getDay());
          currentPeriodStart.setHours(0, 0, 0, 0);

          // Last week
          previousPeriodStart = new Date(currentPeriodStart);
          previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
          previousPeriodEnd = new Date(currentPeriodStart);
        } else if (timeFilter === "Monthly") {
          // This month
          currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);

          // Last month
          previousPeriodStart = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
          );
          previousPeriodEnd = new Date(currentPeriodStart);
        } else {
          // This year
          currentPeriodStart = new Date(now.getFullYear(), 0, 1);

          // Last year
          previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
          previousPeriodEnd = new Date(currentPeriodStart);
        }

        console.log("📅 Period calculation:");
        console.log("  Current period start:", currentPeriodStart);
        console.log("  Previous period start:", previousPeriodStart);
        console.log("  Previous period end:", previousPeriodEnd);

        const currentPeriodDocs = files.filter((f) => {
          const createdDate = new Date(f.created_at);
          const isInPeriod = createdDate >= currentPeriodStart;
          if (isInPeriod) {
            console.log(
              "  ✅ In current period:",
              f.id.substring(0, 8),
              createdDate
            );
          }
          return isInPeriod;
        }).length;

        const previousPeriodDocs = files.filter((f) => {
          const createdDate = new Date(f.created_at);
          return (
            createdDate >= previousPeriodStart &&
            createdDate < previousPeriodEnd
          );
        }).length;

        console.log("📊 Results:");
        console.log("  Current period docs:", currentPeriodDocs);
        console.log("  Previous period docs:", previousPeriodDocs);

        // Calculate percentage change
        const periodChange =
          previousPeriodDocs > 0
            ? ((currentPeriodDocs - previousPeriodDocs) / previousPeriodDocs) *
              100
            : currentPeriodDocs > 0
            ? 100
            : 0;

        const totalFiles = files.length;
        const totalDocumentsPercent =
          totalFiles > 0 ? (completed / totalFiles) * 100 : 0;

        // Calculate new users in current period
        const currentPeriodUsers = users.filter((u) => {
          const createdDate = new Date(u.created_at);
          return createdDate >= currentPeriodStart;
        }).length;

        const previousPeriodUsers = users.filter((u) => {
          const createdDate = new Date(u.created_at);
          return (
            createdDate >= previousPeriodStart &&
            createdDate < previousPeriodEnd
          );
        }).length;

        const userGrowthChange =
          previousPeriodUsers > 0
            ? ((currentPeriodUsers - previousPeriodUsers) /
                previousPeriodUsers) *
              100
            : currentPeriodUsers > 0
            ? 100
            : 0;

        // Calculate drafts and action needed by period
        const currentPeriodDrafts = files.filter((f) => {
          const createdDate = new Date(f.created_at);
          return createdDate >= currentPeriodStart && f.status === "draft";
        }).length;

        const previousPeriodDrafts = files.filter((f) => {
          const createdDate = new Date(f.created_at);
          return (
            createdDate >= previousPeriodStart &&
            createdDate < previousPeriodEnd &&
            f.status === "draft"
          );
        }).length;

        const draftsChange =
          previousPeriodDrafts > 0
            ? ((currentPeriodDrafts - previousPeriodDrafts) /
                previousPeriodDrafts) *
              100
            : currentPeriodDrafts > 0
            ? 100
            : 0;

        const currentPeriodActionNeeded = actionStats.currentPeriod;
        const previousPeriodActionNeeded = actionStats.previousPeriod;
        const actionNeededChange = actionStats.change;

        // Calculate pending by period (include delegations)
        const currentPeriodPending =
          files.filter((f) => {
            const createdDate = new Date(f.created_at);
            return createdDate >= currentPeriodStart && f.status === "pending";
          }).length +
          delegations.filter((d) => {
            const createdDate = new Date(d.created_at);
            return (
              createdDate >= currentPeriodStart &&
              d.status === "pending_approval"
            );
          }).length;

        const previousPeriodPending =
          files.filter((f) => {
            const createdDate = new Date(f.created_at);
            return (
              createdDate >= previousPeriodStart &&
              createdDate < previousPeriodEnd &&
              f.status === "pending"
            );
          }).length +
          delegations.filter((d) => {
            const createdDate = new Date(d.created_at);
            return (
              createdDate >= previousPeriodStart &&
              createdDate < previousPeriodEnd &&
              d.status === "pending_approval"
            );
          }).length;

        const pendingChange =
          previousPeriodPending > 0
            ? ((currentPeriodPending - previousPeriodPending) /
                previousPeriodPending) *
              100
            : currentPeriodPending > 0
            ? 100
            : 0;

        // Calculate completed by period (FROM DELEGATIONS TABLE)
        const currentPeriodCompleted = delegations.filter((d) => {
          const createdDate = new Date(d.created_at);
          return createdDate >= currentPeriodStart && d.status === "signed";
        }).length;

        const previousPeriodCompleted = delegations.filter((d) => {
          const createdDate = new Date(d.created_at);
          return (
            createdDate >= previousPeriodStart &&
            createdDate < previousPeriodEnd &&
            d.status === "signed"
          );
        }).length;

        const completedChange =
          previousPeriodCompleted > 0
            ? ((currentPeriodCompleted - previousPeriodCompleted) /
                previousPeriodCompleted) *
              100
            : currentPeriodCompleted > 0
            ? 100
            : 0;

        const uniqueUsers = new Set(logs.map((log) => log.user_id)).size;

        console.log("📊 Final Stats:");
        console.log("  Total Documents This Week:", currentPeriodDocs);
        console.log("  Total Documents Last Week:", previousPeriodDocs);
        console.log("  Weekly Change:", periodChange.toFixed(2) + "%");
        console.log("  New Users This Period:", currentPeriodUsers);
        console.log("  New Users Last Period:", previousPeriodUsers);
        console.log("  User Growth Change:", userGrowthChange.toFixed(2) + "%");
        console.log("  ✅ Completed This Period:", currentPeriodCompleted);
        console.log("  ✅ Completed Last Period:", previousPeriodCompleted);
        console.log("  ✅ Completed Change:", completedChange.toFixed(2) + "%");

        setStats({
          drafts,
          actionNeeded,
          pending,
          completed,
          totalDocumentsPercent,
          userGrowth: uniqueUsers,
          totalDocumentsThisWeek: currentPeriodDocs,
          totalDocumentsLastWeek: previousPeriodDocs,
          weeklyChange: periodChange,
          newUsersThisPeriod: currentPeriodUsers,
          newUsersLastPeriod: previousPeriodUsers,
          userGrowthChange,
          draftsThisPeriod: currentPeriodDrafts,
          draftsLastPeriod: previousPeriodDrafts,
          draftsChange,
          actionNeededThisPeriod: currentPeriodActionNeeded,
          actionNeededLastPeriod: previousPeriodActionNeeded,
          actionNeededChange,
          pendingThisPeriod: currentPeriodPending,
          pendingLastPeriod: previousPeriodPending,
          pendingChange,
          completedThisPeriod: currentPeriodCompleted,
          completedLastPeriod: previousPeriodCompleted,
          completedChange,
        });

        // Filter recent files by current period selection (client-side).
        // This filtering compares each file.created_at against the
        // `currentPeriodStart` computed above. Because we only fetched the
        // first page (limit=100), this list may not include older files in the
        // current period beyond that page. Use server-side filtering for
        // accurate results across large datasets.
        const filesInCurrentPeriod = files.filter((f) => {
          const createdDate = new Date(f.created_at);
          return createdDate >= currentPeriodStart;
        });

        const recentFiles = filesInCurrentPeriod
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 5)
          .map(
            (file): Document => ({
              originalName: file.original_name || file.filename || "Unknown",
              id: file.id,
              serialNo: file.id?.substring(0, 8) || "N/A",
              dueDate: file.created_at
                ? new Date(file.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  })
                : "N/A",
              assignee: file.uploader_name || "Unknown",
              email: "johndoe@gmail.com",
              status: file.status || "draft",
            })
          );

        setRecentDocuments(recentFiles);

        // Filter activities by current period selection
        const logsInCurrentPeriod = logs.filter((l) => {
          const createdDate = new Date(l.created_at);
          return createdDate >= currentPeriodStart;
        });

        const recentLogs = logsInCurrentPeriod
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 10)
          .map((log): Activity => {
            const details = log.details || "";
            const documentName = details.includes(":")
              ? details.split(":").slice(1).join(":").trim()
              : details;

            const logTime = new Date(log.created_at);
            const now = new Date();
            const diffMs = now.getTime() - logTime.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            let timeAgo = "Just Now";
            if (diffDays > 0) {
              timeAgo = `${diffDays} week${diffDays > 7 ? "s" : ""} ago`;
            } else if (diffHours > 0) {
              timeAgo = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
            } else if (diffMins > 0) {
              timeAgo = `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
            }

            return {
              user: log.full_name || log.username || log.email || "Unknown",
              action: log.action || "performed action",
              doc: documentName || "N/A",
              time: timeAgo,
            };
          });

        setActivities(recentLogs);
      } catch (error) {
        console.error("Error fetching data:", error);
        setStats({
          drafts: 0,
          actionNeeded: 0,
          pending: 0,
          completed: 0,
          totalDocumentsPercent: 0,
          userGrowth: 0,
          totalDocumentsThisWeek: 0,
          totalDocumentsLastWeek: 0,
          weeklyChange: 0,
          newUsersThisPeriod: 0,
          newUsersLastPeriod: 0,
          userGrowthChange: 0,
          draftsThisPeriod: 0,
          draftsLastPeriod: 0,
          draftsChange: 0,
          actionNeededThisPeriod: 0,
          actionNeededLastPeriod: 0,
          actionNeededChange: 0,
          pendingThisPeriod: 0,
          pendingLastPeriod: 0,
          pendingChange: 0,
          completedThisPeriod: 0,
          completedLastPeriod: 0,
          completedChange: 0,
        });
        setRecentDocuments([]);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [timeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Overview Component */}
      <div className="mb-6">
        <Overview
          stats={
            stats
              ? {
                  drafts: stats.draftsThisPeriod,
                  actionNeeded: stats.actionNeededThisPeriod,
                  pending: stats.pendingThisPeriod,
                  completed: stats.completedThisPeriod,
                  draftsChange: stats.draftsChange,
                  actionNeededChange: stats.actionNeededChange,
                  pendingChange: stats.pendingChange,
                  completedChange: stats.completedChange,
                }
              : null
          }
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Total Documents */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Total Documents
                  </h3>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical size={16} />
                </button>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats?.totalDocumentsThisWeek || 0}
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      (stats?.weeklyChange || 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {(stats?.weeklyChange || 0) >= 0 ? "+" : ""}
                    {stats?.weeklyChange?.toFixed(2) || "0.00"}% than last{" "}
                    {timeFilter === "Weekly"
                      ? "Week"
                      : timeFilter === "Monthly"
                      ? "Month"
                      : "Year"}
                  </div>
                </div>
                <div className="w-32 h-16">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 200 60"
                    preserveAspectRatio="none"
                  >
                    {(() => {
                      const lastWeek = stats?.totalDocumentsLastWeek || 0;
                      const thisWeek = stats?.totalDocumentsThisWeek || 0;
                      const maxValue = Math.max(lastWeek, thisWeek, 1);

                      // Create curved line with multiple points for smooth curve
                      const lastY = 60 - (lastWeek / maxValue) * 40;
                      const thisY = 60 - (thisWeek / maxValue) * 40;

                      // Create curved path with control points
                      const pathData = `M 0,${lastY} Q 50,${lastY - 5} 100,${
                        (lastY + thisY) / 2
                      } Q 150,${thisY + 5} 200,${thisY}`;
                      const fillPathData = `M 0,${lastY} Q 50,${
                        lastY - 5
                      } 100,${(lastY + thisY) / 2} Q 150,${
                        thisY + 5
                      } 200,${thisY} L 200,60 L 0,60 Z`;

                      return (
                        <>
                          <path
                            d={pathData}
                            fill="none"
                            stroke="#EF4444"
                            strokeWidth="2"
                          />
                          <path
                            d={fillPathData}
                            fill="url(#docRedGradient)"
                            opacity="0.3"
                          />
                        </>
                      );
                    })()}
                    <defs>
                      <linearGradient
                        id="docRedGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="#EF4444"
                          stopOpacity="0.2"
                        />
                        <stop
                          offset="100%"
                          stopColor="#EF4444"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>
            {/* User Growth */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    User Growth
                  </h3>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical size={16} />
                </button>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="flex-1">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats?.newUsersThisPeriod || 0}
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      (stats?.userGrowthChange || 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {(stats?.userGrowthChange || 0) >= 0 ? "+" : ""}
                    {stats?.userGrowthChange?.toFixed(2) || "0.00"}% than last{" "}
                    {timeFilter === "Weekly"
                      ? "Week"
                      : timeFilter === "Monthly"
                      ? "Month"
                      : "Year"}
                  </div>
                </div>
                <div className="w-32 h-16">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 200 60"
                    preserveAspectRatio="none"
                  >
                    {(() => {
                      const lastPeriod = stats?.newUsersLastPeriod || 0;
                      const thisPeriod = stats?.newUsersThisPeriod || 0;
                      const maxValue = Math.max(lastPeriod, thisPeriod, 1);

                      // Create curved line with multiple points for smooth curve
                      const lastY = 60 - (lastPeriod / maxValue) * 40;
                      const thisY = 60 - (thisPeriod / maxValue) * 40;

                      // Create curved path with control points
                      const pathData = `M 0,${lastY} Q 50,${lastY - 5} 100,${
                        (lastY + thisY) / 2
                      } Q 150,${thisY + 5} 200,${thisY}`;
                      const fillPathData = `M 0,${lastY} Q 50,${
                        lastY - 5
                      } 100,${(lastY + thisY) / 2} Q 150,${
                        thisY + 5
                      } 200,${thisY} L 200,60 L 0,60 Z`;

                      return (
                        <>
                          <path
                            d={pathData}
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2"
                          />
                          <path
                            d={fillPathData}
                            fill="url(#userGreenGradient)"
                            opacity="0.3"
                          />
                        </>
                      );
                    })()}
                    <defs>
                      <linearGradient
                        id="userGreenGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          stopColor="#10B981"
                          stopOpacity="0.2"
                        />
                        <stop
                          offset="100%"
                          stopColor="#10B981"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          {/* Recent Documents */}
          <DocumentTable documents={recentDocuments} />
        </div>
        {/* Right Column */}
        <div className="col-span-12 xl:col-span-4">
          <Activities activities={activities} />
        </div>
      </div>
    </div>
  );
}
