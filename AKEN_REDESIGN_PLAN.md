# A K ENGINEERING — Enterprise Website Redesign (Placeholders-First)

Status: **No brand assets provided** → we will use **premium industrial placeholders** that can be replaced later.

---

## Brand System (Default / Placeholder)

### Color palette (industrial corporate)
- **Primary (Engineering Blue):** `#0A3F8C`
- **Secondary (Industrial Steel Grey):** `#1F2937`
- **Accent (Construction Orange):** `#F97316`
- **Background (Near Black):** `#0B1220`
- **Surface (Card):** `#111827`
- **Text (Light):** `#E5E7EB`
- **Text (Muted):** `#94A3B8`
- **Border:** `rgba(148, 163, 184, 0.20)`

### Typography (fast, enterprise, Google-hosted)
- Headings: `Inter` (700–800)
- Body: `Inter` (400–600)
- Optional engineering accent (later): `IBM Plex Sans` or `Space Grotesk` for headings only

### UI style rules
- Full-width sections, max content width `1280px`
- Strong grid rhythm (12-col desktop, 4-col mobile)
- Subtle motion (reveal on scroll, counters, hover elevation)
- Clear B2B CTA hierarchy (primary orange, secondary ghost)

---

## Visual Media Plan (Placeholders)

### Images (to create in `/public/media/`)
- `steel-welding-sparks.jpg` (hero poster & section)
- `beam-fabrication.jpg`
- `crane-erection.jpg`
- `industrial-shed-wide.jpg`
- `peb-warehouse-interior.jpg`
- `quality-inspection.jpg`
- `engineering-blueprint-team.jpg`
- `safety-helmet-site.jpg`

### Videos (placeholder files for later swap)
- `hero-fabrication.mp4` (cinematic: fabrication → cutting → welding → erection)
- `workshop-process.mp4`
- `crane-lift-erection.mp4`

Implementation: support **poster-first** + optional **desktop video** with reduced-motion handling (already in `HeroMedia.tsx`).

---

## Homepage Structure (Final Target)

1. **Hero (Video)**
   - Headline: “Engineering Strength for Industrial Infrastructure”
   - CTAs:
     - Request Project Quote
     - Submit Project Requirement
   - Trust microcopy + location

2. **Trust Indicators**
   - Animated counters (years, tonnage, safety compliance, pan-India)

3. **About A K ENGINEERING**
   - EPC capability + fabrication expertise (short, high clarity)

4. **Services (SEO-linked cards)**
   - PEB
   - Steel Structure Fabrication
   - Structural Steel Erection
   - Industrial Shed Construction
   - Sheet Cladding & Roofing
   - Structural Retrofitting
   - Each links to dedicated SEO pages

5. **Industries Served**
   - Power, Cement, Mining, Manufacturing, Infrastructure
   - Add industry icons + short “typical scopes”

6. **Project Showcase**
   - Visual gallery (slider + lightbox)
   - “Fabrication / Erection / Completed” filters

7. **Why Choose A K ENGINEERING**
   - Differentiators (QA, safety, execution planning, fabrication accuracy)

8. **Project Enquiry Form**
   - Name, Company Name, Email, Phone, Project Requirement, Message
   - Sticky CTA + WhatsApp + call

---

## SEO Architecture (Target: 5k–10k monthly)

### Service landing pages (10)
1. `/services/industrial-epc-contractor-india`
2. `/services/steel-fabrication-company-india`
3. `/services/structural-steel-erection-services`
4. `/services/pre-engineered-buildings-peb-contractor`
5. `/services/industrial-shed-construction`
6. `/services/warehouse-steel-structure-construction`
7. `/services/sheet-cladding-roofing-installation`
8. `/services/structural-retrofitting-strengthening`
9. `/services/mezzanine-platform-steel-fabrication`
10. `/services/piping-support-structures-fabrication`

Each page includes:
- Meta title + description
- H1 + H2 clusters
- FAQ (schema)
- Internal links to industries + guides + contact

### Industrial guide pages (20)
Examples:
- PEB vs conventional shed: cost, time, approvals
- Steel fabrication QA checklist (WPS, MTC, NDT basics)
- Erection planning: cranes, safety, sequencing
- Warehouse steel structure design considerations
- Roofing/cladding best practices for leakage prevention
(20 total in a structured cluster)

### Blog articles (20)
Examples:
- “How to choose an industrial EPC contractor in India”
- “Typical lead time for PEB buildings”
- “Safety best practices for structural erection”
(20 total supporting long-tail search)

### Technical SEO
- `sitemap.ts` includes all pages
- `robots.ts` configured
- Add schema: Organization, LocalBusiness, Service, FAQPage, BreadcrumbList
- Internal linking (services ↔ industries ↔ guides ↔ blog)
- Fast LCP: `next/image`, optimized media, minimal JS

---

## Modern Features (Require Approval Before Implementation)

Proposed:
- Floating enquiry + WhatsApp button (partially present)
- Sticky navigation + section highlighting
- Animated stats counters (present)
- Project gallery slider + lightbox
- Interactive service cards (present baseline)
- Video sections (hero present baseline)
- Blog system (already exists; needs content system + SEO wiring)
- Lead tracking: UTM capture + attribution (already present components)
- Admin lead pipeline enhancements (optional)

---

## UX Principles (Industrial B2B)
- Clear capability → credibility → proof → enquiry loop
- Above-the-fold CTA + contact info
- Proof assets (photos/videos, certifications) in the right places
- Minimal friction form (fast, mobile-first)
- Trust + compliance sections for ad/platform reviews
