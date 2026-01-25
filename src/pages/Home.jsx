import { useCallback, useEffect, useRef, useState } from "react";
import FeatureSection from "../components/FeatureSection";
import Footer from "../components/Footer";
import Hero from "../components/Hero";
import HowItWorks from "../components/HowItWorks";
import Navbar from "../components/Navbar";
import UploadBox from "../components/UploadBox";

const makeShareLink = () => {
  const token =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  return `https://savewoi.app/share/${token}`;
};

export default function Home() {
  const [expiresIn, setExpiresIn] = useState("7");
  const [uploadState, setUploadState] = useState({
    status: "idle",
    progress: 0,
    file: null,
    link: "",
    error: "",
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const resetUpload = useCallback(() => {
    setUploadState({
      status: "idle",
      progress: 0,
      file: null,
      link: "",
      error: "",
    });
  }, []);

  const handleUpload = useCallback((file) => {
    if (!file) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setUploadState({
      status: "uploading",
      progress: 0,
      file,
      link: "",
      error: "",
    });

    let progress = 0;
    intervalRef.current = setInterval(() => {
      progress += Math.floor(Math.random() * 18) + 8;
      if (progress >= 100) {
        progress = 100;
        clearInterval(intervalRef.current);
        setUploadState({
          status: "success",
          progress,
          file,
          link: makeShareLink(),
          error: "",
        });
        return;
      }
      setUploadState((prev) => ({
        ...prev,
        progress,
        status: "uploading",
      }));
    }, 420);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div id="top" />
      <Navbar />
      <main>
        <Hero />
        <UploadBox
          onUpload={handleUpload}
          uploadState={uploadState}
          expiresIn={expiresIn}
          onExpiresInChange={setExpiresIn}
          onReset={resetUpload}
        />
        <FeatureSection />
        <HowItWorks />
        <section id="pricing" className="py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                Pricing & limits
              </p>
              <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
                Simple tiers to fit your sharing needs
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                Start free and upgrade when you need larger storage or custom
                expiry control.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/80">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                  Anonymous
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  Free forever
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li>• Max file size: 50MB</li>
                  <li>• Auto-expire: 7 days</li>
                  <li>• Instant share link</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-blue-200/70 bg-blue-50/70 p-6 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                  Registered
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  1GB storage
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li>• Max file size: 1GB</li>
                  <li>• Custom expiry dates</li>
                  <li>• Upload history & analytics</li>
                </ul>
                <button
                  type="button"
                  className="mt-6 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
                >
                  Join waitlist
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
