"use client";

import React from "react";
import Image from "next/image";
import WeChatIcon from "./WeChatIcon";

import { translations, Language } from "../lib/translations";

const PROFILE_URL = 'https://www.barfoot.co.nz/our-people/m.nian';

const formatLicense = (text: string) => {
  const agency = 'Barfoot & Thompson';
  const targets = ['(Under REAA 2008)', '(REAA 2008)'];

  let rendered: React.ReactNode = text;

  if (text.includes(agency)) {
    const [beforeAgency, afterAgency] = text.split(agency);
    let cleanedAfter = afterAgency;
    for (const target of targets) {
      cleanedAfter = cleanedAfter.replace(target, '');
    }
    rendered = (
      <>
        {beforeAgency}
        <a
          href={PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline' }}
        >
          {agency}
        </a>
        {cleanedAfter}
      </>
    );
  }

  for (const target of targets) {
    if (text.includes(target)) {
      const parts = text.split(target);
      return (
        <>
          {parts[0].includes(agency) ? rendered : parts[0]}
          <span style={{ fontSize: '0.78em', fontWeight: 400, opacity: 0.7 }}>{target}</span>
          {parts[1]}
        </>
      );
    }
  }

  return <>{rendered}</>;
};

export default function About({ lang = "en" }: { lang?: Language }) {
  const t = translations[lang].about;
  const skills = t.skills;

  return (
    <section className="about-area section-gap" id="about">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-screen-xl">

        <div className="text-center mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold mb-3 text-gray-800">
            {t.title}
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-xl mx-auto">
            {formatLicense(t.license)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 xl:gap-20 items-start max-w-6xl mx-auto">

          <div className="w-full order-2 md:order-1">
            <div className="space-y-5 mb-10 text-center md:text-left">
              <p className="text-gray-700 leading-relaxed text-base lg:text-lg">
                {t.p1}
              </p>
              <p className="text-gray-700 leading-relaxed text-base lg:text-lg">
                {t.p2}
              </p>
              <p className="text-lg lg:text-xl font-semibold text-gray-800 pt-4 border-t border-gray-100">
                {t.footer}
              </p>
            </div>

            <div className="max-w-lg mx-auto md:mx-0">
              <h4 className="text-xl lg:text-2xl font-bold mb-6 text-gray-800 text-center md:text-left">
                {t.experienceTitle}
              </h4>
              <div className="space-y-5">
                {skills.map((skill, index) => (
                  <div key={index} className="skillbar">
                    <div className="skill-bar-percent">{skill.name}</div>
                    <div className="skillwrap">
                      <div
                        className="skillbar-bar"
                        style={{ width: `${skill.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full flex justify-center md:justify-end order-1 md:order-2">
            <div className="myself-wrap bg-white rounded-2xl shadow-lg overflow-hidden w-full max-w-xs sm:max-w-sm md:max-w-full">
              <div className="relative">
                <Image
                  src="/img/about-img.jpg"
                  alt="Marie Nian - Licensed Residential Sales, Barfoot & Thompson"
                  width={480}
                  height={560}
                  className="w-full h-auto object-cover"
                />
              </div>

              <div className="desc p-5 sm:p-6 text-center md:text-left">
                <h4 className="text-xl sm:text-2xl font-bold mb-1 text-gray-800">
                  {t.name}
                </h4>
                <p className="text-gray-500 mb-4 text-sm leading-snug">
                  {formatLicense(t.license)}
                </p>
                <p className="text-gray-600 mb-4 text-sm font-medium">
                  {t.fluent}
                </p>

                <div className="contact-info space-y-2 mb-6 text-sm text-gray-700">
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-blue-600">📞</span>
                    (+64) 21 069 3089
                  </p>
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-blue-600">✉️</span>
                    m.nian@barfoot.co.nz
                  </p>
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <WeChatIcon className="w-5 h-5 text-green-600 shrink-0" />
                    {t.wechat}: {t.wechatNumber}
                  </p>
                  <p className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-blue-600">🏛️</span>
                    <a
                      href={PROFILE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-700 hover:underline truncate"
                      style={{ textDecoration: 'underline', color: 'inherit' }}
                    >
                      Marie&apos;s Barfoot Profile
                    </a>
                  </p>
                </div>

                <a
                  href="#contact"
                  className="talk-btn block text-center w-full"
                >
                  {t.contactBtn}
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
