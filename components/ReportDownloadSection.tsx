"use client";

import React, { useState } from "react";
import { toast } from "react-toastify";
import { translations, Language } from "../lib/translations";

export default function ReportDownloadSection({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].reportDownload;
  
  const [formData, setFormData] = useState({
    firstName: "",
    email: "",
    phone: "",
    suburb: "North Shore",
    subscribe: false,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "limit">("idle");
  const [limitInfo, setLimitInfo] = useState<{ remaining: number; canDownload: boolean } | null>(null);

  // Check download limit when email changes
  React.useEffect(() => {
    const checkLimit = async () => {
      if (formData.email && formData.email.includes('@') && formData.suburb) {
        try {
          const res = await fetch(
            `/api/reports/check-limit?email=${encodeURIComponent(formData.email)}&suburb=${encodeURIComponent(formData.suburb)}`
          );
          const data = await res.json();
          if (data.success) {
            setLimitInfo({
              remaining: data.remaining,
              canDownload: data.canDownload,
            });
            if (!data.canDownload) {
              setStatus("limit");
            } else if (status === "limit") {
              setStatus("idle");
            }
          }
        } catch (error) {
          console.error("Failed to check download limit:", error);
        }
      }
    };

    const timeoutId = setTimeout(checkLimit, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.email, formData.suburb, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent submission if limit is reached
    if (status === "limit" || (limitInfo && !limitInfo.canDownload)) {
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/reports/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.action === "download" && data.downloadUrl) {
        setStatus("success");
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        toast.success(t.success, { toastId: "report-download-success", autoClose: 5000 });
        setTimeout(() => {
          setStatus("idle");
          // Re-check limit after download
          setLimitInfo(null);
        }, 3000);
      } else if (data.reason === "limit") {
        setStatus("limit");
        toast.warning(t.limitReached, { toastId: "report-download-limit", autoClose: 6000 });
      } else if (data.reason === "no_report") {
        toast.info(t.inProgress, { toastId: "report-no-report", autoClose: 6000 });
        setStatus("idle");
      } else {
        setStatus("error");
        toast.error(t.error, { toastId: "report-download-error" });
      }
    } catch {
      setStatus("error");
      toast.error(t.error, { toastId: "report-download-error" });
    }
  };

  return (
    <section className="py-20 bg-slate-900 text-white relative overflow-hidden" id="download-report">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(30,58,138,0.3),transparent_70%)] pointer-events-none" />
      <div className="container mx-auto px-4 max-w-3xl relative z-10">
        <div className="text-center mb-12">
          <span className="text-blue-400 font-bold capitalize tracking-wider text-sm">
            Local Market Reports
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold mt-2 mb-4 tracking-tight text-white">
            {t.title}
          </h2>
          <p className="text-slate-300 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            {t.subtitle}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white text-slate-900 p-6 md:p-10 rounded-2xl shadow-2xl space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t.firstName} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full pl-4 pr-10 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                placeholder="e.g. Jane"
              />
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t.email} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-4 pr-10 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                placeholder="e.g. jane@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t.subregion} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.suburb}
                onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 bg-white"
              >
                <option value="North Shore">North Shore</option>
                <option value="Oteha">Oteha</option>
                <option value="Northcross">Northcross</option>
                <option value="Albany">Albany</option>
                <option value="Browns Bay">Browns Bay</option>
                <option value="Glenfield">Glenfield</option>
                <option value="Pinehill">Pinehill</option>
                <option value="Rosedale">Rosedale</option>
                <option value="Long Bay">Long Bay</option>
                <option value="Torbay">Torbay</option>
                <option value="Mairangi Bay">Mairangi Bay</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t.phone}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-4 pr-10 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                placeholder="e.g. 021 000 000"
              />
            </div>
          </div>

          {/* Newsletter consent checkbox hidden until the feature is implemented */}
          <button
            type="submit"
            disabled={status === "loading" || status === "limit" || (limitInfo !== null && !limitInfo.canDownload)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 text-center"
          >
            {status === "loading" ? t.loading : t.submit}
          </button>

          {limitInfo && !limitInfo.canDownload && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-2">
              <p className="text-amber-800 text-sm font-medium">
                ⚠️ Download limit reached (5 per month).{" "}
                <a href="#appraisal" className="text-blue-600 underline hover:text-blue-700">
                  Request a personalized analysis instead
                </a>
              </p>
            </div>
          )}

          {limitInfo && limitInfo.canDownload && limitInfo.remaining <= 2 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
              <p className="text-blue-700 text-xs">
                ℹ️ {limitInfo.remaining} download{limitInfo.remaining !== 1 ? 's' : ''} remaining this month
              </p>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
