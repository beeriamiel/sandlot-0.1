'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";
import { SignOutButton } from './SignOutButton';
import { Box } from "lucide-react"; // Import the Box icon as a placeholder logo

const navItems = [
  { name: 'Event Spreadsheet', href: '/' },
  { name: 'URL Extractor', href: '/url-extractor' },
  { name: 'Data Formatter', href: '/data-formatter' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r">
        <div className="p-6 flex items-center">
          <Box className="h-6 w-6 mr-2" /> {/* Placeholder logo */}
          <h1 className="text-2xl font-semibold text-foreground">Sandlot</h1>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-4 py-2 text-sm font-medium transition-colors hover:bg-muted",
                pathname === item.href 
                  ? "bg-muted text-foreground" 
                  : "text-muted-foreground"
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto py-6 px-4">
          {children}
        </div>
      </main>
    </div>
  );
}
