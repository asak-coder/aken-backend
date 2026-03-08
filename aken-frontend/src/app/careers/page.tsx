import type { Metadata } from "next";
import CareersClient from "./CareersClient";

export const metadata: Metadata = {
  title: "Careers & Talent Portal | A K ENGINEERING",
  description:
    "Join A K ENGINEERING. Apply for engineering, supervision, safety, welding/fitting, and administration roles. Secure bio-data upload with validation.",
  openGraph: {
    title: "Careers & Talent Portal | A K ENGINEERING",
    description:
      "Build the future of industrial infrastructure with A K ENGINEERING. Submit your bio-data with strict validation.",
    type: "website",
  },
};

export default function CareersPage() {
  return <CareersClient />;
}
