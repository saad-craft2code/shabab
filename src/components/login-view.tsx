"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Lock, User, Loader2 } from "lucide-react";

export default function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      onSuccess();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-neutral-50 to-white">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-neutral-900 flex items-center justify-center mb-4">
              <Truck className="h-7 w-7 text-amber-400" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              SHABAB EXPRESS
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Owner Operator Settlement Portal · Greensboro, NC
            </p>
          </div>

          {/* Card */}
          <form
            onSubmit={submit}
            className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    id="username"
                    autoCapitalize="none"
                    autoComplete="username"
                    className="pl-9"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="pl-9"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-neutral-400">
            Authorized access only. Contact Shabab Express for credentials.
          </p>
        </div>
      </div>
      <footer className="py-5 text-center text-xs text-neutral-400">
        Shabab Express LLC · Motor Carrier · Greensboro, North Carolina
      </footer>
    </div>
  );
}
