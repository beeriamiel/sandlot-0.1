'use client';

import { signOut } from '../lib/database';
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return <Button onClick={handleSignOut}>Sign Out</Button>;
}