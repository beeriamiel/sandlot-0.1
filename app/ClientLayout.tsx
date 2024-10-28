'use client';

import React, { useEffect, useState } from 'react';
import { getCurrentUser, signOut } from './lib/database';
import { SignInButton } from './components/SignInButton';
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    };
    checkUser();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <SignInButton onSignIn={(newUser) => setUser(newUser)} />;
  }

  const menuItems = [
    { name: 'Event Spreadsheet', path: '/' },
    { name: 'Data Formatter', path: '/data-formatter' },
    { name: 'URL Extractor', path: '/url-extractor' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-gray-100 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Event Spreadsheet</h1>
        <div className="flex items-center gap-4">
          <span>{user.email}</span>
          <Button onClick={handleSignOut}>Sign Out</Button>
        </div>
      </header>
      <div className="flex flex-grow">
        <nav className="w-64 bg-gray-200 p-4">
          <ul>
            {menuItems.map((item) => (
              <li key={item.path} className="mb-2">
                <Link 
                  href={item.path}
                  className={`block p-2 rounded ${pathname === item.path ? 'bg-blue-500 text-white' : 'hover:bg-gray-300'}`}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-grow p-4">
          {children}
        </main>
      </div>
    </div>
  );
}