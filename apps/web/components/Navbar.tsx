"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Camera, Library, Sparkles, User, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/scan", label: "Scan", icon: Camera },
  { href: "/library", label: "Library", icon: Library },
  { href: "/recommendations", label: "Discover", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <>
      {/* Desktop nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/8 h-16">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Logo */}
          <Link href={user ? "/scan" : "/"} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center shadow-glow-sm group-hover:shadow-glow-brand transition-shadow">
              <BookOpen size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-gradient-brand">BookLens</span>
          </Link>

          {/* Desktop links */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "btn-ghost text-sm",
                    pathname.startsWith(href) && "text-white bg-white/10"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </div>
          )}

          {/* Auth actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden md:block text-sm text-white/50 truncate max-w-[140px]">
                  {user.display_name}
                </span>
                <button onClick={handleLogout} className="btn-icon" title="Log out">
                  <LogOut size={18} />
                </button>
                {/* Mobile menu toggle */}
                <button
                  className="md:hidden btn-icon"
                  onClick={() => setMobileOpen(!mobileOpen)}
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login" className="btn-ghost text-sm">Log in</Link>
                <Link href="/auth/signup" className="btn-primary text-sm py-2 px-4">
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && user && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute top-16 inset-x-0 glass border-b border-white/8 p-4 animate-fade-in">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    pathname.startsWith(href)
                      ? "bg-brand-500/15 text-brand-300"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile bottom bar */}
      {user && (
        <div className="fixed bottom-0 inset-x-0 z-50 md:hidden glass border-t border-white/8 safe-bottom">
          <div className="flex items-center justify-around py-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all",
                  pathname.startsWith(href) ? "text-brand-400" : "text-white/40 hover:text-white/70"
                )}
              >
                <Icon size={22} strokeWidth={pathname.startsWith(href) ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
