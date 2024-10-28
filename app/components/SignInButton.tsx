'use client';

import { useState, useEffect } from 'react';
import { signIn } from '../lib/database';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SignInButtonProps {
  onSignIn: (user: any) => void;
}

export function SignInButton({ onSignIn }: SignInButtonProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSignIn = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    setMessage('');
    try {
      await signIn(email);
      setMessage('Check your email for the login link!');
    } catch (error) {
      console.error('Error signing in:', error);
      if (error instanceof Error && error.message === 'RATE_LIMIT_ERROR') {
        setMessage('Too many sign-in attempts. Please try again in 60 seconds.');
        setCountdown(60);
      } else {
        setMessage('Error signing in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle className="text-center">
            <div className="flex items-center justify-center mb-2">
              {/* Replace with your actual logo */}
              <div className="w-8 h-8 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-2xl font-bold">SAND</span>
            </div>
            Sign In
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || countdown > 0}
            />
            <Button 
              onClick={handleSignIn} 
              disabled={isLoading || countdown > 0} 
              className="w-full"
            >
              {countdown > 0 ? `Try again in ${countdown}s` : (isLoading ? 'Sending...' : 'Sign In with Email')}
            </Button>
            {message && (
              <p className={`text-sm text-center ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                {message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}