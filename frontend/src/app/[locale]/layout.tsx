import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/ToastProvider";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Digital Signature Dashboard",
  description: "Digital signature management system",
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  // Await params before using (Next.js 15 requirement)
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            <PermissionsProvider>
              <AppShell>{children}</AppShell>
            </PermissionsProvider>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
