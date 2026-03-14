import ProjectGallery, { ProjectGalleryItem } from "@/components/ProjectGallery";
import TrackedAnchor from "@/components/TrackedAnchor";
import TrackedLink from "@/components/TrackedLink";
import {
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_E164,
  CONTACT_WHATSAPP_URL,
} from "@/lib/contact";
import { getServiceStructuredDataJson } from "@/lib/schema";

export const metadata = {
  title:
    "Industrial EPC & PEB Services | Steel Fabrication & Erection Contractor India",
  description:
    "A K ENGINEERING provides Pre-Engineered Buildings (PEB), Structural Steel Fabrication, Industrial Shed Construction and Erection Services across India for Power, Cement, Mining and Manufacturing industries.",
  keywords:
    "Pre Engineered Building Company India, Industrial Steel Fabrication Contractor, Industrial Shed Construction, Structural Steel Erection Services, EPC Contractor India",
};

const pebGallery: ProjectGalleryItem[] = [
  {
    src: "/projects/peb-warehouse-construction.jpg",
    alt: "Industrial warehouse PEB construction work by A K ENGINEERING",
    title: "Warehouse PEB Construction",
  },
  {
    src: "/projects/peb-shed-erection-sambalpur.jpg",
    alt: "PEB shed erection work at an industrial site in Sambalpur by A K ENGINEERING",
    title: "PEB Shed Erection",
  },
];

const fabricationGallery: ProjectGalleryItem[] = [
  {
    src: "/projects/steel-fabrication-workshop-cutting-welding.jpg",
    alt: "Structural steel fabrication in workshop showing cutting and welding work by A K ENGINEERING",
    title: "Workshop Fabrication",
  },
  {
    src: "/projects/steel-beam-column-fabrication.jpg",
    alt: "Steel beam and column fabrication work in workshop by A K ENGINEERING",
    title: "Beam & Column Fabrication",
  },
];

const pufGallery: ProjectGalleryItem[] = [
  {
    src: "/projects/puf-panel-installation-insulated-shed.jpg",
    alt: "PUF insulated panel installation work on industrial shed by A K ENGINEERING",
    title: "PUF Panel Installation",
  },
  {
    src: "/projects/puf-panel-roofing-installation.jpg",
    alt: "PUF panel roofing installation work for industrial shed by A K ENGINEERING",
    title: "PUF Panel Roofing",
  },
];

