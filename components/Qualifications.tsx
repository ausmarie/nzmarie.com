"use client";

import React from "react";

import { translations, Language } from "../lib/translations";

export default function Qualifications({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].qualifications;

  return (
    <section className="qualification-area py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="flex justify-center mb-16">
          <div className="text-center max-w-2xl">
            <h1 className="text-4xl font-bold mb-4 text-gray-800">
              {t.title}
            </h1>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="max-w-6xl w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Left side - Work Experience */}
              <div className="qty-left">
                <div className="single-qly mb-8">
                  <h3 className="text-2xl font-bold text-gray-800 uppercase mb-2">
                    {t.huatai.title}
                  </h3>
                  <p className="text-blue-600 font-semibold mb-4">
                    {t.huatai.period}
                  </p>
                  <h4 className="text-xl font-semibold text-gray-700 mb-4">
                    {t.huatai.company}
                  </h4>
                  <p className="text-gray-600 leading-relaxed">
                    {t.huatai.desc}
                  </p>
                </div>

                <div className="btm-border mx-auto mb-8 w-16 h-1 bg-gradient-to-r from-blue-500 to-blue-700"></div>

                <div className="single-qly">
                  {/* Add additional work experience if needed */}
                </div>
              </div>

              {/* Right side - Education */}
              <div className="qty-right">
                <div className="single-qly mb-8">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">
                    {t.realestate.title}
                  </h4>
                  <p className="text-blue-600 font-semibold mb-2">
                    {t.realestate.period}
                  </p>
                  <p className="text-gray-700 font-medium">
                    {t.realestate.org}
                  </p>
                </div>

                <div className="btm-border mx-auto mb-8 w-16 h-1 bg-gradient-to-r from-blue-500 to-blue-700"></div>

                <div className="single-qly">
                  <h4 className="text-xl font-semibold text-gray-800 mb-4">
                    {t.economics.title}
                  </h4>
                  <p className="text-blue-600 font-semibold mb-2">
                    {t.economics.period}
                  </p>
                  <p className="text-gray-700 font-medium">
                    {t.economics.org}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
