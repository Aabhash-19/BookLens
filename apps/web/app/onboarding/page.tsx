"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, ChevronRight, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { setPreferences } from "@/lib/api";
import clsx from "clsx";

const GENRES = [
  "Fiction", "Non-Fiction", "Mystery", "Thriller", "Science Fiction",
  "Fantasy", "Romance", "Historical Fiction", "Biography", "Self-Help",
  "Horror", "Literary Fiction", "Adventure", "Graphic Novel", "Poetry",
  "Psychology", "Philosophy", "Science", "History", "True Crime",
];

const AUTHORS = [
  "Stephen King", "Agatha Christie", "J.K. Rowling", "George Orwell",
  "Toni Morrison", "Haruki Murakami", "Gillian Flynn", "Neil Gaiman",
  "James Clear", "Malcolm Gladwell", "Donna Tartt", "Colleen Hoover",
  "Brandon Sanderson", "Michelle Obama", "Yuval Noah Harari",
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

interface Step {
  title: string;
  subtitle: string;
}

const STEPS: Step[] = [
  { title: "Favourite genres", subtitle: "Pick at least 3 that interest you most" },
  { title: "Favourite authors", subtitle: "Select authors whose work you enjoy (optional)" },
  { title: "Preferred languages", subtitle: "What languages do you read in?" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>(["en"]);
  const [saving, setSaving] = useState(false);

  const toggle = <T,>(arr: T[], setArr: (a: T[]) => void, val: T) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const canNext = () => {
    if (step === 0) return selectedGenres.length >= 3;
    if (step === 1) return true;
    if (step === 2) return selectedLangs.length >= 1;
    return false;
  };

  const handleFinish = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const prefs = [
        ...selectedGenres.map((g) => ({ preference_type: "genre", preference_value: g, weight: 1.0 })),
        ...selectedAuthors.map((a) => ({ preference_type: "author", preference_value: a, weight: 0.8 })),
        ...selectedLangs.map((l) => ({ preference_type: "language", preference_value: l, weight: 1.0 })),
      ];
      await setPreferences(prefs, token);
      router.push("/scan");
    } catch {
      router.push("/scan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-2xl animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 shadow-glow-brand mb-4">
            <BookOpen size={28} />
          </div>
          <h1 className="text-3xl font-black mb-2">Set up your taste profile</h1>
          <p className="text-white/50">This helps BookLens personalise your recommendations from day one.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 px-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div
                className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300",
                  i < step
                    ? "bg-emerald-500 text-white"
                    : i === step
                    ? "bg-brand-500 text-white shadow-glow-sm"
                    : "bg-white/10 text-white/30"
                )}
              >
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx("flex-1 h-0.5 rounded transition-all duration-500", i < step ? "bg-emerald-500" : "bg-white/10")} />
              )}
            </div>
          ))}
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-bold mb-1">{STEPS[step].title}</h2>
          <p className="text-white/50 text-sm mb-6">{STEPS[step].subtitle}</p>

          {/* Step 0 — Genres */}
          {step === 0 && (
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  id={`genre-${g.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={() => toggle(selectedGenres, setSelectedGenres, g)}
                  className={clsx(
                    "px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200",
                    selectedGenres.includes(g)
                      ? "bg-brand-500/25 border-brand-400/50 text-brand-200 shadow-glow-sm"
                      : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {/* Step 1 — Authors */}
          {step === 1 && (
            <div className="flex flex-wrap gap-2">
              {AUTHORS.map((a) => (
                <button
                  key={a}
                  id={`author-${a.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={() => toggle(selectedAuthors, setSelectedAuthors, a)}
                  className={clsx(
                    "px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200",
                    selectedAuthors.includes(a)
                      ? "bg-purple-500/25 border-purple-400/50 text-purple-200"
                      : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Languages */}
          {step === 2 && (
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  id={`lang-${l.value}`}
                  onClick={() => toggle(selectedLangs, setSelectedLangs, l.value)}
                  className={clsx(
                    "px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200",
                    selectedLangs.includes(l.value)
                      ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                      : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="btn-ghost">
                Back
              </button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <button
                id="onboarding-next"
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                id="onboarding-finish"
                onClick={handleFinish}
                disabled={!canNext() || saving}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : (
                  <>
                    Start scanning
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center mt-4 text-white/30 text-sm">
          <button onClick={() => router.push("/scan")} className="hover:text-white/60 transition-colors">
            Skip for now
          </button>
        </p>
      </div>
    </div>
  );
}
