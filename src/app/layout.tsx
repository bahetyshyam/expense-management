import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expense Portal",
  description: "Holistic personal finance dashboard",
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className="min-h-screen text-neutral-950 antialiased"
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
