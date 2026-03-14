"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
} from "@/lib/contact";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About Us" },
  { href: "/blog", label: "Insights" },
];

const servicesLinks = [
  { href: "/services#peb", label: "Pre-Engineered Buildings (PEB)" },
  { href: "/services#fabrication", label: "Heavy Steel Fabrication" },
  { href: "/services#erection", label: "Structural Steel Erection" },
  { href: "/services#maintenance", label: "Mechanical Maintenance & Retrofitting" },
];

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const servicesRef = useRef<HTMLDivElement | null>(null);

  const closeAll = () => {
    setMobileOpen(false);
    setServicesOpen(false);
  };

  const requestQuoteHref = useMemo(() => "/enquiry", []);

  useEffect(() => {
    const onScroll = () => setIsStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!servicesRef.current) return;
      const target = e.target as Node | null;
      if (target && !servicesRef.current.contains(target)) setServicesOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      {/* Slim top bar (trust line) */}
      <div className="bg-slate-950 px-4 py-2 text-center text-xs font-semibold tracking-wide text-white/90 md:text-sm">
        Industrial EPC Contractor • Hirakud, Sambalpur • Pan-India Project Execution
      </div>

      {/* Main nav */}
      <div
        className={[
          "border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80",
          isStuck ? "shadow-sm" : "",
        ].join(" ")}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex shrink-0 items-center"
              aria-label="A K ENGINEERING Home"
              onClick={closeAll}
            >
              <Image
                src="/logo/ak-engineering-logo.png"
                alt="A K ENGINEERING Logo"
                width={40}
                height={40}
                priority
                className="h-10 w-10 object-contain"
              />
            </Link>

            <div className="min-w-0">
              <Link
                href="/"
                className="block truncate text-lg font-extrabold tracking-tight text-slate-900 md:text-xl"
                onClick={closeAll}
              >
                A K ENGINEERING
              </Link>
              <p className="truncate text-xs text-slate-600 md:text-sm">
                EPC • Steel Fabrication • Structural Erection • PEB
              </p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-800 lg:flex">
            <Link href="/" className="hover:text-slate-950">
              Home
            </Link>

            {/* Services dropdown */}
            <div className="relative" ref={servicesRef}>
              <button
                type="button"
                className="inline-flex items-center gap-2 hover:text-slate-950"
                aria-haspopup="menu"
                aria-expanded={servicesOpen}
                onClick={() => setServicesOpen((v) => !v)}
              >
                Services
                <svg
                  className={[
                    "h-4 w-4 transition",
                    servicesOpen ? "rotate-180" : "",
                  ].join(" ")}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {servicesOpen ? (
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-3 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
                >
                  <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                    <div className="text-xs font-extrabold tracking-wide text-slate-900">
                      CORE CAPABILITIES
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Procurement-friendly scopes • Technical consultation
                    </div>
                  </div>

                  <div className="p-2">
                    {servicesLinks.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="block rounded-xl px-4 py-3 text-sm text-slate-800 hover:bg-slate-50 hover:text-slate-950"
                        role="menuitem"
                        onClick={closeAll}
                      >
                        {l.label}
                      </Link>
                    ))}
                    <div className="px-2 pb-2 pt-1">
                      <Link
                        href="/services"
                        className="block rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900"
                        onClick={closeAll}
                      >
                        View all services →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {navLinks
              .filter((l) => l.href !== "/")
              .map((l) => (
                <Link key={l.href} href={l.href} className="hover:text-slate-950">
                  {l.label}
                </Link>
              ))}
          </nav>

          {/* Right actions */}
          <div className="hidden items-center gap-2 lg:flex">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              {CONTACT_EMAIL}
            </a>
            <a
              href={`tel:${CONTACT_PHONE_E164}`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              {CONTACT_PHONE_DISPLAY}
            </a>
            <Link
              href={requestQuoteHref}
              className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-extrabold text-black hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              GET QUOTE
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 lg:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>

        {/* Mobile panel */}
        {mobileOpen ? (
          <div className="border-t border-slate-200 bg-white lg:hidden">
            <div className="mx-auto max-w-7xl px-4 py-4">
              <div className="grid gap-2">
                <Link
                  href="/"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={closeAll}
                >
                  Home
                </Link>

                <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                    <span className="inline-flex items-center justify-between w-full">
                      Services
                      <span className="text-slate-500">▾</span>
                    </span>
                  </summary>
                  <div className="mt-2 grid gap-1">
                    {servicesLinks.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="rounded-md px-2 py-2 text-sm text-slate-800 hover:bg-slate-50"
                        onClick={closeAll}
                      >
                        {l.label}
                      </Link>
                    ))}
                    <Link
                      href="/services"
                      className="rounded-md bg-slate-950 px-2 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                      onClick={closeAll}
                    >
                      View all services →
                    </Link>
                  </div>
                </details>

                <Link
                  href="/projects"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={closeAll}
                >
                  Projects
                </Link>
                <Link
                  href="/about"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={closeAll}
                >
                  About Us
                </Link>
                <Link
                  href="/blog"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={closeAll}
                >
                  Insights
                </Link>

                <div className="mt-2 grid gap-2">
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {CONTACT_EMAIL}
                  </a>
                  <a
                    href={`tel:${CONTACT_PHONE_E164}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    {CONTACT_PHONE_DISPLAY}
                  </a>
                  <Link
                    href={requestQuoteHref}
                    className="rounded-lg bg-orange-500 px-4 py-3 text-center text-sm font-extrabold text-black hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    onClick={closeAll}
                  >
                    GET QUOTE
                  </Link>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <Link
                    href="/privacy-policy"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50"
                    onClick={closeAll}
                  >
                    Privacy
                  </Link>
                  <Link
                    href="/terms-and-conditions"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50"
                    onClick={closeAll}
                  >
                    Terms
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
