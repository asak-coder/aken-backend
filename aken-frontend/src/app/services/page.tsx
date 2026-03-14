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
    "Industrial EPC & PEB Services | Steel Fabrication & Erection | A K ENGINEERING",
  description:
    "A K ENGINEERING delivers industrial EPC execution, PEB construction, structural steel fabrication, steel structure erection, roofing & cladding, and PUF panel installation services across Odisha and India. Request a project quotation for your plant, warehouse, or expansion works.",
  keywords:
    "PEB contractor Odisha, steel fabrication contractor Sambalpur, structural steel fabrication services, industrial steel structure erection, PUF panel installation contractor, roofing sheeting cladding contractor, industrial maintenance shutdown services, industrial shed construction Odisha, A K ENGINEERING",
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
          href="/enquiry"
          ctaName="Request Quotation"
          ctaLocation="services_hero"
          eventName="request_quotation_click"
          className="bg-yellow-500 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-400 transition"
        >
          Request Project Quote
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
        <h2 className="text-3xl font-bold mb-10">Services Overview</h2>
        <p className="text-lg text-gray-700 leading-relaxed mb-10 max-w-4xl">
          From PEB construction to shutdown maintenance, A K ENGINEERING supports
          industrial EPC teams with end-to-end execution. As a{" "}
          <span className="font-semibold">PEB contractor in Odisha</span> and a{" "}
          <span className="font-semibold">
            steel fabrication contractor in Sambalpur
          </span>
          , we deliver reliable fabrication, on-site erection and installation
          services for plants, warehouses and expansion projects—with safety,
          schedule and quality at the core.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">
              Pre-Engineered Building (PEB) Construction
            </h3>
            <p className="text-gray-700 mb-4">
              Design-coordinated, fast-track PEB solutions for industrial sheds,
              warehouses and manufacturing facilities—optimized for speed,
              economy and future expansion.
            </p>
            <ul className="list-disc ml-5 text-gray-700 space-y-1">
              <li>Scope: PEB supply coordination, fabrication, erection, roofing & cladding</li>
              <li>Advantages: faster delivery, lighter foundations, scalable bays</li>
              <li>Applications: warehouses, workshops, logistics hubs</li>
            </ul>
          </div>

          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">
              Structural Steel Fabrication
            </h3>
            <p className="text-gray-700 mb-4">
              Workshop fabrication for beams, columns, trusses and industrial
              support structures with controlled processes and consistent
              quality.
            </p>
            <ul className="list-disc ml-5 text-gray-700 space-y-1">
              <li>Scope: cutting, drilling, welding, fit-up, trial assembly, marking</li>
              <li>Advantages: faster site assembly, reduced rework</li>
              <li>Applications: plants, conveyors, platforms, heavy structures</li>
            </ul>
          </div>

          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">Steel Structure Erection</h3>
            <p className="text-gray-700 mb-4">
              Safe and efficient{" "}
              <span className="font-semibold">industrial steel structure erection</span>{" "}
              for PEB sheds, process buildings and equipment structures—aligned
              to project schedules and shutdown windows.
            </p>
            <ul className="list-disc ml-5 text-gray-700 space-y-1">
              <li>Scope: lifting plans, rigging, bolting, alignment, grouting support</li>
              <li>Advantages: safer execution, faster commissioning support</li>
              <li>Applications: process plants, power plants, warehouses</li>
            </ul>
          </div>

          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">
              Roofing, Sheeting & Cladding
            </h3>
            <p className="text-gray-700 mb-4">
              Industrial roofing and wall cladding installation for weather
              protection, thermal comfort and long-term durability.
            </p>
            <ul className="list-disc ml-5 text-gray-700 space-y-1">
              <li>Scope: roof sheets, side cladding, flashings, gutters, ridge caps</li>
              <li>Advantages: improved leak control, better finish, quick coverage</li>
              <li>Applications: sheds, warehouses, workshops</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Detailed Services */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="space-y-14">
          {/* PEB */}
          <div className="border rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-4">
              Pre-Engineered Building (PEB) Construction
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              A K ENGINEERING delivers turnkey PEB execution for industrial
              warehouses, factory sheds and logistics facilities. We coordinate
              design intent with fabrication and on-site erection to reduce
              cycle time and maintain structural accuracy—ideal for fast-track
              projects in Odisha and across India.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Scope of Work</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>PEB structural fabrication & supply coordination</li>
                  <li>Column, rafter and bracing erection with alignment control</li>
                  <li>Roofing, sheeting & cladding installation</li>
                  <li>Gutters, down-take pipes, flashings and accessories</li>
                  <li>Mezzanine / lean-to integration and expansion provisions</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Key Advantages</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Faster construction compared to conventional buildings</li>
                  <li>Optimized steel weight and reduced foundation loads</li>
                  <li>Cleaner site work with predictable assembly sequence</li>
                  <li>Easy future expansion with modular bay planning</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Our Team Skillset
                </h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>PEB erection supervisors with safe lifting practices</li>
                  <li>Skilled riggers and fitters for bolt-up and alignment</li>
                  <li>Roofing & cladding installers for leak-resistant finish</li>
                  <li>Site QA checks for plumb, level, torque and marking</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Applications</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Warehousing facilities and logistics parks</li>
                  <li>Manufacturing units and workshops</li>
                  <li>Power plants and industrial utilities</li>
                  <li>Cement industries and mining industries (ancillary sheds)</li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <ProjectGallery
                title="PEB Project Photos"
                items={pebGallery}
              />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <TrackedLink
                href="/enquiry"
                ctaName="Request Quote - PEB"
                ctaLocation="services_peb"
                eventName="request_quote_peb_click"
                className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Request a PEB Quote
              </TrackedLink>
              <TrackedAnchor
                href={`tel:${CONTACT_PHONE_E164}`}
                ctaName="Call - PEB"
                ctaLocation="services_peb"
                eventName="phone_click"
                className="border border-black px-6 py-3 rounded-lg hover:bg-black hover:text-white transition"
              >
                Call Our Engineering Team
              </TrackedAnchor>
            </div>
          </div>

          {/* Fabrication */}
          <div className="border rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-4">Structural Steel Fabrication</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              As a trusted{" "}
              <span className="font-semibold">
                structural steel fabrication services
              </span>{" "}
              provider, A K ENGINEERING fabricates industrial steel components
              that assemble faster on site and perform reliably in demanding
              plant environments. Our fabrication team focuses on fit-up
              accuracy, weld quality and consistent marking for smooth erection.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Scope of Work</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Beams, columns, trusses, bracings and built-up sections</li>
                  <li>Platforms, walkways, ladders and handrails</li>
                  <li>Conveyor galleries and industrial equipment structures</li>
                  <li>Fit-up, welding, grinding, trial assembly and dispatch marking</li>
                  <li>Fabrication support for retrofits and expansions</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Key Advantages</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Reduced site rework due to controlled fabrication checks</li>
                  <li>Faster erection with proper trial fitting and marking</li>
                  <li>Cleaner bolt-up alignment for multi-bay structures</li>
                  <li>Reliable fabrication output for tight EPC schedules</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Our Team Skillset
                </h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Experienced welders, fitters and fabricators</li>
                  <li>Supervisors for dimensional checks and assembly planning</li>
                  <li>Quality-focused fabrication practices and documentation</li>
                  <li>Safe material handling and loading support</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Applications</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Power plants and aluminium plants</li>
                  <li>Cement industries and mining industries</li>
                  <li>Warehousing facilities and manufacturing units</li>
                  <li>Process lines, conveyors and material handling systems</li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <ProjectGallery
                title="Fabrication Photos"
                items={fabricationGallery}
              />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <TrackedLink
                href="/enquiry"
                ctaName="Request Quote - Fabrication"
                ctaLocation="services_fabrication"
                eventName="request_quote_fabrication_click"
                className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Request Fabrication Quote
              </TrackedLink>
              <TrackedAnchor
                href={CONTACT_WHATSAPP_URL}
                ctaName="WhatsApp - Fabrication"
                ctaLocation="services_fabrication"
                eventName="whatsapp_click"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-black px-6 py-3 rounded-lg hover:bg-black hover:text-white transition"
              >
                WhatsApp Requirements
              </TrackedAnchor>
            </div>
          </div>

          {/* Erection */}
          <div className="border rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-4">Steel Structure Erection</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              We execute safe and dependable steel erection for industrial sheds,
              process buildings, conveyors and equipment support structures.
              Our site teams follow proper lifting plans, rigging methods and
              alignment procedures to minimize downtime and ensure structural
              stability—especially during shutdown windows.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Scope of Work</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Sequence planning for columns, rafters, bracings and trusses</li>
                  <li>Rigging, lifting, bolting, leveling and alignment checks</li>
                  <li>Anchor bolt coordination and base plate leveling support</li>
                  <li>Assembly of platforms, galleries and access systems</li>
                  <li>As-built support and punch list closure</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Key Advantages</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Reduced site risk through trained rigging practices</li>
                  <li>Better schedule control with experienced erection crews</li>
                  <li>Improved fit-up using marked components and trial assemblies</li>
                  <li>Support for commissioning and handover readiness</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Our Team Skillset
                </h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Riggers, crane coordinators and high-elevation workers</li>
                  <li>Fitters for bolt-up, plumbing and bracing adjustments</li>
                  <li>Safety-first execution with permits and toolbox talks</li>
                  <li>Shutdown-ready crews for time-bound work fronts</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Applications</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Power plants and aluminium plants</li>
                  <li>Cement industries and mining industries</li>
                  <li>Warehousing facilities and manufacturing units</li>
                  <li>Plant expansion structural works</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <TrackedLink
                href="/enquiry"
                ctaName="Request Quote - Erection"
                ctaLocation="services_erection"
                eventName="request_quote_erection_click"
                className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Request Erection Quote
              </TrackedLink>
              <TrackedAnchor
                href={`tel:${CONTACT_PHONE_E164}`}
                ctaName="Call - Erection"
                ctaLocation="services_erection"
                eventName="phone_click"
                className="border border-black px-6 py-3 rounded-lg hover:bg-black hover:text-white transition"
              >
                Call for Site Planning
              </TrackedAnchor>
            </div>
          </div>

          {/* Roofing & Cladding */}
          <div className="border rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-4">Roofing, Sheeting & Cladding</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              Roofing and cladding quality directly impacts leak resistance,
              equipment protection and the working environment. Our teams install
              industrial roofing sheets, wall cladding and accessories with proper
              overlaps, sealants and flashing details for long service life.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Scope of Work</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Roof sheets and side cladding for PEB and conventional steel sheds</li>
                  <li>Gutters, ridge caps, flashings, louvers and ventilators</li>
                  <li>Leak rectification and replacement in existing sheds</li>
                  <li>Skylights and natural ventilation integrations</li>
                  <li>Cladding for warehouses and process buildings</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Key Advantages</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Improved weather sealing and reduced water ingress</li>
                  <li>Better finish and consistent fastening patterns</li>
                  <li>Quicker enclosure for faster equipment installation</li>
                  <li>Support for maintenance and re-roofing shutdown plans</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Our Team Skillset
                </h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Trained installers for roof safety lines and PPE compliance</li>
                  <li>Experienced teams for flashing details and leak control</li>
                  <li>High-elevation work capability with supervision</li>
                  <li>Site coordination to avoid material damage and delays</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Applications</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Warehousing facilities and manufacturing units</li>
                  <li>Power plants, aluminium plants and cement industries</li>
                  <li>Mining industries (service sheds and utilities)</li>
                  <li>Cold storage and temperature-controlled enclosures</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <TrackedLink
                href="/enquiry"
                ctaName="Request Quote - Cladding"
                ctaLocation="services_cladding"
                eventName="request_quote_cladding_click"
                className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Request Roofing & Cladding Quote
              </TrackedLink>
              <TrackedAnchor
                href={CONTACT_WHATSAPP_URL}
                ctaName="WhatsApp - Cladding"
                ctaLocation="services_cladding"
                eventName="whatsapp_click"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-black px-6 py-3 rounded-lg hover:bg-black hover:text-white transition"
              >
                WhatsApp for Site Visit
              </TrackedAnchor>
            </div>
          </div>

          {/* PUF */}
          <div className="border rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-4">PUF Panel Installation</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              A K ENGINEERING is a reliable{" "}
              <span className="font-semibold">
                PUF panel installation contractor
              </span>{" "}
              for industrial sheds, cold storage and insulated enclosures. We
              install insulated panels with correct joint sealing and accessory
              detailing to improve thermal performance and reduce energy loss.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Scope of Work</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>PUF wall and roof panels for sheds and process buildings</li>
                  <li>Insulated partitions and temperature-controlled rooms</li>
                  <li>Flashings, corners, trims, sealants and joint treatment</li>
                  <li>Repair / replacement of damaged insulated panels</li>
                  <li>Cold storage structure & insulated panel installation support</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Key Advantages</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Improved insulation for stable temperature control</li>
                  <li>Energy savings through tight joint sealing</li>
                  <li>Faster installation compared to conventional walls</li>
                  <li>Cleaner finish for food and pharma environments</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Our Team Skillset
                </h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Panel installers trained on alignment and joint sealing</li>
                  <li>On-site supervision for accessories and leak prevention</li>
                  <li>Safety practices for roof work and material handling</li>
                  <li>Coordination with MEP teams for openings and penetrations</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Applications</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Cold storage and food processing units</li>
                  <li>Warehousing facilities requiring insulation</li>
                  <li>Manufacturing units with controlled environments</li>
                  <li>Pharma, dairy and clean utility areas</li>
                </ul>
              </div>
            </div>

            <div className="mt-8">
              <ProjectGallery
                title="PUF Panel & Cladding Photos"
                items={pufGallery}
              />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <TrackedLink
                href="/enquiry"
                ctaName="Request Quote - PUF"
                ctaLocation="services_puf"
                eventName="request_quote_puf_click"
                className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Request PUF Panel Quote
              </TrackedLink>
              <TrackedAnchor
                href={`tel:${CONTACT_PHONE_E164}`}
                ctaName="Call - PUF"
                ctaLocation="services_puf"
                eventName="phone_click"
                className="border border-black px-6 py-3 rounded-lg hover:bg-black hover:text-white transition"
              >
                Call for Insulated Panel Work
              </TrackedAnchor>
            </div>
          </div>

          {/* Maintenance, Shutdown, Dismantling, Custom */}
          <div className="border rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-4">
              Industrial Maintenance & Shutdown Services
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              We support plant operations with shutdown-ready manpower,
              structural repairs and quick-turn fabrication/installation. Our
              teams coordinate with safety and operations to complete work
              fronts within planned outage windows.
            </p>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Scope of Work</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Shutdown structural modifications and replacement works</li>
                  <li>Hot work / cold work support (as per site permits)</li>
                  <li>Rapid fabrication and installation inside plant areas</li>
                  <li>Access platforms, supports and safety-related additions</li>
                  <li>Post-shutdown punch list closure support</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Key Advantages</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Better uptime planning with trained shutdown teams</li>
                  <li>Reduced coordination risk through single execution partner</li>
                  <li>Fast response for urgent fabrication and site fixes</li>
                  <li>Safety-driven work practices for live plant environments</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Our Team Skillset
                </h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Skilled welders, fitters, riggers and supervisors</li>
                  <li>Experience in permit systems and industrial safety norms</li>
                  <li>Ability to work at height and in restricted plant areas</li>
                  <li>Shutdown planning and quick work-front mobilization</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Applications</h3>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Power plants, aluminium plants and cement industries</li>
                  <li>Mining industries and material handling plants</li>
                  <li>Manufacturing units with planned shutdowns</li>
                  <li>Warehousing facilities with retrofit requirements</li>
                </ul>
              </div>
            </div>

            <div className="mt-10 border-t pt-8">
              <h3 className="text-2xl font-bold mb-3">Dismantling & Scrap Management</h3>
              <p className="text-gray-700 mb-4">
                Controlled dismantling of industrial structures and equipment
                supports with safe lifting, sorting and scrap handling to reduce
                site risk and keep work zones organized.
              </p>
              <ul className="list-disc ml-5 text-gray-700 space-y-1">
                <li>Benefits: safer demolition approach, cleaner site handover, improved scrap recovery</li>
                <li>Typical industries: power plants, aluminium plants, cement industries, mining</li>
              </ul>
            </div>

            <div className="mt-10 border-t pt-8">
              <h3 className="text-2xl font-bold mb-3">
                Custom Fabrication & Industrial Installation
              </h3>
              <p className="text-gray-700 mb-4">
                Custom steel fabrication and on-site installation for industrial
                modifications—supports, brackets, housings, access structures
                and small-to-mid fabrication packages required during execution.
              </p>
              <ul className="list-disc ml-5 text-gray-700 space-y-1">
                <li>Benefits: faster closures for site changes, single-point responsibility</li>
                <li>Typical industries: manufacturing units, cement, power, mining</li>
              </ul>
            </div>
          </div>

          {/* Additional Services */}
          <div className="border rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-6">Additional Industrial EPC Services</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="border rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-2">
                  Industrial Structural Repair & Retrofitting
                </h3>
                <p className="text-gray-700 mb-3">
                  Strengthening and repair works for aging industrial steel
                  structures to restore load capacity and improve safety without
                  full replacement.
                </p>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Benefits: extends asset life, minimizes downtime, improves compliance</li>
                  <li>Typical industries: power, cement, mining, manufacturing</li>
                </ul>
              </div>

              <div className="border rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-2">
                  Mezzanine Floor Fabrication
                </h3>
                <p className="text-gray-700 mb-3">
                  Space-optimizing mezzanine floors for warehouses and plants,
                  designed for storage, utilities and process operations.
                </p>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Benefits: increases usable area, quick installation, scalable</li>
                  <li>Typical industries: warehousing, manufacturing, logistics</li>
                </ul>
              </div>

              <div className="border rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-2">
                  Steel Platforms, Walkways & Ladders
                </h3>
                <p className="text-gray-700 mb-3">
                  Access structures for safe maintenance, inspection and
                  operations around equipment, conveyors and utility areas.
                </p>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Benefits: safer access, faster maintenance, reduced plant risk</li>
                  <li>Typical industries: power, cement, aluminium, mining</li>
                </ul>
              </div>

              <div className="border rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-2">
                  Industrial Equipment Support Structures
                </h3>
                <p className="text-gray-700 mb-3">
                  Fabrication and erection of supports for ducts, pipelines,
                  conveyors, tanks and process equipment as part of EPC works.
                </p>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Benefits: accurate fit-up, reliable load transfer, faster installation</li>
                  <li>Typical industries: cement, power, manufacturing, process plants</li>
                </ul>
              </div>

              <div className="border rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-2">
                  Plant Expansion Structural Works
                </h3>
                <p className="text-gray-700 mb-3">
                  Structural additions and modifications for plant expansions,
                  new lines, and utility integration—planned around live
                  operations.
                </p>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Benefits: expansion-ready execution, schedule support, minimal disruption</li>
                  <li>Typical industries: aluminium, cement, manufacturing, power</li>
                </ul>
              </div>

              <div className="border rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-2">
                  Cold Storage Structure & Insulated Panel Installation
                </h3>
                <p className="text-gray-700 mb-3">
                  Structures and insulated panel solutions for cold rooms and
                  temperature-controlled storage with tight sealing and clean
                  finish.
                </p>
                <ul className="list-disc ml-5 text-gray-700 space-y-1">
                  <li>Benefits: improved thermal performance, energy savings, faster enclosure</li>
                  <li>Typical industries: food, dairy, pharma, cold chain logistics</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <TrackedLink
                href="/enquiry"
                ctaName="Request Quote - Additional Services"
                ctaLocation="services_additional"
                eventName="request_quote_additional_services_click"
                className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
              >
                Request a Project Quote
              </TrackedLink>
              <TrackedAnchor
                href={`tel:${CONTACT_PHONE_E164}`}
                ctaName="Call - Additional Services"
                ctaLocation="services_additional"
                eventName="phone_click"
                className="border border-black px-6 py-3 rounded-lg hover:bg-black hover:text-white transition"
              >
                Call for Consultation
              </TrackedAnchor>
            </div>
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Advantages of A K ENGINEERING</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">Execution-Ready Teams</h3>
            <p className="text-gray-700">
              Experienced structural fabrication and erection teams with skilled
              welders, fitters and riggers for heavy industrial projects.
            </p>
          </div>
          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">Safety-Focused Delivery</h3>
            <p className="text-gray-700">
              Work practices aligned to industrial safety requirements with
              supervision, PPE compliance, and planned lifting/rigging methods.
            </p>
          </div>
          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">Shutdown Capability</h3>
            <p className="text-gray-700">
              Ability to mobilize for shutdown and maintenance jobs with time-bound
              work fronts, quick fabrication and installation support.
            </p>
          </div>
          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">Competitive Project Cost</h3>
            <p className="text-gray-700">
              Efficient planning and fabrication discipline that supports
              predictable execution cost and reduced rework.
            </p>
          </div>
        </div>
      </section>

      {/* Industries Served */}
      <section className="py-20 px-6 max-w-6xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-6">Industries We Serve</h2>
        <p className="text-lg text-gray-700 mb-8 max-w-3xl mx-auto">
          Our engineering and industrial construction services support a wide
          range of EPC and plant operations across Odisha and India.
        </p>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-black text-white py-6 rounded-lg">Power Plants</div>
          <div className="bg-black text-white py-6 rounded-lg">Aluminium Plants</div>
          <div className="bg-black text-white py-6 rounded-lg">Cement Industries</div>
          <div className="bg-black text-white py-6 rounded-lg">Mining Industries</div>
          <div className="bg-black text-white py-6 rounded-lg">Warehousing Facilities</div>
          <div className="bg-black text-white py-6 rounded-lg">Manufacturing Units</div>
          <div className="bg-black text-white py-6 rounded-lg">Food & Cold Chain</div>
          <div className="bg-black text-white py-6 rounded-lg">Process Industries</div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-yellow-500 text-black py-20 text-center px-6">
        <h2 className="text-3xl font-bold mb-4">
          Need Industrial EPC Execution Support?
        </h2>
        <p className="text-lg mb-8 max-w-3xl mx-auto">
          Share your drawings, BOQ, location and schedule. Our engineering team
          will review the scope and respond with a competitive quotation.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <TrackedLink
            href="/enquiry"
            ctaName="Request Quotation"
            ctaLocation="services_bottom_cta"
            eventName="request_quotation_click"
            className="bg-black text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            Request a Project Quote
          </TrackedLink>
          <TrackedAnchor
            href={`tel:${CONTACT_PHONE_E164}`}
            ctaName="Call Now"
            ctaLocation="services_bottom_cta"
            eventName="phone_click"
            className="border border-black px-8 py-3 rounded-lg font-semibold hover:bg-black hover:text-white transition"
          >
            Call {CONTACT_PHONE_DISPLAY}
          </TrackedAnchor>
          <TrackedAnchor
            href={CONTACT_WHATSAPP_URL}
            ctaName="WhatsApp"
            ctaLocation="services_bottom_cta"
            eventName="whatsapp_click"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-black px-8 py-3 rounded-lg font-semibold hover:bg-black hover:text-white transition"
          >
            WhatsApp
          </TrackedAnchor>
        </div>
      </section>

    </main>
  );
}
