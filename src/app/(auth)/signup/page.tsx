"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"info" | "password">("info");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (step === "info") {
      if (!firstName.trim() || !email.trim()) {
        setError("First name and email are required");
        return;
      }
      setStep("password");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName} ${lastName}`.trim(),
        },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });
    if (error) {
      setError(error.message);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-4">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center space-y-4">
            <p className="text-gray-600">
              We&apos;ve sent a confirmation link to{" "}
              <span className="font-semibold text-gray-900">{email}</span>.
              Click the link to activate your account.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full h-12 rounded-xl text-base font-medium border-gray-300">
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-[400px] space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M18 14l3 3-3 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign up</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <form onSubmit={handleContinue} className="space-y-5">
            {step === "info" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-semibold text-gray-900">
                      First name
                    </Label>
                    <Input
                      id="firstName"
                      placeholder="Your first name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-12 rounded-xl border-gray-300 bg-white text-base placeholder:text-gray-400"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-semibold text-gray-900">
                      Last name
                    </Label>
                    <Input
                      id="lastName"
                      placeholder="Your last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-12 rounded-xl border-gray-300 bg-white text-base placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-900">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-gray-300 bg-white text-base placeholder:text-gray-400"
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("info")}
                    className="text-sm text-primary hover:underline"
                  >
                    ← Back
                  </button>
                  <span className="text-sm text-gray-500">
                    {firstName} ({email})
                  </span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-900">
                    Create a password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-gray-300 bg-white text-base placeholder:text-gray-400"
                    autoFocus
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold bg-gray-900 hover:bg-gray-800 text-white"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Continue"}
            </Button>
          </form>

          <div className="relative my-6">
            <Separator className="bg-gray-200" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              or
            </span>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 rounded-xl text-base font-medium border-gray-300 hover:bg-gray-50"
            onClick={handleGoogleLogin}
          >
            <svg className="w-5 h-5 mr-2.5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>
        </div>

        {/* Footer */}
        <p className="text-sm text-center text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
