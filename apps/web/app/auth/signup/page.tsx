"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const PW_REQS = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a letter", test: (p: string) => /[a-zA-Z]/.test(p) },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
];

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, displayName);
      router.push("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 shadow-glow-brand mb-4">
            <BookOpen size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black">Create your account</h1>
          <p className="text-white/50 mt-1">Start discovering great books</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" id="signup-form">
            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-white/70 mb-1.5">
                Display name
              </label>
              <input
                id="signup-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
                minLength={2}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-white/70 mb-1.5">
                Email
              </label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className="block text-sm font-medium text-white/70 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="input pr-12"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password strength */}
              {password && (
                <div className="mt-3 space-y-1.5">
                  {PW_REQS.map((req) => (
                    <div key={req.label} className="flex items-center gap-2 text-xs">
                      <CheckCircle
                        size={13}
                        className={req.test(password) ? "text-emerald-400" : "text-white/20"}
                      />
                      <span className={req.test(password) ? "text-emerald-300" : "text-white/30"}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-white/40 text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-brand-300 hover:text-brand-200 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
