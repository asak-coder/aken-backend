import {
  CONTACT_EMAIL,
  CONTACT_PHONE_E164,
  CONTACT_WHATSAPP_URL,
} from "@/lib/contact";

const SITE_URL = "https://aken.firm.in";
const ORG_ID = `${SITE_URL}/#organization`;
const LOCAL_BUSINESS_ID = `${SITE_URL}/#localbusiness`;

const SERVICE_ITEMS = [
  {
    id: `${SITE_URL}/services#peb`,
    name: "Pre-Engineered Building (PEB) Solutions",
    description:
      "Industrial PEB design, fabrication, and erection for warehouses, production units, and infrastructure facilities.",
  },
  {
    id: `${SITE_URL}/services#steel-fabrication`,
    name: "Structural Steel Fabrication",
    description:
      "Heavy structural steel fabrication for beams, columns, trusses, process-support frames, and industrial platforms.",
  },
  {
    id: `${SITE_URL}/services#industrial-erection`,
    name: "Industrial Erection and Installation Services",
    description:
      "On-site industrial erection, installation support, and shutdown execution with safety and schedule controls.",
  },
];

export function getStructuredDataGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "A K ENGINEERING",
        url: SITE_URL,
        email: CONTACT_EMAIL,
        telephone: CONTACT_PHONE_E164,
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "Sales",
            telephone: CONTACT_PHONE_E164,
            email: CONTACT_EMAIL,
            areaServed: "IN",
            availableLanguage: ["English", "Hindi"],
          },
        ],
      },
      {
        "@type": ["LocalBusiness", "GeneralContractor"],
        "@id": LOCAL_BUSINESS_ID,
        name: "A K ENGINEERING",
        url: SITE_URL,
        telephone: CONTACT_PHONE_E164,
        email: CONTACT_EMAIL,
        priceRange: "$$",
        sameAs: [CONTACT_WHATSAPP_URL],
        address: {
          "@type": "PostalAddress",
          addressLocality: "Sambalpur",
          addressRegion: "Odisha",
          addressCountry: "IN",
        },
        areaServed: {
          "@type": "Country",
          name: "India",
        },
        makesOffer: SERVICE_ITEMS.map((service) => ({
          "@type": "Offer",
          itemOffered: {
            "@id": service.id,
          },
        })),
      },
      ...SERVICE_ITEMS.map((service) => ({
        "@type": "Service",
        "@id": service.id,
        name: service.name,
        description: service.description,
        provider: {
          "@id": ORG_ID,
        },
        areaServed: {
          "@type": "Country",
          name: "India",
        },
        serviceType: service.name,
      })),
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "A K ENGINEERING",
        publisher: {
          "@id": ORG_ID,
        },
      },
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#homepage`,
        url: SITE_URL,
        name: "Industrial EPC Contractor in India | A K ENGINEERING",
        isPartOf: {
          "@id": `${SITE_URL}/#website`,
        },
        about: {
          "@id": ORG_ID,
        },
      },
    ],
  };
}

export function getStructuredDataJson() {
  return JSON.stringify(getStructuredDataGraph());
}

export function getServiceStructuredDataJson() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": getStructuredDataGraph()["@graph"].filter((item: { "@type": string | string[] }) => {
      const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
      return types.includes("Organization") || types.includes("LocalBusiness") || types.includes("Service");
    }),
  });
}
