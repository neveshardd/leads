import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Leads",
  description: "Gerenciamento de Leads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-br"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh min-h-0 overflow-hidden bg-background dark" cz-shortcut-listen="true">
        <Sidebar />
        <QueryProvider>
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-8">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
