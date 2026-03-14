import type { Metadata } from "next";
import ProjectGallery, { ProjectGalleryItem } from "@/components/ProjectGallery";
import ProjectVideos, { ProjectVideoItem } from "@/components/ProjectVideos";

export const metadata: Metadata = {
  title: "Industrial Projects | A K ENGINEERING",
  description:
    "Industrial steel fabrication, PEB construction, and structural erection projects by A K ENGINEERING.",
};

const galleryItems: ProjectGalleryItem[] = [
  {
    src: "/projects/peb-shed-erection-sambalpur.jpg",
    alt: "PEB shed erection work at an industrial site in Sambalpur by A K ENGINEERING",
    title: "PEB Shed Erection – Sambalpur",
  },
  {
    src: "/projects/steel-fabrication-workshop-cutting-welding.jpg",
    alt: "Structural steel fabrication in workshop showing cutting and welding work by A K ENGINEERING",
    title: "Steel Fabrication – Workshop",
  },
  {
    src: "/projects/structure-erection-crane-lifting.jpg",
    alt: "Crane lifting and steel structure erection work at industrial site by A K ENGINEERING",
    title: "Structure Erection – Crane Lifting",
  },
  {
    src: "/projects/roofing-cladding-industrial-shed.jpg",
    alt: "Industrial shed roofing and cladding installation work by A K ENGINEERING",
    title: "Roofing & Cladding",
  },
  {
    src: "/projects/puf-panel-installation-insulated-shed.jpg",
    alt: "PUF insulated panel installation work on industrial shed by A K ENGINEERING",
    title: "PUF Panel Installation",
  },
];

const videoItems: ProjectVideoItem[] = [
  {
    type: "mp4",
    src: "/projects/videos/crane-lifting-structure-erection.mp4",
    title: "Crane Lifting & Structure Erection (MP4)",
    poster: "/projects/video-posters/crane-lifting-structure-erection.jpg",
  },
  {
    type: "youtube",
    youtubeId: "dQw4w9WgXcQ",
    title: "Steel Fabrication Work (YouTube)",
  },
];

export default function ProjectsPage() {
  return (
    <main className="bg-white text-gray-900">
      <section className="bg-black text-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold">
            Our Industrial Projects
          </h1>
          <p className="mt-4 max-w-3xl text-gray-300">
            A selection of our industrial steel fabrication, PEB construction,
            structural erection, roofing & cladding, and PUF panel installation
            works.
          </p>
        </div>
      </section>

      <section className="py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <ProjectGallery title="Project Images" items={galleryItems} />
        </div>
      </section>

      <section className="bg-gray-50 py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <ProjectVideos title="Project Videos" items={videoItems} />
        </div>
      </section>
    </main>
  );
}
