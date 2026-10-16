"use client";

import React from "react";

import { translations, Language } from "../lib/translations";

export default function Services({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].services;
  const services = t.items.map((item, index) => ({
    ...item,
    icon: ["👤", "🏠", "💎", "🚀", "📞", "💬"][index] || "✨",
  }));

  return (
    <section className="feature-area py-16 md:py-20" id="service">
      <div className="container mx-auto px-4">
        <div className="flex justify-center mb-16">
          <div className="text-center max-w-4xl">
            <h1 className="text-4xl font-bold mb-6 text-gray-800">
              {t.title}
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div key={index} className="single-feature">
              <div className="title flex items-start gap-4 mb-5">
                <span className="text-3xl">{service.icon}</span>
                <h4 className="text-xl font-semibold text-gray-800">
                  <span
                    className="hover:text-blue-600 transition-colors duration-300"
                  >
                    {service.title}
                  </span>
                </h4>
              </div>
              <p className="text-gray-600 leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
