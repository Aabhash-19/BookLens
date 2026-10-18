"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  User, Settings, LogOut, Plus, X, Loader2,
  Camera, BookOpen, Globe, Pencil, CheckCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import clsx from "clsx";

const GENRES = [
  "Fiction", "Non-Fiction", "Mystery", "Thriller", "Science Fiction",
  "Fantasy", "Romance", "Historical Fiction", "Biography", "Self-Help",
  "Horror", "Literary Fiction", "Adventure", "Graphic Novel", "Poetry",
  "Psychology", "Philosophy", "Science", "History", "True Crime",
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
];

type Section = "preferences" | "account";

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, logout, updateUser } = useAuth();
  const [section, setSection] = useState<Section>("preferences");
  const [prefs, setPrefs] = useState<api.Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Derived selected state
  const selectedGenres = prefs.filter((p) => p.preference_type === "genre").map((p) => p.preference_value);
  const selectedLangs = prefs.filter((p) => p.preference_type === "language").map((p) => p.preference_value);
  const customAuthors = prefs.filter((p) => p.preference_type === "author").map((p) => p.preference_value);
  const [newAuthor, setNewAuthor] = useState("");
  const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [accountSaving, setAccountSaving] = useState(false);

  useEffect(() => {
    if (!user && !token) { router.push("/auth/login"); return; }
    setDisplayName(user?.display_name ?? "");
    if (!token) return;
    api.getPreferences(token)
      .then(setPrefs)
      .finally(() => setLoading(false));
  }, [user, token, router]);

  useEffect(() => {
    if (!token || !newAuthor || newAuthor.length < 1) {
      setAuthorSuggestions([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const res = await api.getFilterSuggestions(token, newAuthor, "author");
        setAuthorSuggestions(res);
      } catch {}
    }, 250);
    return () => clearTimeout(delay);
  }, [newAuthor, token]);

  const toggleGenre = (g: string) => {
    if (selectedGenres.includes(g)) {
      setPrefs((prev) => prev.filter((p) => !(p.preference_type === "genre" && p.preference_value === g)));
    } else {
      setPrefs((prev) => [...prev, {
        id: `tmp-${g}`, preference_type: "genre", preference_value: g,
        weight: 1.0, created_at: "", updated_at: "",
      }]);
    }
  };

  const toggleLang = (l: string) => {
    if (selectedLangs.includes(l)) {
      setPrefs((prev) => prev.filter((p) => !(p.preference_type === "language" && p.preference_value === l)));
    } else {
      setPrefs((prev) => [...prev, {
        id: `tmp-lang-${l}`, preference_type: "language", preference_value: l,
        weight: 1.0, created_at: "", updated_at: "",
      }]);
    }
  };

  const addAuthor = () => {
    const trimmed = newAuthor.trim();
    if (!trimmed || customAuthors.includes(trimmed)) { setNewAuthor(""); return; }
    setPrefs((prev) => [...prev, {
      id: `tmp-author-${trimmed}`, preference_type: "author", preference_value: trimmed,
      weight: 0.8, created_at: "", updated_at: "",
    }]);
    setNewAuthor("");
  };

  const removeAuthor = (a: string) => {
    setPrefs((prev) => prev.filter((p) => !(p.preference_type === "author" && p.preference_value === a)));
  };

  const handleSavePrefs = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const newPrefs = prefs.map((p) => ({
        preference_type: p.preference_type,
        preference_value: p.preference_value,
        weight: p.weight,
      }));
      const saved = await api.setPreferences(newPrefs, token);
      setPrefs(saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${api.getApiBase()}/api/v1/auth/users/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload");
      const updatedUser = await res.json();
      updateUser(updatedUser);
    } catch (err) {
      console.error(err);
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleSaveAccount = async () => {
    if (!token) return;
    setAccountSaving(true);
    try {
      // Simple PATCH to /users/me
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!res.ok) throw new Error();
      
      updateUser({ display_name: displayName });
    } finally {
      setAccountSaving(false);
    }
  };

  const handleLogout = () => { logout(); router.push("/"); };

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 relative">
        {/* User card */}
        <div className="card p-6 mb-6 flex items-center gap-4">
          <div 
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-2xl font-black shadow-glow-sm flex-shrink-0 cursor-pointer overflow-hidden group"
            onClick={(e) => {
              if (e.target !== fileInputRef.current) {
                fileInputRef.current?.click();
              }
            }}
          >
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url.startsWith("avatars/") 
                  ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/users/${user.id}/avatar_image?v=${user.avatar_url.split('/').pop()}` 
                  : user.avatar_url} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{user?.display_name?.[0]?.toUpperCase() ?? "U"}</span>
            )}
            
            {/* Hover overlay for upload */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-white" />
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-xl truncate">{user?.display_name}</h2>
            <p className="text-white/40 text-sm truncate">{user?.email}</p>
            {user?.created_at && (
              <p className="text-white/25 text-xs mt-0.5">
                Member since {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-2xl mb-6">
          {([["preferences", Settings, "Preferences"], ["account", User, "Account"]] as const).map(
            ([key, Icon, label]) => (
              <button
                key={key}
                id={`profile-tab-${key}`}
                onClick={() => setSection(key)}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                  section === key ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <Icon size={16} /> {label}
              </button>
            )
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="text-brand-400 animate-spin" />
          </div>
        )}

        {/* ── Preferences section ── */}
        {!loading && section === "preferences" && (
          <div className="space-y-6 animate-fade-in">
            {/* Genres */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={18} className="text-brand-300" />
                <h3 className="font-bold">Favourite Genres</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    id={`pref-genre-${g.toLowerCase().replace(/\s/g, "-")}`}
                    onClick={() => toggleGenre(g)}
                    className={clsx(
                      "px-3 py-1.5 rounded-full text-sm border transition-all duration-200",
                      selectedGenres.includes(g)
                        ? "bg-brand-500/25 border-brand-400/50 text-brand-200"
                        : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Favourite Authors */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Pencil size={18} className="text-purple-300" />
                <h3 className="font-bold">Favourite Authors</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {customAuthors.map((a) => (
                  <span key={a} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-sm">
                    {a}
                    <button onClick={() => removeAuthor(a)} className="hover:text-red-300 transition-colors">
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 relative">
                <div className="flex-1 relative">
                  <input
                    id="pref-author-input"
                    type="text"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAuthor()}
                    onFocus={() => setActiveInput("author")}
                    onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                    placeholder="Add an author…"
                    className="input w-full text-sm py-2"
                  />
                  {activeInput === "author" && authorSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1a1a24] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {authorSuggestions.map((s) => (
                        <div 
                          key={s} 
                          onClick={() => {
                            if (!customAuthors.includes(s)) {
                              setPrefs((prev) => [...prev, {
                                id: `tmp-author-${s}`, preference_type: "author", preference_value: s,
                                weight: 0.8, created_at: "", updated_at: "",
                              }]);
                            }
                            setNewAuthor("");
                            setAuthorSuggestions([]);
                          }}
                          className="px-4 py-2 text-sm text-white/80 hover:bg-brand-500 hover:text-white cursor-pointer transition-colors"
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={addAuthor} className="btn-secondary text-sm py-2 px-4">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Languages */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe size={18} className="text-emerald-300" />
                <h3 className="font-bold">Preferred Languages</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.value}
                    id={`pref-lang-${l.value}`}
                    onClick={() => toggleLang(l.value)}
                    className={clsx(
                      "px-3 py-1.5 rounded-full text-sm border transition-all duration-200",
                      selectedLangs.includes(l.value)
                        ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                        : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save button */}
            <button
              id="pref-save"
              onClick={handleSavePrefs}
              disabled={saving}
              className="btn-primary w-full py-3"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : saved ? (
                <><CheckCircle size={18} /> Saved!</>
              ) : (
                "Save Preferences"
              )}
            </button>
          </div>
        )}

        {/* ── Account section ── */}
        {!loading && section === "account" && (
          <div className="space-y-4 animate-fade-in">
            <div className="card p-5">
              <h3 className="font-bold mb-4">Account Details</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="account-name" className="block text-sm text-white/50 mb-1.5">
                    Display Name
                  </label>
                  <input
                    id="account-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1.5">Email</label>
                  <div className="input opacity-50 cursor-not-allowed select-none">{user?.email}</div>
                </div>
                <button
                  id="account-save"
                  onClick={handleSaveAccount}
                  disabled={accountSaving}
                  className="btn-primary w-full py-3"
                >
                  {accountSaving ? <Loader2 size={18} className="animate-spin" /> : "Update Account"}
                </button>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-bold mb-3 text-red-300">Danger Zone</h3>
              <button
                id="account-logout"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-colors font-medium"
              >
                <LogOut size={18} />
                Log out of BookLens
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
