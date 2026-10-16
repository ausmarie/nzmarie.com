"use client";

import React from "react";
import Header from "./Header";
import Hero from "./Hero";
import About from "./About";
import AppraisalSection from "./AppraisalSection";
import Services from "./Services";
import PropertyListings from "./PropertyListings";
import Contact from "./Contact";
import ReportDownloadSection from "./ReportDownloadSection";
import Footer from "./Footer";
import Qualifications from "./Qualifications";
import QRScanTracker from "./QRScanTracker";
import SectionTracker from "./SectionTracker";
import { Language } from "../lib/translations";

export default function MainPageContent({ lang = "en" }: { lang?: Language }) {
    return (
        <main>
            <QRScanTracker />
            <Header lang={lang} />
            <SectionTracker name="hero">
                <Hero lang={lang} />
            </SectionTracker>
            <SectionTracker name="about">
                <About lang={lang} />
            </SectionTracker>
            <SectionTracker name="appraisal">
                <AppraisalSection lang={lang} />
            </SectionTracker>
            <SectionTracker name="services">
                <Services lang={lang} />
            </SectionTracker>
            <SectionTracker name="property_listings">
                <PropertyListings lang={lang} />
            </SectionTracker>
            <SectionTracker name="qualifications">
                <Qualifications lang={lang} />
            </SectionTracker>
            <SectionTracker name="contact">
                <Contact lang={lang} />
            </SectionTracker>
            <SectionTracker name="report_download">
                <ReportDownloadSection lang={lang} />
            </SectionTracker>
            <Footer lang={lang} />
        </main>
    );
}
