import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/AppLayout";

export const metadata: Metadata = {
  title: "IELTS Writing Scorer",
  description: "AI-powered IELTS writing evaluation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 min-h-screen font-sans text-slate-900">
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