export default function ServicesPage() {
  return (
    <main className="bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: getServiceStructuredDataJson() }}
      />

      <section className="bg-black text-white py-20 text-center px-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Industrial EPC & Engineering Services
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-gray-300 mb-8">
          Comprehensive engineering solutions including Pre-Engineered Buildings,
          Structural Steel Fabrication, Industrial Shed Construction and
          Equipment Erection Services across India.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <TrackedLink
            href="/contact"
            ctaName="Request Quotation"
            ctaLocation="services_hero"
            eventName="request_quotation_click"
            className="bg-yellow-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition"
          >
            Request Quotation
          </TrackedLink>
          <TrackedAnchor
            href={CONTACT_WHATSAPP_URL}
            ctaName="WhatsApp"
            ctaLocation="services_hero"
            eventName="whatsapp_click"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-green-400 transition"
          >
            WhatsApp
          </TrackedAnchor>
          <TrackedAnchor
            href={`tel:${CONTACT_PHONE_E164}`}
            ctaName="Call Now"
            ctaLocation="services_hero"
            eventName="phone_click"
            className="border border-white px-6 py-3 rounded-lg hover:bg-white hover:text-black transition"
          >
            {CONTACT_PHONE_DISPLAY}
          </TrackedAnchor>
        </div>
      </section>

      <section className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Pre-Engineered Buildings (PEB)</h2>

        <p className="text-lg text-gray-700 leading-relaxed mb-6">
          A K ENGINEERING specializes in the design, fabrication and erection
          of Pre-Engineered Buildings (PEB) for industrial warehouses, factory
          sheds, logistics hubs, manufacturing units and commercial structures.
          Our PEB solutions are cost-efficient, fast to construct and
          structurally optimized for industrial applications.
        </p>

        <ul className="list-disc ml-6 text-gray-700 space-y-2">
          <li>Industrial Warehouse Construction</li>
          <li>Factory Shed & Workshop Buildings</li>
          <li>Multi-Span Steel Structures</li>
          <li>High Clearance Industrial Buildings</li>
          <li>Custom Steel Building Solutions</li>
        </ul>

        <div className="mt-8">
          <ProjectGallery title="PEB Construction Photos" items={pebGallery} />
        </div>
      </section>

      <section className="bg-gray-100 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">Structural Steel Fabrication</h2>

          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            We provide heavy structural steel fabrication services including
            beams, columns, trusses, industrial platforms and support
            structures. Our fabrication process ensures dimensional accuracy,
            welding integrity and compliance with industrial standards.
          </p>

          <ul className="list-disc ml-6 text-gray-700 space-y-2">
            <li>Heavy Structural Fabrication</li>
            <li>MS & ISMB Beam Structures</li>
            <li>Steel Trusses & Columns</li>
            <li>Industrial Platforms & Walkways</li>
            <li>Custom Engineered Steel Components</li>
          </ul>

          <div className="mt-8">
            <ProjectGallery
              title="Steel Fabrication Photos"
              items={fabricationGallery}
            />
          </div>
        </div>
      </section>

      <section className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Industrial Shed Construction</h2>

        <p className="text-lg text-gray-700 leading-relaxed mb-6">
          We execute turnkey industrial shed construction projects including
          structural erection, roofing, cladding and finishing works. Our
          industrial shed solutions are designed for durability, structural
          stability and long-term performance.
        </p>

        <ul className="list-disc ml-6 text-gray-700 space-y-2">
          <li>Industrial Roofing & Cladding</li>
          <li>PEB Industrial Shed Erection</li>
          <li>Steel Structure Installation</li>
          <li>Industrial Expansion Projects</li>
        </ul>

        <div className="mt-8">
          <ProjectGallery title="PUF Panel & Cladding Photos" items={pufGallery} />
        </div>
      </section>

      <section className="bg-gray-100 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">
            Industrial Erection & Equipment Installation
          </h2>

          <p className="text-lg text-gray-700 leading-relaxed mb-6">
            Our team executes structural erection, equipment installation and
            maintenance works at industrial sites with strict safety
            compliance. We handle shutdown projects, high-elevation works and
            heavy structural assembly.
          </p>

          <ul className="list-disc ml-6 text-gray-700 space-y-2">
            <li>Steel Structure Erection at Height</li>
            <li>Equipment Installation Services</li>
            <li>Conveyor & Support Structure Erection</li>
            <li>Industrial Maintenance & Retrofitting</li>
          </ul>
        </div>
      </section>

      <section className="py-20 px-6 max-w-6xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-10">Industries We Serve</h2>

        <div className="grid md:grid-cols-4 gap-6">
          <div className="bg-black text-white py-6 rounded-lg">Power Plants</div>
          <div className="bg-black text-white py-6 rounded-lg">Cement Industries</div>
          <div className="bg-black text-white py-6 rounded-lg">Mining Sector</div>
          <div className="bg-black text-white py-6 rounded-lg">Manufacturing Units</div>
        </div>
      </section>

      <section className="bg-yellow-500 text-black py-20 text-center px-6">
        <h2 className="text-3xl font-bold mb-6">Need Industrial Engineering Services?</h2>
        <p className="text-lg mb-6">
          Contact A K ENGINEERING for technical consultation and competitive
          project execution support.
        </p>

        <TrackedLink
          href="/contact"
          ctaName="Request Quotation"
          ctaLocation="services_bottom_cta"
          eventName="request_quotation_click"
          className="bg-black text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
        >
          Request Quotation
        </TrackedLink>
      </section>

    </main>
  );
}
