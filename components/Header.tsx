"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { IconButton } from "@radix-ui/themes";
import { HamburgerMenuIcon, Cross2Icon } from "@radix-ui/react-icons";

import { translations, Language } from "../lib/translations";
import { parseMarketReportSlug } from "@/lib/market-report-url";

export default function Header({
  lang = "en",
  marketReportsHref,
}: {
  lang?: Language;
  marketReportsHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("home");
  const pathname = usePathname();
  const t = translations[lang].nav;
  const homeHref = lang === "zh" ? "/cn" : "/";
  const marketReportSlug = pathname?.match(/^\/market-reports\/([^/]+)(?:\/cn)?$/)?.[1];
  const marketReportsActive = pathname?.startsWith('/market-reports') ?? false;
  const langHref = marketReportSlug && parseMarketReportSlug(marketReportSlug)
    ? lang === "zh"
      ? `/market-reports/${marketReportSlug}`
      : `/market-reports/${marketReportSlug}/cn`
    : t.langLink;

  useEffect(() => {
    const sections = ["home", "about", "appraisal", "service", "properties", "contact"];
    const fromHash =
      typeof window !== "undefined"
        ? window.location.hash.replace("#", "")
        : "";
    if (sections.includes(fromHash)) setActiveSection(fromHash || "home");

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id;
          if (sections.includes(id)) setActiveSection(id);
        }
      },
      {
        root: null,
        rootMargin: "0px 0px -45% 0px",
        threshold: [0.2, 0.4, 0.6, 0.8],
      }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const linkCls = (id: string) =>
    `hover:text-blue-600 transition-colors duration-300 ${activeSection === id ? "text-blue-600 font-semibold" : "text-gray-700"
    }`;
  const marketReportsLinkCls =
    `hover:text-blue-600 transition-colors duration-300 ${marketReportsActive ? "text-blue-600 font-semibold" : "text-gray-700"}`;

  return (
    <header className="default-header sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between py-4">
          <Link href={homeHref} aria-label="Go to home" className="navbar-brand">
            <Image
              src="/img/nzmarie-logo.png"
              alt="Marie Nian | Residential Sales, Barfoot & Thompson"
              width={76}
              height={26}
              priority
              className="h-auto w-auto max-h-7"
            />
          </Link>

          <div className="hidden lg:flex items-center space-x-8 text-sm tracking-wider font-medium">
            <Link
              href={`${homeHref}#about`}
              className={linkCls("about")}
              onClick={() => setActiveSection("about")}
            >
              {t.about}
            </Link>
            <Link
              href={`${homeHref}#appraisal`}
              className={`font-bold hover:text-blue-600 transition-colors duration-300 ${activeSection === "appraisal" || activeSection === "service" ? "text-blue-600" : "text-gray-700"}`}
              onClick={() => setActiveSection("appraisal")}
            >
              {t.service}
            </Link>
            <Link
              href={marketReportsHref ?? `/market-reports?lang=${lang}`}
              className={marketReportsLinkCls}
            >
              {t.marketReports}
            </Link>
            <Link
              href={`${homeHref}#properties`}
              className={linkCls("properties")}
              onClick={() => setActiveSection("properties")}
            >
              {t.properties}
            </Link>
            <Link
              href={`${homeHref}#contact`}
              className={linkCls("contact")}
              onClick={() => setActiveSection("contact")}
            >
              {t.contact}
            </Link>
            <Link
              href={langHref}
              className="ml-4 px-3 py-1 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300 font-semibold"
            >
              {t.langToggle}
            </Link>
          </div>

          <div className="lg:hidden flex items-center gap-4">
            <Link
              href={langHref}
              className="px-2 py-1 text-xs rounded-full border border-blue-600 text-blue-600 font-semibold"
            >
              {t.langToggle}
            </Link>
            <IconButton
              variant="ghost"
              aria-label="Toggle menu"
              onClick={() => setOpen((s) => !s)}
              title="Toggle menu"
              className="text-gray-700 hover:text-blue-600"
            >
              {open ? <Cross2Icon /> : <HamburgerMenuIcon />}
            </IconButton>
          </div>
        </nav>
      </div>

      {open && (
        <div className="lg:hidden border-t border-gray-200 bg-white/95">
          <div className="container mx-auto px-4 py-4 flex flex-col space-y-4 font-medium text-sm tracking-wide">
            <Link
              href={`${homeHref}#about`}
              onClick={() => {
                setActiveSection("about");
                setOpen(false);
              }}
              className={linkCls("about")}
            >
              {t.about}
            </Link>
            <Link
              href={`${homeHref}#appraisal`}
              onClick={() => {
                setActiveSection("appraisal");
                setOpen(false);
              }}
              className={`font-bold hover:text-blue-600 transition-colors duration-300 ${activeSection === "appraisal" || activeSection === "service" ? "text-blue-600" : "text-gray-700"}`}
            >
              {t.service}
            </Link>
            <Link
              href={marketReportsHref ?? `/market-reports?lang=${lang}`}
              onClick={() => setOpen(false)}
              className={marketReportsLinkCls}
            >
              {t.marketReports}
            </Link>
            <Link
              href={`${homeHref}#properties`}
              onClick={() => {
                setActiveSection("properties");
                setOpen(false);
              }}
              className={linkCls("properties")}
            >
              {t.properties}
            </Link>
            <Link
              href={`${homeHref}#contact`}
              onClick={() => {
                setActiveSection("contact");
                setOpen(false);
              }}
              className={linkCls("contact")}
            >
              {t.contact}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
