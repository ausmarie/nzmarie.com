"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  GraduationCap, 
  TrendingUp, 
  Award, 
  Loader2, 
  Phone, 
  Mail, 
  ArrowRight, 
  Lock, 
  Scale, 
  CheckCircle,
  FileText,
  User,
  ShieldCheck,
  Percent
} from "lucide-react";

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function HousePageContent() {
  const searchParams = useSearchParams();
  const utmSource = searchParams.get("utm_source");

  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  const [funnelStep, setFunnelStep] = useState<"input" | "analyzing" | "lead" | "success">("input");
  const [analysisStep, setAnalysisStep] = useState(0);

  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!addressQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            addressQuery
          )}&countrycodes=nz&format=json&limit=5`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "nzmarie-real-estate-app",
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
          setShowDropdown(true);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [addressQuery]);

  const handleSelectAddress = (address: string) => {
    setAddressQuery(address);
    setSelectedAddress(address);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const triggerSilentCapture = (address: string) => {
    fetch("/api/capture-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        utmSource: utmSource || "direct",
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch((err) => console.error(err));
  };

  const handleStartAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressQuery.trim()) return;

    const addressText = selectedAddress || addressQuery;
    triggerSilentCapture(addressText);

    setFunnelStep("analyzing");
    setAnalysisStep(0);

    let currentStep = 0;
    const stepsInterval = setInterval(() => {
      currentStep += 1;
      if (currentStep > 2) {
        clearInterval(stepsInterval);
        setTimeout(() => {
          setFunnelStep("lead");
        }, 600);
      } else {
        setAnalysisStep(currentStep);
      }
    }, 900);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.trim() || !leadName.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/submit-appraisal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: selectedAddress || addressQuery,
          name: leadName,
          email: leadEmail,
          phone: leadPhone,
          utmSource: utmSource || "direct",
        }),
      });

      if (response.ok) {
        setFunnelStep("success");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const analysisMessages = [
    "Querying current Auckland property valuation indexes...",
    "Correlating localized sales history & zoning regulations...",
    "Compiling comparative market intelligence model..."
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-2xl tracking-wide font-semibold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
              NZMarie
            </span>
            <span className="h-5 w-[1px] bg-white/20 hidden sm:block" />
            <span className="text-xs uppercase tracking-widest text-slate-400 font-medium hidden sm:block">
              Marie Nian | Licensed Real Estate Consultant
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <a 
              href="tel:021000000" 
              className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors"
            >
              <Phone className="w-4 h-4 text-amber-500" />
              <span>Call Marie</span>
            </a>
            <Link 
              href="/#contact"
              className="px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-white"
            >
              Contact
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-[90vh] flex items-center pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/north_shore_house.png"
            alt="Classic North Shore Standalone Family House with Large Yard at Twilight"
            fill
            priority
            className="object-cover object-center lg:object-right opacity-80 brightness-[0.85] contrast-[1.05] saturate-[1.1]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-transparent hidden md:block" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/80 to-slate-950 md:hidden" />
        </div>

        <div className="container mx-auto max-w-6xl z-10 text-center md:text-left relative w-full">
          <div className="max-w-2xl md:max-w-xl lg:max-w-2xl mx-auto md:mx-0 flex flex-col items-center md:items-start text-center md:text-left">
            <AnimatePresence mode="wait">
              {funnelStep === "input" && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.6 }}
                  className="w-full flex flex-col items-center md:items-start text-center md:text-left"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-medium uppercase tracking-widest mb-6">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Licensed Residential Sales{" "}
                      <span style={{ fontSize: "0.8em", fontWeight: 400, opacity: 0.8 }}>(REAA 2008)</span>
                    </span>
                  </div>

                  <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1] max-w-3xl">
                    Data-Driven.
                    <br />
                    <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                      Unlock the True Value of Your Standalone House.
                    </span>
                  </h1>

                  <p className="text-base sm:text-lg text-slate-300 max-w-2xl mb-10 font-light leading-relaxed">
                    Combine 10 years of financial markets data with deep local economics expertise to maximize capital growth for your family home.
                  </p>

                  <form onSubmit={handleStartAnalysis} className="w-full max-w-2xl relative mb-12" ref={dropdownRef}>
                    <div className="flex flex-col sm:flex-row items-stretch gap-3 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-white/10 shadow-2xl focus-within:border-amber-400/50 transition-colors">
                      <div className="relative flex-1 flex items-center min-h-[50px] px-3">
                        <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
                        <input
                          type="text"
                          placeholder="Enter your family home address in Auckland..."
                          value={addressQuery}
                          onChange={(e) => {
                            setAddressQuery(e.target.value);
                            setSelectedAddress(null);
                          }}
                          onFocus={() => {
                            if (suggestions.length > 0) setShowDropdown(true);
                          }}
                          className="bg-transparent text-white border-0 outline-none w-full placeholder:text-slate-500 text-base"
                          required
                        />
                        {isSearching && (
                          <Loader2 className="w-5 h-5 animate-spin text-amber-500 shrink-0 ml-2" />
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={!addressQuery.trim()}
                        className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold uppercase tracking-wider text-xs transition-all shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span>Analyze Value</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    {showDropdown && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden shadow-2xl z-30 text-left">
                        {suggestions.map((item) => (
                          <button
                            key={item.place_id}
                            type="button"
                            onClick={() => handleSelectAddress(item.display_name)}
                            className="w-full px-5 py-4 hover:bg-white/5 border-b border-white/5 text-slate-300 hover:text-white transition-colors text-sm flex items-center gap-3 text-left"
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <span className="truncate">{item.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl pt-6 border-t border-white/10">
                    <div className="flex items-center justify-center md:justify-start gap-4">
                      <GraduationCap className="w-8 h-8 text-amber-500 shrink-0" />
                      <div className="text-left">
                        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Advanced Degrees</p>
                        <p className="text-sm font-serif font-bold text-slate-200">MA in Economics</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-4">
                      <TrendingUp className="w-8 h-8 text-amber-500 shrink-0" />
                      <div className="text-left">
                        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Financial Acumen</p>
                        <p className="text-sm font-serif font-bold text-slate-200">10+ Years Markets</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-4">
                      <Award className="w-8 h-8 text-amber-500 shrink-0" />
                      <div className="text-left">
                        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Licensed Experts</p>
                        <p className="text-sm font-serif font-bold text-slate-200">Barfoot & Thompson</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {funnelStep === "analyzing" && (
                <motion.div
                  key="analyzing-step"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-md mx-auto md:mx-0 p-10 rounded-3xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-2xl flex flex-col items-center"
                >
                  <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 rounded-full border-4 border-amber-500/10" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 animate-spin" />
                  </div>

                  <h3 className="font-serif text-xl font-semibold mb-4 text-amber-400">
                    Analyzing Valuation Model
                  </h3>

                  <div className="h-6 overflow-hidden w-full relative">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={analysisStep}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm text-slate-400 text-center w-full"
                      >
                        {analysisMessages[analysisStep]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {funnelStep === "lead" && (
                <motion.div
                  key="lead-step"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.5 }}
                  className="w-full max-w-lg mx-auto md:mx-0 p-8 sm:p-10 rounded-3xl bg-slate-900/90 backdrop-blur-md border border-white/10 shadow-2xl text-left"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-white">Appraisal Prepared</h3>
                      <p className="text-xs text-slate-400 mt-1">Ready to compile for your address</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 mb-6 text-sm text-slate-300">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Target Address</p>
                    <p className="font-medium text-white truncate">{selectedAddress || addressQuery}</p>
                  </div>

                  <form onSubmit={handleLeadSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Your Name</label>
                      <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:border-amber-400/50 transition-colors px-3 min-h-[50px]">
                        <User className="w-4 h-4 text-slate-400 mr-2.5" />
                        <input
                          type="text"
                          required
                          value={leadName}
                          onChange={(e) => setLeadName(e.target.value)}
                          placeholder="John Doe"
                          className="bg-transparent border-0 outline-none text-white w-full placeholder:text-slate-600 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Email Address</label>
                        <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:border-amber-400/50 transition-colors px-3 min-h-[50px]">
                          <Mail className="w-4 h-4 text-slate-400 mr-2.5" />
                          <input
                            type="email"
                            required
                            value={leadEmail}
                            onChange={(e) => setLeadEmail(e.target.value)}
                            placeholder="john@example.co.nz"
                            className="bg-transparent border-0 outline-none text-white w-full placeholder:text-slate-600 text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Phone Number</label>
                        <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:border-amber-400/50 transition-colors px-3 min-h-[50px]">
                          <Phone className="w-4 h-4 text-slate-400 mr-2.5" />
                          <input
                            type="tel"
                            value={leadPhone}
                            onChange={(e) => setLeadPhone(e.target.value)}
                            placeholder="021 234 567"
                            className="bg-transparent border-0 outline-none text-white w-full placeholder:text-slate-600 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 mt-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Get Free Analysis Report</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 pt-6 border-t border-white/5 flex items-center gap-3 text-xs text-slate-500">
                    <Lock className="w-4 h-4 shrink-0 text-slate-600" />
                    <p>Your details are secured. I will construct a tailored report. No unsolicited spam.</p>
                  </div>
                </motion.div>
              )}

              {funnelStep === "success" && (
                <motion.div
                  key="success-step"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-md mx-auto md:mx-0 p-10 rounded-3xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-2xl flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                    <CheckCircle className="w-8 h-8" />
                  </div>

                  <h3 className="font-serif text-2xl font-bold mb-3 text-white">
                    Report Requested!
                  </h3>

                  <p className="text-sm text-slate-400 text-center mb-8 leading-relaxed">
                    Thank you, {leadName}. Your custom real estate appraisal for <strong className="text-white">{selectedAddress || addressQuery}</strong> is being formulated. I will email the report within 24 hours.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setAddressQuery("");
                      setSelectedAddress(null);
                      setLeadName("");
                      setLeadEmail("");
                      setLeadPhone("");
                      setFunnelStep("input");
                    }}
                    className="px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs font-semibold uppercase tracking-wider text-slate-300"
                  >
                    Analyze Another Address
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      <section className="bg-white text-slate-900 py-24 px-6 border-t border-slate-100">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Why a Financial Approach to Real Estate?
            </h2>
            <p className="text-base text-slate-600 font-light">
              Traditional brokers focus on marketing listings. I treat your home as a high-value asset class, maximizing financial yields through analytical positioning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
            <div className="flex flex-col items-start p-6 sm:p-8 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all">
              <div className="flex items-center gap-4 mb-4 sm:mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-semibold shrink-0">
                  <Percent className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900">Macro Data Analysis</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-light">
                Directly correlating monetary policies, Reserve Bank OCR decisions, and systemic market shifts with Auckland property cycle performance.
              </p>
            </div>

            <div className="flex flex-col items-start p-6 sm:p-8 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all">
              <div className="flex items-center gap-4 mb-4 sm:mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-semibold shrink-0">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900">Hidden Value Extraction</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-light">
                Analyzing development zoning potential, school zones value multipliers, and tax structure optimization to locate your property&apos;s hidden premium.
              </p>
            </div>

            <div className="flex flex-col items-start p-6 sm:p-8 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all">
              <div className="flex items-center gap-4 mb-4 sm:mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-semibold shrink-0">
                  <Scale className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900">Elite Negotiation</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-light">
                Leveraging institutional-grade securities negotiation expertise to represent your pricing goals with composure, clarity, and authority.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400 py-16 px-6 border-t border-white/5 mt-auto">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 pb-12 border-b border-white/5">
            <div>
              <p className="font-serif text-xl font-semibold text-white">Marie Nian</p>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Licensed Real Estate Consultant</p>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/#about" className="hover:text-white transition-colors">About</Link>
              <Link href="/#service" className="hover:text-white transition-colors">Services</Link>
              <Link href="/#properties" className="hover:text-white transition-colors">Properties</Link>
              <Link href="/#contact" className="hover:text-white transition-colors">Contact</Link>
            </div>
          </div>

          <div className="space-y-4 text-xs text-slate-600 font-light leading-relaxed">
            <p>
              Disclaimer: The analysis and calculations presented by this appraisal tool are computed estimates based on general statistical market parameters and public domain index inputs. They do not constitute formal legal appraisals, bank valuation reports, or financial/investment advisory services. All transactions should be backed by formal valuation audits.
            </p>
            <p>
              Marie Nian is a Licensed Real Estate Salesperson under the Real Estate Agents Act 2008 (REAA 2008). Affiliated with Barfoot & Thompson Ltd.
            </p>
            <p className="pt-4 text-slate-700">
              © {new Date().getFullYear()} NZ Marie Real Estate. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HousePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    }>
      <HousePageContent />
    </Suspense>
  );
}
