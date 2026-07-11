"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, Upload, RotateCcw, CheckCircle, XCircle, Loader2, BookOpen, Scan, AlertTriangle, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import clsx from "clsx";

type Stage = "idle" | "camera" | "preview" | "processing" | "result" | "confirm";

export default function ScanPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<api.ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user && !token) router.push("/auth/login");
  }, [user, token, router]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStage("camera");
    } catch {
      setCameraError("Camera access denied. Please use the upload option instead.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setCapturedFile(file);
      stopCamera();
      setStage("preview");
    }, "image/jpeg", 0.92);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCapturedFile(file);
    setStage("preview");
  };

  const handleUploadAndScan = async () => {
    if (!capturedFile || !token) return;
    setError(null);
    setStage("processing");
    try {
      const result = await api.uploadScan(capturedFile, token);
      setScanResult(result);
      if (result.status === "identified") {
        setStage("result");
      } else if (result.status === "needs_confirmation") {
        setStage("confirm");
      } else {
        setStage("confirm"); // show candidates even if failed
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
      setStage("preview");
    }
  };

  const handleConfirm = async (candidate: api.ScanCandidate) => {
    if (!scanResult || !token) return;
    try {
      const response = await api.confirmScan(scanResult.scan_id, { book_data: candidate as unknown as Record<string, unknown> }, token);
      if (response.identified_book_id) {
        router.push(`/books/${response.identified_book_id}`);
      } else {
        router.push("/library");
      }
    } catch {
      router.push("/library");
    }
  };

  const handleAddToLibrary = async (status: string) => {
    if (!scanResult?.identified_book_id || !token) return;
    try {
      await api.addToLibrary(scanResult.identified_book_id, { interaction_type: status }, token);
      router.push("/library");
    } catch {
      router.push("/library");
    }
  };

  const reset = () => {
    stopCamera();
    setStage("idle");
    setPreviewUrl(null);
    setCapturedFile(null);
    setScanResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Page header */}
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center">
            <Scan size={20} className="text-brand-300" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Scan a Book</h1>
            <p className="text-white/40 text-sm">Photograph a cover or barcode to identify it</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* ── IDLE: action selection ── */}
        {stage === "idle" && (
          <div className="animate-fade-in space-y-4">
            {cameraError && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm flex gap-3">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                {cameraError}
              </div>
            )}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                {error}
              </div>
            )}
            <button
              id="scan-open-camera"
              onClick={startCamera}
              className="w-full card p-6 flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center group-hover:bg-brand-500/25 transition-colors">
                <Camera size={28} className="text-brand-300" />
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">Use Camera</div>
                <div className="text-white/40 text-sm">Point at a book cover or barcode</div>
              </div>
            </button>

            <button
              id="scan-upload-file"
              onClick={() => fileInputRef.current?.click()}
              className="w-full card p-6 flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center group-hover:bg-purple-500/25 transition-colors">
                <Upload size={28} className="text-purple-300" />
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">Upload Image</div>
                <div className="text-white/40 text-sm">JPEG, PNG, or WebP up to 8 MB</div>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileUpload}
              id="scan-file-input"
            />
          </div>
        )}

        {/* ── CAMERA ── */}
        {stage === "camera" && (
          <div className="animate-fade-in">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {/* Viewfinder overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-40 border-2 border-white/40 rounded-xl relative">
                  <div className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-brand-400 rounded-tl-xl" />
                  <div className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-brand-400 rounded-tr-xl" />
                  <div className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-brand-400 rounded-bl-xl" />
                  <div className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-brand-400 rounded-br-xl" />
                </div>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
                Align the book cover within the frame
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex items-center justify-center gap-4 mt-6">
              <button onClick={reset} className="btn-secondary">
                <X size={18} /> Cancel
              </button>
              <button id="scan-capture" onClick={capturePhoto} className="btn-primary px-10 py-3 text-lg">
                <Camera size={20} /> Capture
              </button>
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {stage === "preview" && previewUrl && (
          <div className="animate-fade-in">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-6">
              <Image src={previewUrl} alt="Book scan preview" fill className="object-cover" />
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                {error}
              </div>
            )}
            <div className="flex items-center gap-4">
              <button onClick={reset} className="btn-secondary flex-1">
                <RotateCcw size={18} /> Retake
              </button>
              <button id="scan-submit" onClick={handleUploadAndScan} className="btn-primary flex-1">
                <Scan size={18} /> Identify Book
              </button>
            </div>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {stage === "processing" && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-20 gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-2 border-brand-500/20 flex items-center justify-center">
                <Loader2 size={40} className="text-brand-400 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-brand-500/40 animate-ping" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg mb-1">Identifying your book…</p>
              <p className="text-white/40 text-sm">Scanning barcodes, running OCR, searching APIs</p>
            </div>
            <div className="w-full max-w-xs space-y-2">
              {["Preprocessing image", "Detecting barcode", "Running OCR", "Searching book databases"].map((step, i) => (
                <div key={step} className="flex items-center gap-3 text-sm text-white/30" style={{ animationDelay: `${i * 300}ms` }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── RESULT: auto-identified ── */}
        {stage === "result" && scanResult?.identified_book_id && (
          <IdentifiedResult
            scanResult={scanResult}
            onAddToLibrary={handleAddToLibrary}
            onRescan={reset}
          />
        )}

        {/* ── CONFIRM: candidate list ── */}
        {stage === "confirm" && scanResult && (
          <CandidateList
            scanResult={scanResult}
            onConfirm={handleConfirm}
            onRescan={reset}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IdentifiedResult({
  scanResult,
  onAddToLibrary,
  onRescan,
}: {
  scanResult: api.ScanResponse;
  onAddToLibrary: (status: string) => void;
  onRescan: () => void;
}) {
  const router = useRouter();
  const topCandidate = scanResult.candidates[0];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
        <CheckCircle size={18} />
        Book identified via {scanResult.recognition_method === "barcode" ? "ISBN barcode" : "OCR text recognition"}
      </div>

      {topCandidate && (
        <div className="card p-5 mb-6">
          <div className="flex gap-4">
            {topCandidate.cover_url && (
              <div className="relative w-20 h-28 rounded-lg overflow-hidden flex-shrink-0">
                <Image src={topCandidate.cover_url} alt="Cover" fill className="object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-xl leading-tight mb-1">{topCandidate.title}</h2>
              <p className="text-white/50 text-sm mb-2">{topCandidate.authors.join(", ")}</p>
              {topCandidate.isbn_13 && (
                <span className="badge-brand text-xs">ISBN: {topCandidate.isbn_13}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-white/50 text-sm mb-3">Add this book to your library:</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { value: "want_to_read", label: "Want to Read", emoji: "📖" },
          { value: "reading", label: "Reading Now", emoji: "📚" },
          { value: "finished", label: "I've Read It", emoji: "✅" },
          { value: "favourited", label: "Favourite", emoji: "⭐" },
        ].map((s) => (
          <button
            key={s.value}
            id={`add-library-${s.value}`}
            onClick={() => onAddToLibrary(s.value)}
            className="card p-4 flex flex-col items-center gap-1.5 hover:-translate-y-1 transition-transform duration-200 cursor-pointer"
          >
            <span className="text-2xl">{s.emoji}</span>
            <span className="text-sm font-medium">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        {scanResult.identified_book_id && (
          <button onClick={() => router.push(`/books/${scanResult.identified_book_id}`)} className="btn-secondary flex-1">
            <BookOpen size={16} /> View Details
          </button>
        )}
        <button onClick={onRescan} className="btn-ghost">Scan Another</button>
      </div>
    </div>
  );
}

function CandidateList({
  scanResult,
  onConfirm,
  onRescan,
}: {
  scanResult: api.ScanResponse;
  onConfirm: (candidate: api.ScanCandidate) => void;
  onRescan: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
        <AlertTriangle size={18} />
        {scanResult.candidates.length > 0
          ? "We found some matches. Which one is your book?"
          : "Could not identify the book. Try a clearer photo."}
      </div>

      {scanResult.candidates.length > 0 ? (
        <div className="space-y-3 mb-6">
          {scanResult.candidates.map((c, i) => (
            <button
              key={i}
              id={`confirm-candidate-${i}`}
              onClick={() => onConfirm(c)}
              className="w-full card p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
            >
              {c.cover_url ? (
                <div className="relative w-12 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src={c.cover_url} alt="Cover" fill className="object-cover" />
                </div>
              ) : (
                <div className="w-12 h-16 rounded-lg bg-brand-500/15 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={18} className="text-brand-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{c.title}</div>
                <div className="text-white/40 text-sm">{c.authors.join(", ")}</div>
                <div className="mt-1">
                  <span className="text-xs text-brand-300">{Math.round(c.confidence * 100)}% match</span>
                </div>
              </div>
              <CheckCircle size={18} className="text-white/20 flex-shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-white/40">
          <XCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>No matches found. Try a clearer or different angle photo.</p>
        </div>
      )}

      <button onClick={onRescan} className="btn-secondary w-full">
        <RotateCcw size={18} /> Try Again
      </button>
    </div>
  );
}
