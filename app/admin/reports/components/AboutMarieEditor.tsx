'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Phone, Mail, Globe, Award, QrCode } from 'lucide-react';
import { useReportStore } from '../stores/report-store';

import type { ReportEditorContent } from '@/types/report';

interface AboutMarieContent {
  custom: boolean;
  title: string;
  subtitle: string;
  welcomeText: string;
  paragraphs: string[];
  phone: string;
  email: string;
  website: string;
  location: string;
  license: string;
  appraisalTitle: string;
  steps: string[];
  websiteCtaPrefix: string;
  disclaimer1: string;
  disclaimer2: string;
  disclaimer3: string;
  showQrCode: boolean;
  qrCodeUrl: string;
}

interface AboutMarieEditorProps {
  docId: string;
  initialContent: unknown;
  onContentChange?: (content: ReportEditorContent) => void;
}

const defaultContent = {
  custom: true,
  title: 'A Personal Note from Marie',
  subtitle: 'Bespoke Consultancy',
  welcomeText: 'Hi, Iʼm Marie Nian, Licensed Residential Sales, Barfoot & Thompson.',
  paragraphs: [
    'In New Zealand, we know that property isnʼt just about data and contracts. Itʼs about people, families, and trust. Every home holds a unique story and years of hard work, which is why I choose to bring genuine care, patience, and absolute preparation to every transaction.',
    'With a background in finance, I love digging into the numbers. But instead of relying on automated online estimates, I prefer spending hours personally analysing underlying REINZ data, school zone dynamics, and the real land potential of our local Northcross streets.',
    'My goal is simple: to remove the noise and anxiety from your property decisions by giving you honest, patient, and clear guidance. There is no high-pressure sales pitch here. Whenever you are ready to look at your property\'s true potential, or if you just want to chat over a coffee, I am always here to listen.'
  ],
  phone: '021 069 3089',
  email: 'm.nian@barfoot.co.nz',
  website: 'nzmarie.com',
  location: 'Serving North Shore & Greater Auckland',
  license: 'Licensed under REAA 2008',
  appraisalTitle: 'How a Free Appraisal Works (Our 3-Step No-Pressure Promise)',
  websiteCtaPrefix: 'For more information, visit ',
  steps: [
    'Send your address: Drop a quick line to m.nian@barfoot.co.nz or visit nzmarie.com/appraisal.',
    'I’ll do the homework: Analysing REINZ stats, local school zones, and unitary land potential.',
    'Private, obligation-free delivery: Receive a clear estimate with zero high-pressure sales pitch.'
  ],
  disclaimer1: 'Note: This data reflects broader neighbourhood trends. Since every street in Northcross has its own unique character, feel free to drop me a line at m.nian@barfoot.co.nz if you ever want a quiet, obligation-free chat about your specific address.',
  disclaimer2: 'This document is an independent market analysis prepared by Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). It is based on official REINZ data and does not constitute binding financial valuation advice.',
  disclaimer3: '© 2026 Marie Nian, Licensed Residential Sales, Barfoot & Thompson (Licensed under the REAA 2008). This publication is an independent market analysis based on official REINZ data.',
  showQrCode: false,
  qrCodeUrl: '',
};

