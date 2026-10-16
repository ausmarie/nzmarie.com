"use client";

import React, { useState } from "react";
import Image from "next/image";
import { FaEnvelope, FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { translations, Language } from "../lib/translations";

const PROFILE_URL = 'https://www.barfoot.co.nz/our-people/m.nian';

export default function Contact({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].contact;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const contactLinks = [
    {
      label: t.email,
      href: "mailto:m.nian@barfoot.co.nz",
      Icon: FaEnvelope,
      target: "_self",
      detail: "m.nian@barfoot.co.nz",
      copyKey: "email",
    },
    {
      label: "Facebook",
      href: "https://www.facebook.com/nian.hong.10",
      Icon: FaFacebookF,
      target: "_blank",
    },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/nzmarie",
      Icon: FaLinkedinIn,
      target: "_blank",
    },
  ];

  const handleCopy = async (value: string, key: string) => {
    const propagateCopy = () => {
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 2000);
    };

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        propagateCopy();
        return;
      }
    } catch {
      setCopiedKey(null);
      return;
    }

    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "absolute";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    propagateCopy();
  };

  return (
    <section className="contact-area section-gap" id="contact">
      <div className="container mx-auto px-4">
        <div className="flex justify-center mb-16">
          <div className="text-center max-w-2xl">
            <h1 className="text-4xl font-bold mb-4 text-gray-800">
              {t.title}
            </h1>
            <p className="text-lg text-gray-600">
              {t.subtitle}
              <br />
              {t.motto}
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {contactLinks.map(({ label, href, Icon, target, detail, copyKey }) => (
              <React.Fragment key={label}>
                <div
                  className="flex flex-col items-center gap-3 bg-white shadow-md rounded-xl p-8 transition transform hover:-translate-y-1 hover:shadow-lg"
                >
                  <a
                    href={href}
                    target={target}
                    rel={target === "_blank" ? "noopener noreferrer" : undefined}
                    className="flex flex-col items-center gap-2"
                  >
                    <Icon className="text-4xl text-gray-800" />
                    <span className="text-lg font-semibold text-gray-700">{label}</span>
                  </a>
                  {detail && copyKey && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleCopy(detail, copyKey);
                      }}
                      className="text-sm text-gray-500 underline underline-offset-4"
                    >
                      {copiedKey === copyKey ? (lang === "zh" ? "已复制！" : "Copied!") : detail}
                    </button>
                  )}
                </div>
                {copyKey === "email" && (
                  <>
                    <div className="flex flex-col items-center gap-3 bg-white shadow-md rounded-xl p-8 transition transform hover:-translate-y-1 hover:shadow-lg">
                      <div className="flex flex-col items-center gap-2">
                        <Image
                          src="/Marie-Wechat.jpg"
                          alt={t.wechatQrAlt}
                          width={120}
                          height={120}
                          className="rounded-lg"
                        />
                        <span className="text-lg font-semibold text-gray-700">{t.wechat}</span>
                      </div>
                      <p className="text-sm text-gray-500">{t.wechatScanHint}</p>
                    </div>
                    <div className="flex flex-col items-center gap-3 bg-white shadow-md rounded-xl p-8 transition transform hover:-translate-y-1 hover:shadow-lg">
                      <a
                        href={PROFILE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2"
                      >
                        <span className="text-4xl">🏛️</span>
                        <span className="text-lg font-semibold text-gray-700">
                          {lang === "zh" ? "Marie 的 Barfoot 资料" : "Marie's Barfoot Profile"}
                        </span>
                      </a>
                    </div>
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
