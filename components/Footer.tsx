"use client";

import React, { useState } from "react";
import Image from "next/image";
import { FaEnvelope, FaFacebookF, FaLinkedinIn, FaPhone } from "react-icons/fa";
import WeChatIcon from "./WeChatIcon";
import { translations, Language } from "../lib/translations";

export default function Footer({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].footer;
  const PROFILE_URL = 'https://www.barfoot.co.nz/our-people/m.nian';
  const [showWechatQr, setShowWechatQr] = useState(false);

  const renderAboutTextWithLink = (text: string) => {
    // Preserve newlines and replace Barfoot & Thompson with a safe external link
    const lines = text.split('\n');
    return (
      <>
        {lines.map((line, i) => (
          <span key={i}>
            {line.includes('Barfoot & Thompson') ? (
              <>
                {line.split('Barfoot & Thompson')[0]}
                <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
                  Barfoot &amp; Thompson
                </a>
                {line.split('Barfoot & Thompson')[1]}
              </>
            ) : (
              line
            )}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </>
    );
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-screen-xl py-12 lg:py-16">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-16 mb-10 pb-10 border-b border-gray-700">

          <div className="sm:col-span-2 lg:col-span-1">
            <h6 className="text-lg font-bold mb-3 tracking-wide">{t.aboutTitle}</h6>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              {renderAboutTextWithLink(t.aboutText)}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              {t.license}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mt-2">
                <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
                  Marie&apos;s Barfoot Profile
                </a>
            </p>
          </div>

          <div>
            <h6 className="text-lg font-bold mb-3 tracking-wide">{lang === 'zh' ? '联系方式' : 'Contact'}</h6>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-center gap-3">
                <FaPhone className="text-blue-400 shrink-0" />
                <a href="tel:+6421069308" className="hover:text-white transition-colors">
                  (+64) 21 069 3089
                </a>
              </li>
              <li className="flex items-center gap-3">
                <FaEnvelope className="text-blue-400 shrink-0" />
                <a href="mailto:m.nian@barfoot.co.nz" className="hover:text-white transition-colors break-all">
                  m.nian@barfoot.co.nz
                </a>
              </li>
            </ul>
            <p className="mt-3 flex items-center gap-3 text-sm text-gray-300">
              <WeChatIcon className="w-5 h-5 text-green-400 shrink-0" />
              <span>{t.wechat}: {t.wechatNumber}</span>
            </p>
            <p className="mt-3 flex items-center gap-3 text-sm text-gray-300">
              <span className="text-blue-400">🏛️</span>
              {lang === 'zh' ? (
                <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white underline">
                  Marie 的 Barfoot 个人资料
                </a>
              ) : (
                <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white underline">
                  Marie&apos;s Barfoot Profile
                </a>
              )}
            </p>
          </div>

          <div>
            <h6 className="text-lg font-bold mb-3 tracking-wide">{t.followTitle}</h6>
            <p className="text-gray-400 text-sm mb-4">{t.socialText}</p>
            <div className="flex gap-3">
              <a
                href="mailto:m.nian@barfoot.co.nz"
                aria-label="Email"
                className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors duration-300"
              >
                <FaEnvelope className="text-white text-base" />
              </a>
              <button
                type="button"
                aria-label="WeChat"
                onClick={() => setShowWechatQr(!showWechatQr)}
                className="w-10 h-10 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center transition-colors duration-300"
              >
                <WeChatIcon className="w-5 h-5 text-white" />
              </button>
              <a
                href="https://www.facebook.com/nian.hong.10"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors duration-300"
              >
                <FaFacebookF className="text-white text-base" />
              </a>
              <a
                href="https://www.linkedin.com/in/nzmarie"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="w-10 h-10 rounded-full bg-blue-700 hover:bg-blue-800 flex items-center justify-center transition-colors duration-300"
              >
                <FaLinkedinIn className="text-white text-base" />
              </a>
            </div>
            {showWechatQr && (
              <div className="mt-4 flex justify-center">
                <div className="bg-white rounded-xl p-4 shadow-lg">
                  <Image
                    src="/Marie-Wechat.jpg"
                    alt={t.wechatQrAlt}
                    width={150}
                    height={150}
                    className="rounded-lg"
                  />
                  <p className="text-center text-xs text-gray-500 mt-2">{t.wechatScanHint}</p>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-gray-500">
          <span>
            {t.copyright.replace("{year}", new Date().getFullYear().toString())}
          </span>
          <span className="hidden sm:inline text-gray-600">|</span>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-300 underline underline-offset-2 transition-colors"
          >
            Privacy Policy
          </a>
        </div>

      </div>
    </footer>
  );
}