export default function AboutMarieEditor({ docId, initialContent, onContentChange }: AboutMarieEditorProps) {
  const { setIsSaving, setLastSaved, updateDocument } = useReportStore();
  const [isEditMode, setIsEditMode] = useState(false);

  const [title, setTitle] = useState(defaultContent.title);
  const [subtitle, setSubtitle] = useState(defaultContent.subtitle);
  const [welcomeText, setWelcomeText] = useState(defaultContent.welcomeText);
  const [paragraphs, setParagraphs] = useState(defaultContent.paragraphs);
  const [phone, setPhone] = useState(defaultContent.phone);
  const [email, setEmail] = useState(defaultContent.email);
  const [website, setWebsite] = useState(defaultContent.website);
  const [location, setLocation] = useState(defaultContent.location);
  const [license, setLicense] = useState(defaultContent.license);
  const [appraisalTitle, setAppraisalTitle] = useState(defaultContent.appraisalTitle);
  const [steps, setSteps] = useState(defaultContent.steps);
  const [websiteCtaPrefix, setWebsiteCtaPrefix] = useState(defaultContent.websiteCtaPrefix);
  const [disclaimer1, setDisclaimer1] = useState(defaultContent.disclaimer1);
  const [disclaimer2, setDisclaimer2] = useState(defaultContent.disclaimer2);
  const [disclaimer3, setDisclaimer3] = useState(defaultContent.disclaimer3);
  const [showQrCode, setShowQrCode] = useState(defaultContent.showQrCode);
  const [qrCodeUrl, setQrCodeUrl] = useState(defaultContent.qrCodeUrl);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrLocalPreview, setQrLocalPreview] = useState<string | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement>(null);
  const qrUploadTokenRef = useRef<number>(0);

  const lastDocIdRef = useRef<string | null>(null);
  const prevContentRef = useRef<string>('');

  useEffect(() => {
    if (docId !== lastDocIdRef.current) {
      lastDocIdRef.current = docId;
      const data = (initialContent && typeof initialContent === 'object' && 'custom' in initialContent)
        ? (initialContent as unknown as AboutMarieContent)
        : defaultContent;
      setTitle(data.title || defaultContent.title);
      setSubtitle(data.subtitle || defaultContent.subtitle);
      setWelcomeText(data.welcomeText || defaultContent.welcomeText);
      setParagraphs(data.paragraphs || defaultContent.paragraphs);
      setPhone(data.phone || defaultContent.phone);
      setEmail(data.email || defaultContent.email);
      setWebsite(data.website || defaultContent.website);
      setLocation(data.location || defaultContent.location);
      setLicense(data.license || defaultContent.license);
      setAppraisalTitle(data.appraisalTitle || defaultContent.appraisalTitle);
      setSteps(data.steps || defaultContent.steps);
      setWebsiteCtaPrefix(data.websiteCtaPrefix || defaultContent.websiteCtaPrefix);
      setDisclaimer1(data.disclaimer1 || defaultContent.disclaimer1);
      setDisclaimer2(data.disclaimer2 || defaultContent.disclaimer2);
      setDisclaimer3(data.disclaimer3 || defaultContent.disclaimer3);
      setShowQrCode(typeof data.showQrCode === 'boolean' ? data.showQrCode : defaultContent.showQrCode);
      setQrCodeUrl(data.qrCodeUrl || defaultContent.qrCodeUrl);
      setQrLocalPreview(null);
    }
  }, [docId, initialContent]);

  const saveContent = useCallback(async (contentToSave: AboutMarieContent) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/reports/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, content: contentToSave }),
      });
      const result = await res.json();
      if (result.success) {
        setLastSaved(new Date().toLocaleTimeString('en-NZ'));
        const editorContent = (result.success ? contentToSave : undefined) as unknown as ReportEditorContent;
        updateDocument(docId, { content: editorContent });
        onContentChange?.(editorContent);
      }
    } catch {
    } finally {
      setIsSaving(false);
    }
  }, [docId, setIsSaving, setLastSaved, updateDocument, onContentChange]);

  useEffect(() => {
    const payload = {
      custom: true,
      title,
      subtitle,
      welcomeText,
      paragraphs,
      phone,
      email,
      website,
      location,
      license,
      appraisalTitle,
      steps,
      websiteCtaPrefix,
      disclaimer1,
      disclaimer2,
      disclaimer3,
      showQrCode,
      qrCodeUrl,
    };
    const payloadString = JSON.stringify(payload);
    if (prevContentRef.current && prevContentRef.current !== payloadString) {
      const timer = setTimeout(() => {
        saveContent(payload);
      }, 1500);
      prevContentRef.current = payloadString;
      return () => clearTimeout(timer);
    } else {
      prevContentRef.current = payloadString;
    }
  }, [
    title,
    subtitle,
    welcomeText,
    paragraphs,
    phone,
    email,
    website,
    location,
    license,
    appraisalTitle,
    steps,
    websiteCtaPrefix,
    disclaimer1,
    disclaimer2,
    disclaimer3,
    showQrCode,
    qrCodeUrl,
    saveContent
  ]);

  const handleQrUpload = useCallback(async (file: File) => {
    const token = ++qrUploadTokenRef.current;
    const localUrl = URL.createObjectURL(file);
    setQrLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return localUrl;
    });
    setQrUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/reports/about-marie-qr', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (token === qrUploadTokenRef.current && data.success && data.url) {
        setQrCodeUrl(data.url);
        setQrLocalPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    } catch {
    } finally {
      if (token === qrUploadTokenRef.current) {
        setQrUploading(false);
      }
    }
  }, []);

  const handleQrRemove = useCallback(() => {
    qrUploadTokenRef.current++;
    setQrCodeUrl('');
    setQrLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setQrUploading(false);
    if (qrFileInputRef.current) {
      qrFileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 print:p-0">
      <div className="flex justify-end gap-2 mb-6 print:hidden">
        <button
          onClick={() => setIsEditMode(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer ${
            !isEditMode
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => setIsEditMode(true)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer ${
            isEditMode
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Edit Content
        </button>
      </div>

      {!isEditMode ? (
        <div
          id="am-root"
          className="max-w-[210mm] mx-auto bg-white min-h-[297mm] shadow-lg border border-slate-200/50 rounded-sm relative flex flex-col justify-between text-slate-800 pt-[70px] px-[40px] pb-[40px] print:shadow-none print:border-none print:p-0 print:max-w-none print:min-h-0 print:bg-transparent"
        >
          <style>{`
            #am-root {
              box-sizing: border-box;
            }
            @media print {
              /* Hide navigation bar */
              nav { display: none !important; }
              /* Hide report sidebars/toolbars/footers */
              .reports-sidebar { display: none !important; }
              .reports-toolbar { display: none !important; }
              .reports-editor-status { display: none !important; }
              .print-footer { display: none !important; }
              body { overflow: visible !important; background: white !important; }
              
              /* Override standard layout containers for print */
              .reports-layout-wrapper {
                position: static !important;
                overflow: visible !important;
                display: block !important;
              }
              .reports-layout-wrapper > main {
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
              }
              main {
                padding: 0 !important;
                margin: 0 !important;
                max-width: 100% !important;
              }
              
              /* Zero page margins to clear browser headers and footers */
              @page {
                size: A4;
                margin: 0;
              }
              
              /* Force exact A4 dimensions and custom padding margins inside document */
              #am-root {
                width: 210mm !important;
                height: 297mm !important;
                padding: 70px 40px 40px 40px !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                box-sizing: border-box !important;
                page-break-after: avoid !important;
                page-break-before: avoid !important;
              }
              .max-w-6xl {
                background: white !important;
              }
            }
          `}</style>

          <div>
            <div id="am-header" className="border-b border-slate-200/80 pb-4 mb-6 text-left">
              <div className="am-badge tracking-widest text-xs font-light text-slate-400 mb-1">
                {subtitle}
              </div>
              <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">
                {title}
              </h1>
            </div>

            <div id="am-grid" className="grid grid-cols-12 gap-8 items-stretch">
              <div id="am-left" className="col-span-4 flex flex-col justify-between text-left">

                {/* Headshot */}
                <div id="am-photo-wrap" className="overflow-hidden rounded-2xl shadow-lg border border-slate-100 bg-slate-50 aspect-[4/5] w-full">
                  <Image
                    src="/img/Marie_large7-Photoroom.png"
                    alt="Marie Nian"
                    width={859}
                    height={1014}
                    className="w-full h-full object-cover object-center"
                  />
                </div>

                {/* Contact card — contains contact rows + license subtext as one cohesive block */}
                <div id="am-contact" className="flex flex-col gap-2 bg-gradient-to-br from-slate-50 to-slate-100/30 border border-slate-200/50 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2.5 text-slate-600 text-xs">
                    <span className="flex-shrink-0 text-[11px]" aria-hidden="true">📍</span>
                    <span>{location}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 text-xs">
                    <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
                    <span>{phone}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 text-xs">
                    <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
                    <a href={`mailto:${email}`} className="hover:text-slate-900 underline underline-offset-2 transition-colors">
                      {email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 text-xs">
                    <Globe className="w-3 h-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
                    <a href={`https://${website}`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 underline underline-offset-2 transition-colors">
                      {website}
                    </a>
                  </div>

                  {/* License subtext — flush muted label, no button affordance */}
                  <p className="text-[11px] text-slate-500 font-medium mt-1.5 leading-normal">
                    Licensed under REAA 2008
                  </p>
                </div>

                {/* QR code micro-card */}
                {showQrCode && (qrCodeUrl || qrLocalPreview) && (
                  <div
                    id="am-qrcode"
                    className="bg-gradient-to-br from-slate-50 to-slate-100/30 border border-slate-200/50 rounded-xl p-3 shadow-sm flex flex-col items-center"
                  >
                    <Image
                      src={qrLocalPreview || qrCodeUrl}
                      alt="QR Code — scan to visit nzmarie.com"
                      width={112}
                      height={112}
                      style={{ borderRadius: '4px', display: 'block' }}
                      unoptimized
                    />
                    <span className="text-[11px] text-slate-500 font-medium text-center mt-0.5 tracking-wider">
                      Scan to visit
                    </span>
                  </div>
                )}
              </div>

              <div id="am-right" className="col-span-8 flex flex-col gap-4 text-left">
                <div id="am-welcome" className="text-lg font-serif text-slate-800 leading-snug">
                  {welcomeText}
                </div>

                <div id="am-paragraphs" className="space-y-3">
                  {paragraphs.map((p, idx) => (
                    <p key={idx} className="text-slate-600 leading-relaxed text-xs md:text-sm">
                      {p}
                    </p>
                  ))}
                </div>

                <div id="am-appraisal" className="bg-gradient-to-br from-slate-50 to-slate-100/30 border border-slate-200/50 rounded-xl p-5 mt-2 shadow-sm">
                  <h3 className="text-sm font-serif font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-slate-800" />
                    {appraisalTitle}
                  </h3>
                  <div id="am-steps" className="space-y-4">
                    {steps.map((step, idx) => {
                      const parts = step.split(':');
                      const boldPart = parts[0];
                      const normalPart = parts.slice(1).join(':');
                      return (
                        <div key={idx} className="flex items-start gap-2.5">
                          <span className="am-step-num font-semibold text-slate-900 text-xs md:text-sm flex-shrink-0 mt-0.5">
                            {idx + 1}.
                          </span>
                          <div className="am-step-text text-slate-600 text-xs md:text-sm leading-relaxed">
                            {boldPart && (
                              <strong className="font-semibold text-slate-900 mr-1">
                                {boldPart}:
                              </strong>
                            )}
                            <span>{normalPart}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-200/50 text-xs text-slate-400 leading-relaxed">
                    {websiteCtaPrefix}
                    <a href={`https://${website}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900 transition-colors">
                      {website}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="am-footer" className="mt-auto pt-6 border-t border-slate-100 text-left space-y-2">
            <p className="text-[9.5px] text-slate-400/80 leading-normal">
              {disclaimer1}
            </p>
            <p className="text-[9.5px] text-slate-400/80 leading-normal">
              {disclaimer2}
            </p>
            <p className="text-[9.5px] text-slate-400/80 leading-normal">
              {disclaimer3}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto p-6 bg-slate-50 rounded-xl border border-slate-100 text-left">
          <div className="border-b border-slate-200 pb-4 mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Edit About Marie</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Page Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Subtitle Badge
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Location Tag
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
              Welcome Tagline
            </label>
            <input
              type="text"
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm font-serif"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
              Narrative Paragraphs
            </label>
            <div className="space-y-4">
              {paragraphs.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <textarea
                    value={p}
                    onChange={(e) => {
                      const newParagraphs = [...paragraphs];
                      newParagraphs[idx] = e.target.value;
                      setParagraphs(newParagraphs);
                    }}
                    rows={3}
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm leading-relaxed"
                  />
                  <button
                    onClick={() => {
                      const newParagraphs = paragraphs.filter((_, i) => i !== idx);
                      setParagraphs(newParagraphs);
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 rounded border border-transparent hover:border-slate-200 cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>
              ))}
              <button
                onClick={() => setParagraphs([...paragraphs, ''])}
                className="px-3 py-1.5 text-xs bg-slate-200 text-slate-700 font-medium rounded hover:bg-slate-300 cursor-pointer"
              >
                + Add Paragraph
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Website URL
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                License Info
              </label>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">QR Code</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showQrCode}
                  onChange={(e) => setShowQrCode(e.target.checked)}
                  className="w-4 h-4 accent-slate-900 cursor-pointer"
                  data-testid="qr-toggle"
                />
                <span className="text-xs font-medium text-slate-600">Show on page</span>
              </label>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <label className="block text-xs font-semibold text-slate-600 tracking-wider">
                  Upload QR Code Image
                </label>
                <input
                  ref={qrFileInputRef}
                  type="file"
                  accept="image/*"
                  data-testid="qr-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleQrUpload(file);
                  }}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
                {qrUploading && (
                  <p className="text-xs text-slate-400">Uploading…</p>
                )}
                {qrCodeUrl && !qrUploading && (
                  <p className="text-xs text-slate-400 truncate" data-testid="qr-url-display">
                    {qrCodeUrl}
                  </p>
                )}
              </div>

              {(qrLocalPreview || qrCodeUrl) && (
                <div className="flex flex-col items-center gap-2 flex-shrink-0" data-testid="qr-preview">
                  <Image
                    src={qrLocalPreview || qrCodeUrl}
                    alt="QR Code Preview"
                    width={80}
                    height={80}
                    className="rounded border border-slate-200"
                    unoptimized
                  />
                  <span className="text-[10px] text-slate-400">Preview</span>
                  <button
                    type="button"
                    onClick={handleQrRemove}
                    data-testid="qr-remove-btn"
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-500 bg-red-50 border border-red-100 rounded-md hover:bg-red-100 hover:border-red-200 transition-colors cursor-pointer"
                  >
                    <span>✕</span>
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6 mt-4">
            <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
              Appraisal Promise Box Title
            </label>
            <input
              type="text"
              value={appraisalTitle}
              onChange={(e) => setAppraisalTitle(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm mb-4"
            />

            <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
              Appraisal Promise Steps
            </label>
            <div className="space-y-4 mb-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-center">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => {
                      const newSteps = [...steps];
                      newSteps[idx] = e.target.value;
                      setSteps(newSteps);
                    }}
                    className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
                  />
                </div>
              ))}
            </div>
            <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
              Website CTA Prefix
            </label>
            <input
              type="text"
              value={websiteCtaPrefix}
              onChange={(e) => setWebsiteCtaPrefix(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm"
            />
          </div>

          <div className="border-t border-slate-200 pt-6 mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Footer Disclaimer 1
              </label>
              <textarea
                value={disclaimer1}
                onChange={(e) => setDisclaimer1(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Footer Disclaimer 2
              </label>
              <textarea
                value={disclaimer2}
                onChange={(e) => setDisclaimer2(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 tracking-wider mb-2">
                Footer Disclaimer 3
              </label>
              <textarea
                value={disclaimer3}
                onChange={(e) => setDisclaimer3(e.target.value)}
                rows={2}
                className="w-full p-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 text-sm leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
