"use client";

import { useState } from "react";

interface UploadFormData {
  suburb: string;
  version: string;
  title: string;
  file: File | null;
}

const SUBURBS = ["North Shore", "Northcross", "Albany", "Browns Bay", "Glenfield", "Others"];

export default function ReportUploadForm({ onSuccess }: { onSuccess?: () => void }) {
  const [formData, setFormData] = useState<UploadFormData>({
    suburb: "",
    version: "",
    title: "",
    file: null,
  });
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file || !formData.suburb || !formData.version || !formData.title) {
      setErrorMsg("All fields are required");
      return;
    }
    setStatus("uploading");
    setErrorMsg("");

    const data = new FormData();
    data.append("file", formData.file);
    data.append("suburb", formData.suburb);
    data.append("version", formData.version);
    data.append("title", formData.title);

    try {
      const res = await fetch("/api/admin/reports/upload", { method: "POST", body: data });
      const json = await res.json();
      if (json.success) {
        setStatus("success");
        onSuccess?.();
      } else {
        setStatus("error");
        setErrorMsg(json.error || "Upload failed");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    }
  };

  return (
    <form id="report-upload-form" onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Suburb</label>
        <select
          id="upload-suburb"
          value={formData.suburb}
          onChange={(e) => setFormData((f) => ({ ...f, suburb: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
        >
          <option value="">Select suburb</option>
          {SUBURBS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
        <input
          id="upload-version"
          type="text"
          placeholder="e.g. 2026-Q2"
          value={formData.version}
          onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          id="upload-title"
          type="text"
          placeholder="e.g. Northcross Market Report"
          value={formData.title}
          onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">PDF File</label>
        <input
          id="upload-file"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFormData((f) => ({ ...f, file: e.target.files?.[0] || null }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
        />
      </div>
      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      {status === "success" && <p className="text-sm text-green-600">Report uploaded successfully</p>}
      <button
        id="upload-submit-btn"
        type="submit"
        disabled={status === "uploading"}
        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {status === "uploading" ? "Uploading..." : "Upload Report"}
      </button>
    </form>
  );
}
