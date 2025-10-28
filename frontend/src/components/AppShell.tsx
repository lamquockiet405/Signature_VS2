"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide the shell on auth pages (signin/signup) regardless of locale prefix
  // e.g. /en/signin, /vi/signup
  const hideShell = Boolean(
    pathname && pathname.match(/(^|\/)\b(signin|signup)\b(\/|$)/)
  );

  if (hideShell) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Topbar />
        <main className="pt-16">{children}</main>
      </div>
    </div>
  );
}
