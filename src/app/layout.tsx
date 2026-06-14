import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CFO Agent",
  description: "AI-powered financial intelligence for your company",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
