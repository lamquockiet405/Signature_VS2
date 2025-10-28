import { ToastProvider } from "@/components/ToastProvider";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ToastProvider>{children}</ToastProvider>;
}
