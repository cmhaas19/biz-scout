"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (step === "email") {
      if (!email.trim()) {
        setError("Please enter your email address");
        return;
      }
      setStep("password");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
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
          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <form onSubmit={handleContinue} className="space-y-5">
            {step === "email" ? (
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
                  autoFocus
                  required
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="text-sm text-primary hover:underline"
                  >
                    ← Back
                  </button>
                  <span className="text-sm text-gray-500">{email}</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-900">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-gray-300 bg-white text-base placeholder:text-gray-400"
                    autoFocus
                    required
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
              {loading ? "Signing in..." : "Continue"}
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
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
