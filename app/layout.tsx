import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import 'react-json-view-lite/dist/index.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "Sandlot",
  description: "Event extraction and management tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
