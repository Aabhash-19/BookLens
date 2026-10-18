"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);

  const [error, setError] = useState("");
  let slowTimer: ReturnType<typeof setTimeout> | null = null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowSlowHint(false);
    setLoading(true);
    slowTimer = setTimeout(() => setShowSlowHint(true), 5000);
    try {
      await login(email, password);
      router.push("/scan");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg && msg.trim() !== "" ? msg : "Invalid credentials.");
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
      setLoading(false);
      setShowSlowHint(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 shadow-glow-brand mb-4">
            <BookOpen size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black">Welcome back</h1>
          <p className="text-white/50 mt-1">Sign in to your BookLens account</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-white/70 mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-white/70 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Sign in"}
            </button>
            {showSlowHint && (
              <p className="text-center text-xs text-white/40 animate-fade-in">
                ⏳ Server is waking up — this can take up to 30s on first load…
              </p>
            )}
          </form>
        </div>

        <p className="text-center mt-6 text-white/40 text-sm">
          Don't have an account?{" "}
          <Link href="/auth/signup" className="text-brand-300 hover:text-brand-200 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
