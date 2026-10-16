"use client";

import React, { useState, useEffect, useRef } from "react";
import { translations, Language } from "../lib/translations";
import {
  findLocationBySuburb,
  getCitiesByRegion,
  getSuburbsByCity,
  type Region,
} from "../lib/geo-data";
import { useGooglePlacesAutocomplete } from "@/hooks/useGooglePlacesAutocomplete";

function detectLocationFromAddress(address: string) {
  const segments = address
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const location = findLocationBySuburb(segment);
    if (location) {
      return location;
    }
  }

  return null;
}

interface AppraisalFormData {
  name: string;
  address: string;
  region: Region;
  city: string;
  suburb: string;
  email: string;
  phone: string;
  timeline: string;
  motivation: string;
  languagePreference: string;
  heardFrom: string;
}

export default function AppraisalSection({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].appraisal;
  const defaultRegion: Region = "Auckland";
  const defaultCity = getCitiesByRegion(defaultRegion)[0] ?? "";
  const [formData, setFormData] = useState<AppraisalFormData>({
    name: "",
    address: "",
    region: defaultRegion,
    city: defaultCity,
    suburb: "",
    email: "",
    phone: "",
    timeline: "",
    motivation: "",
    languagePreference: "",
    heardFrom: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [step, setStep] = useState<1 | 2>(1);
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const availableCities = getCitiesByRegion(formData.region);
  const availableSuburbs = getSuburbsByCity(formData.city);

  // Use Google Places Autocomplete hook
  const {
    suggestions: googleSuggestions,
    isLoading: isSearching,
    selectSuggestion,
    clearSuggestions,
  } = useGooglePlacesAutocomplete(formData.address);

  // Convert Google predictions to string array for display
  const suggestions = googleSuggestions.map((pred) => pred.description);
  const showSuggestions = suggestions.length > 0;
  const noResults = formData.address.length >= 3 && !isSearching && suggestions.length === 0;

  useEffect(() => {
    if (!availableCities.includes(formData.city)) {
      setFormData((prev) => ({
        ...prev,
        city: availableCities[0] ?? "",
        suburb: "",
      }));
    }
  }, [availableCities, formData.city]);

  useEffect(() => {
    if (formData.suburb && !availableSuburbs.includes(formData.suburb)) {
      setFormData((prev) => ({
        ...prev,
        suburb: "",
      }));
    }
  }, [availableSuburbs, formData.suburb]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        clearSuggestions();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [clearSuggestions]);

  const handleAddressChange = (value: string) => {
    setFormData((prev) => ({ ...prev, address: value }));
    setIsAddressSelected(false);
  };

  const handleSelectSuggestion = async (index: number) => {
    const prediction = googleSuggestions[index];
    if (!prediction) return;

    const placeId = prediction.place_id;

    // Get full place details from Google
    const parsedAddress = await selectSuggestion(placeId);
    
    if (!parsedAddress) {
      console.error('Failed to get place details');
      return;
    }

    // Use parsed Google data first, fallback to local geo-data
    let detectedSuburb = parsedAddress.suburb;
    let detectedCity = parsedAddress.city;
    let detectedRegion = formData.region;

    // Try to find region from local data if suburb is known
    if (detectedSuburb) {
      const location = findLocationBySuburb(detectedSuburb);
      if (location) {
        detectedRegion = location.region;
        // Override with local data if available for consistency
        detectedCity = location.city;
      }
    }

    // Fallback: try to extract from address parts
    if (!detectedSuburb || !detectedCity) {
      const addressParts = parsedAddress.fullAddress.split(",").map((s) => s.trim());
      for (const part of addressParts) {
        const location = findLocationBySuburb(part);
        if (location) {
          detectedSuburb = detectedSuburb || location.suburb;
          detectedCity = detectedCity || location.city;
          detectedRegion = detectedRegion || location.region;
          break;
        }
      }
    }
    
    setFormData((prev) => ({ 
      ...prev, 
      address: parsedAddress.fullAddress,
      suburb: detectedSuburb,
      city: detectedCity,
      region: detectedRegion,
    }));
    setIsAddressSelected(true);
    clearSuggestions();
  };

  useEffect(() => {
    if (isAddressSelected) {
      setStep(2);
    }
  }, [isAddressSelected]);

  const canProceedToStep2 = isAddressSelected || Boolean(detectLocationFromAddress(formData.address));

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address.trim()) return;

    if (isAddressSelected) {
      setStep(2);
      return;
    }

    const detectedLocation = detectLocationFromAddress(formData.address);
    if (detectedLocation) {
      setFormData((prev) => ({
        ...prev,
        region: detectedLocation.region,
        city: detectedLocation.city,
        suburb: detectedLocation.suburb,
      }));
      setIsAddressSelected(true);
      setStep(2);
    }
  };

  const handleEditAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStep(1);
    setIsAddressSelected(false);
    clearSuggestions();
    setTimeout(() => {
      const inputElement = addressInputRef.current;
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
      }
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/appraisal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setStatus("success");
        setFormData({ 
          name: "", 
          address: "", 
          region: defaultRegion,
          city: defaultCity,
          suburb: "", 
          email: "", 
          phone: "", 
          timeline: "", 
          motivation: "", 
          languagePreference: "", 
          heardFrom: "" 
        });
        setIsAddressSelected(false);
        setStep(1);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="py-20 bg-slate-50 border-t border-b border-gray-100" id="appraisal">
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <span className="text-blue-600 font-semibold capitalize tracking-wider text-sm">
          {lang === "en" ? "Free Property Appraisal" : "免费房产评估"}
        </span>
        <h2 className="text-4xl font-bold text-slate-900 mt-2 mb-6">
          {t.title}
        </h2>
        <p className="text-base text-slate-600 max-w-xl mx-auto mb-12 leading-relaxed px-4">
          {t.subtitle}
        </p>

        <div className="max-w-3xl mx-auto mb-20 relative">
          <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-100 transition-all duration-500">
            {step === 1 ? (
              <form onSubmit={handleNextStep} className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row items-stretch gap-4">
                  <div className="w-full relative" ref={wrapperRef}>
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">📍</span>
                    <input
                      ref={addressInputRef}
                      type="text"
                      required
                      autoComplete="off"
                      value={formData.address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      className={`w-full pl-12 pr-10 py-4 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent transition duration-200 text-lg shadow-inner bg-slate-50 ${
                        isAddressSelected 
                          ? "border-green-300 focus:ring-2 focus:ring-green-500"
                          : noResults 
                          ? "border-amber-300 focus:ring-2 focus:ring-amber-500"
                          : "border-gray-200 focus:ring-2 focus:ring-blue-500"
                      }`}
                      placeholder={t.addressPlaceholder}
                    />
                    {isAddressSelected && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 text-lg select-none font-bold">
                        ✓
                      </span>
                    )}
                    {!isAddressSelected && isSearching && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 text-lg select-none">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      </span>
                    )}
                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border-2 border-blue-300 overflow-hidden text-left">
                        <li className="px-5 py-2 bg-blue-50 text-xs font-semibold text-blue-700 border-b border-blue-200">
                          {lang === "en" ? "📍 Select an address:" : "📍 选择一个地址："}
                        </li>
                        {suggestions.map((s, i) => (
                          <li
                            key={i}
                            onMouseDown={() => handleSelectSuggestion(i)}
                            className="px-5 py-3 text-sm text-slate-700 hover:bg-blue-100 cursor-pointer border-b border-slate-100 last:border-0 transition-colors duration-150 font-medium"
                          >
                            <span className="mr-2 text-blue-500">📍</span>{s}
                          </li>
                        ))}
                      </ul>
                    )}
                    {noResults && !isSearching && formData.address.length >= 3 && (
                      <ul className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-amber-100 overflow-hidden text-left">
                        <li className="px-5 py-4 text-sm text-slate-500">
                          <span className="mr-2">💡</span>
                          {lang === "en"
                            ? 'No NZ addresses found. Try including the street name, e.g. "12 Queen Street, Albany"'
                            : '未找到地址，请包含街道名称，如"12 Queen Street, Albany"'}
                        </li>
                      </ul>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!canProceedToStep2}
                    className={`w-full md:w-auto px-8 py-4 font-bold rounded-xl transition-all duration-300 whitespace-nowrap text-lg ${
                      canProceedToStep2
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl cursor-pointer"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {lang === "en" ? "Book Appraisal" : "预约评估"}
                  </button>
                </div>
                <p className={`text-xs text-left pl-1 transition-colors ${
                  isAddressSelected ? "text-slate-400" : "text-amber-600 font-medium"
                }`}>
                  {isAddressSelected 
                    ? (lang === "en"
                      ? 'Great! Click the button above to continue.'
                      : '很好！点击上面的按钮继续。')
                    : (lang === "en"
                      ? '⬆️ Please select an address from the suggestions above'
                      : '⬆️ 请从上面的建议中选择一个地址')}
                </p>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                  <div>
                    <p className="text-sm text-gray-500">{lang === "en" ? "Property Address:" : "房产地址："}</p>
                    <p className="font-semibold text-gray-900">{formData.address}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleEditAddress} 
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer px-2 py-1 rounded hover:bg-blue-50 font-medium"
                  >
                    {lang === "en" ? "Edit Address" : "修改地址"}
                  </button>
                </div>

                <p className="text-slate-700 font-medium mb-4">
                  {lang === "en"
                    ? "Great address! Help Marie fine-tune your free appraisal by sharing a few details."
                    : "太棒了！请填写以下信息，帮助 Marie 优化您的免费评估。"}
                </p>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-medium text-slate-600 mb-4">{t.reviewLocation}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label htmlFor="appraisal-region" className="block text-sm font-semibold text-gray-700 mb-2">
                        {t.region} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="appraisal-region"
                        required
                        value={formData.region}
                        onChange={(e) => {
                          const nextRegion = e.target.value as Region;
                          const nextCities = getCitiesByRegion(nextRegion);
                          setFormData((prev) => ({
                            ...prev,
                            region: nextRegion,
                            city: nextCities[0] ?? "",
                            suburb: "",
                          }));
                        }}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                      >
                        <option value="" disabled>{t.regionPlaceholder}</option>
                        {["Auckland", "Wellington"].map((region) => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="appraisal-city" className="block text-sm font-semibold text-gray-700 mb-2">
                        {t.city} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="appraisal-city"
                        required
                        value={formData.city}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            city: e.target.value,
                            suburb: "",
                          }))
                        }
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                      >
                        <option value="" disabled>{t.cityPlaceholder}</option>
                        {availableCities.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="appraisal-suburb" className="block text-sm font-semibold text-gray-700 mb-2">
                        {t.suburb} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="appraisal-suburb"
                        required
                        value={formData.suburb}
                        onChange={(e) => setFormData((prev) => ({ ...prev, suburb: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                      >
                        <option value="">{t.suburbPlaceholder}</option>
                        {availableSuburbs.map((suburb) => (
                          <option key={suburb} value={suburb}>{suburb}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label htmlFor="appraisal-name" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.fullName} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="appraisal-name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-4 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="appraisal-email" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.email} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="appraisal-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-4 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label htmlFor="appraisal-phone" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.phone} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="appraisal-phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-4 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="e.g. +64 21 000 0000"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="appraisal-timeline" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.timeline} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="appraisal-timeline"
                      required
                      value={formData.timeline}
                      onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                    >
                      <option value="">{t.timelineOptions.placeholder}</option>
                      <option value="within-3-months">{t.timelineOptions.within3}</option>
                      <option value="3-6-months">{t.timelineOptions.months3to6}</option>
                      <option value="6-12-months">{t.timelineOptions.months6to12}</option>
                      <option value="just-exploring">{t.timelineOptions.exploring}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label htmlFor="appraisal-motivation" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.motivation} <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="appraisal-motivation"
                      required
                      value={formData.motivation}
                      onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                    >
                      <option value="">{t.motivationOptions.placeholder}</option>
                      <option value="upsizing">{t.motivationOptions.upsizing}</option>
                      <option value="downsizing">{t.motivationOptions.downsizing}</option>
                      <option value="investment">{t.motivationOptions.investment}</option>
                      <option value="relocating">{t.motivationOptions.relocating}</option>
                      <option value="estate">{t.motivationOptions.estate}</option>
                      <option value="other">{t.motivationOptions.other}</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label htmlFor="appraisal-language-preference" className="block text-sm font-semibold text-gray-700 mb-2">
                      {t.languagePreference}
                    </label>
                    <select
                      id="appraisal-language-preference"
                      value={formData.languagePreference}
                      onChange={(e) => setFormData({ ...formData, languagePreference: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                    >
                      <option value="">{t.languageOptions.none}</option>
                      <option value="en">{t.languageOptions.en}</option>
                      <option value="zh">{t.languageOptions.zh}</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label htmlFor="appraisal-heard-from" className="block text-sm font-semibold text-gray-700 mb-2">
                    {t.heardFrom}
                  </label>
                  <select
                    id="appraisal-heard-from"
                    value={formData.heardFrom}
                    onChange={(e) => setFormData({ ...formData, heardFrom: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition duration-200"
                  >
                    <option value="">{t.heardFromOptions.placeholder}</option>
                    <option value="google">{t.heardFromOptions.google}</option>
                    <option value="wechat">{t.heardFromOptions.wechat}</option>
                    <option value="referral">{t.heardFromOptions.referral}</option>
                    <option value="facebook">{t.heardFromOptions.facebook}</option>
                    <option value="other">{t.heardFromOptions.other}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={status === "loading" || !formData.suburb}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 text-center"
                >
                  {status === "loading" ? "..." : t.submit}
                </button>

                {status === "error" && (
                  <p className="text-red-500 text-sm text-center font-medium mt-2">{t.error}</p>
                )}
              </form>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-16">
          <h3 className="text-2xl font-serif italic text-slate-700 mb-10">
            {lang === "en" ? "What My Clients Say" : "客户评价"}
          </h3>

          <div className="bg-white rounded-2xl shadow-xl p-10 md:p-14 text-left relative overflow-hidden max-w-3xl mx-auto">
            <span className="absolute top-4 left-6 text-slate-100 text-9xl font-serif select-none pointer-events-none">
              &ldquo;
            </span>

            <div className="relative z-10 space-y-6 text-slate-700 leading-relaxed text-base md:text-lg">
              {lang === "en" ? (
                <>
                  <p>
                    &quot;I honestly couldn&apos;t have asked for a more <strong>responsible and forward-thinking agent</strong>. Her level of preparation and attention to detail was exceptional &ndash; she often considered things even more carefully than we did as owners.&quot;
                  </p>
                  <p>
                    &quot;She has a <strong>deep understanding of how business is done in New Zealand</strong>, where relationships and trust matter just as much as numbers. That made a huge difference throughout the process.&quot;
                  </p>
                  <p>
                    &quot;In what has been a very challenging <strong>property market</strong>, she achieved an <strong>outstanding result for our property</strong> &ndash; well beyond what we had hoped for.&quot;
                  </p>
                  <p>
                    &quot;She is honest, reliable, and incredibly professional. What truly stood out was her patience and kindness towards my children during contract negotiations. She made the whole process smooth and stress-free, even with kids around, which we deeply appreciated.&quot;
                  </p>
                  <p className="italic text-slate-600">
                    &quot;I would absolutely recommend her to anyone looking for an agent who genuinely cares and delivers results.&quot;
                  </p>
                </>
              ) : (
                <>
                  <p>
                    我非常满意 Marie 的专业与前瞻性。她的准备工作和对细节的关注非常出色——很多时候她比我们作为房主考虑得还更周到。
                  </p>
                  <p>
                    她深谙新西兰的商业运作，重视关系与信任，这一点在交易过程中带来了巨大的不同。
                  </p>
                  <p>
                    在这个充满挑战的房产市场中，她为我们的房产取得了非常出色的结果，远超我们的期望。
                  </p>
                  <p>
                    她诚实、可靠且极具专业性。尤其让我印象深刻的是她在合同谈判期间对孩子们的耐心与关怀，使整个过程在有孩子在场的情况下仍然顺利且无压力。
                  </p>
                  <p className="italic text-slate-600">
                    我会毫不犹豫地向任何寻求真诚且有实绩代理的人推荐她。
                  </p>
                </>
              )}

              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="block font-bold text-slate-900 text-lg">Molly K.</span>
                  <span className="text-xs text-slate-400 uppercase tracking-widest">Verified Homeowner</span>
                </div>
                <div className="flex text-amber-400 font-bold text-xl">★★★★★</div>
              </div>
            </div>
          </div>
        </div>

        {status === "success" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-gray-100 transform scale-100 transition-all duration-300">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{t.successTitle}</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">{t.successMessage}</p>
              <button
                onClick={() => setStatus("idle")}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 shadow-md"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
