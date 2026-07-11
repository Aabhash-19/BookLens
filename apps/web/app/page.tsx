import Link from "next/link";
import { Camera, Sparkles, BookOpen, Star, ChevronRight, Zap, Shield, Cpu } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BookLens — Scan Books. Discover More.",
  description:
    "Photograph any book cover and BookLens instantly identifies it, retrieves full details, and learns your reading taste to recommend your next favourite book.",
};

const FEATURES = [
  {
    icon: Camera,
    title: "Scan Any Book",
    desc: "Point your camera at a book cover or ISBN barcode. Our pipeline identifies it in seconds using barcode detection, OCR, and image recognition.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Cpu,
    title: "AI-Powered Matching",
    desc: "Deep semantic embeddings match your scanned books against millions of titles. The more you interact, the smarter your recommendations become.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Sparkles,
    title: "Personalised Discover",
    desc: "Recommendations you'll actually love — with explanations. \"Because you enjoy psychological thrillers by Gillian Flynn.\"",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: BookOpen,
    title: "Your Reading Life",
    desc: "Track what you want to read, are currently reading, and have finished. Rate and take notes on every book in your library.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Shield,
    title: "Private by Design",
    desc: "Your reading data belongs to you. Row-level security, signed image URLs, and full data deletion on request.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    icon: Zap,
    title: "Installable PWA",
    desc: "Add BookLens to your home screen. Works in any browser, on any device — no app store needed.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Create your account", desc: "Sign up and tell us your favourite genres, authors, and reading interests." },
  { step: "02", title: "Scan a book", desc: "Photograph any book cover or barcode. We identify it instantly." },
  { step: "03", title: "Build your library", desc: "Mark books as reading, finished, or favourited. Rate and add notes." },
  { step: "04", title: "Discover more", desc: "Get personalised recommendations that improve with every interaction." },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[100px]" />
      </div>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24">
        <div className="max-w-4xl mx-auto text-center stagger-children">
          <div className="inline-flex items-center gap-2 badge-brand mb-8 px-4 py-1.5 text-sm">
            <Sparkles size={14} />
            AI-powered book discovery
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-tight mb-6">
            Scan any book.{" "}
            <span className="text-gradient block">Discover your next.</span>
          </h1>

          <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            BookLens identifies books from photos, builds your personal library,
            and recommends reads you'll actually love — getting smarter with every interaction.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" id="cta-get-started" className="btn-primary text-lg px-8 py-4">
              <Camera size={20} />
              Start scanning for free
            </Link>
            <Link href="/auth/login" className="btn-secondary text-lg px-8 py-4">
              Sign in
              <ChevronRight size={18} />
            </Link>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-white/40">
            <div className="flex items-center gap-1.5">
              <Star size={14} className="text-amber-400 fill-amber-400" />
              No credit card
            </div>
            <div className="flex items-center gap-1.5">
              <Shield size={14} className="text-emerald-400" />
              Private by default
            </div>
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-blue-400" />
              Works offline
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Everything you need for your{" "}
              <span className="text-gradient-brand">reading life</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              From scanning to recommendations — a complete reading companion in your browser.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6 hover:-translate-y-1 transition-transform duration-300">
                <div className={`w-12 h-12 rounded-2xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon size={24} className={f.color} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How it works</h2>
            <p className="text-white/50 text-lg">Up and running in under 2 minutes.</p>
          </div>

          <div className="space-y-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.step}
                className="card p-6 flex items-start gap-6"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center">
                  <span className="text-brand-300 font-bold text-sm">{step.step}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                  <p className="text-white/50">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="card p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 to-purple-600/5" />
            <div className="relative">
              <h2 className="text-4xl font-black mb-4">
                Ready to discover your next favourite book?
              </h2>
              <p className="text-white/60 mb-8">
                Join thousands of readers who let BookLens guide their next great read.
              </p>
              <Link href="/auth/signup" id="cta-footer" className="btn-primary text-lg px-10 py-4">
                <Camera size={20} />
                Get started — it's free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-400" />
            <span className="font-semibold text-white/50">BookLens</span>
          </div>
          <p>Built with FastAPI, Next.js, PostgreSQL, and Sentence Transformers.</p>
        </div>
      </footer>
    </div>
  );
}
