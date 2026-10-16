"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { IconButton } from "@radix-ui/themes";
import { HamburgerMenuIcon, Cross2Icon } from "@radix-ui/react-icons";

import { translations, Language } from "../lib/translations";

export default function Header({ lang = "en" }: { lang?: Language }) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("home");
  const t = translations[lang].nav;

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

  return (
    <header className="default-header sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between py-4">
          <Link href="#home" aria-label="Go to home" className="navbar-brand">
            <Image
              src="/img/nzmarie-logo.png"
              alt="Marie Nian | Residential Sales, Barfoot & Thompson"
              width={120}
              height={40}
              priority
              className="h-auto w-auto max-h-10"
            />
          </Link>

          <div className="hidden lg:flex items-center space-x-8 text-sm uppercase tracking-wider font-medium">
            <Link
              href="#home"
              className={linkCls("home")}
              onClick={() => setActiveSection("home")}
            >
              {t.home}
            </Link>
            <Link
              href="#about"
              className={linkCls("about")}
              onClick={() => setActiveSection("about")}
            >
              {t.about}
            </Link>
            <Link
              href="#appraisal"
              className={`hover:text-blue-600 transition-colors duration-300 ${activeSection === "appraisal" || activeSection === "service" ? "text-blue-600 font-semibold" : "text-gray-700"}`}
              onClick={() => setActiveSection("appraisal")}
            >
              {t.service}
            </Link>
            <Link
              href="#properties"
              className={linkCls("properties")}
              onClick={() => setActiveSection("properties")}
            >
              {t.properties}
            </Link>
            <Link
              href="#contact"
              className={linkCls("contact")}
              onClick={() => setActiveSection("contact")}
            >
              {t.contact}
            </Link>
            <Link
              href={t.blogLink}
              className="hover:text-blue-600 transition-colors duration-300 text-gray-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.blog}
            </Link>
            <Link
              href={t.langLink}
              className="ml-4 px-3 py-1 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300 font-semibold"
            >
              {t.langToggle}
            </Link>
          </div>

          <div className="lg:hidden flex items-center gap-4">
            <Link
              href={t.langLink}
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
          <div className="container mx-auto px-4 py-4 flex flex-col space-y-4 font-medium uppercase text-sm tracking-wide">
            <Link
              href="#home"
              onClick={() => {
                setActiveSection("home");
                setOpen(false);
              }}
              className={linkCls("home")}
            >
              {t.home}
            </Link>
            <Link
              href="#about"
              onClick={() => {
                setActiveSection("about");
                setOpen(false);
              }}
              className={linkCls("about")}
            >
              {t.about}
            </Link>
            <Link
              href="#appraisal"
              onClick={() => {
                setActiveSection("appraisal");
                setOpen(false);
              }}
              className={`hover:text-blue-600 transition-colors duration-300 ${activeSection === "appraisal" || activeSection === "service" ? "text-blue-600 font-semibold" : "text-gray-700"}`}
            >
              {t.service}
            </Link>
            <Link
              href="#properties"
              onClick={() => {
                setActiveSection("properties");
                setOpen(false);
              }}
              className={linkCls("properties")}
            >
              {t.properties}
            </Link>
            <Link
              href="#contact"
              onClick={() => {
                setActiveSection("contact");
                setOpen(false);
              }}
              className={linkCls("contact")}
            >
              {t.contact}
            </Link>
            <Link
              href={t.blogLink}
              className="hover:text-blue-600 transition-colors duration-300 text-gray-700"
              onClick={() => setOpen(false)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.blog}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
