export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  updatedAt?: string;
  keywords: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "benefits-of-pre-engineered-buildings",
    title: "Benefits of Pre-Engineered Buildings for Industrial Projects",
    description:
      "Discover why Pre-Engineered Buildings (PEB) are cost-effective, faster to construct and ideal for industrial infrastructure projects.",
    date: "2026-02-22",
    updatedAt: "2026-02-22",
    keywords: [
      "pre engineered buildings",
      "PEB benefits",
      "industrial construction",
      "industrial warehouse structure",
      "A K ENGINEERING",
    ],
    content: `
Pre-Engineered Buildings (PEB) have transformed industrial construction across India.

1. Faster Construction
PEB structures are manufactured in factories and assembled on-site, reducing construction time significantly.

2. Cost Efficiency
Optimized steel usage reduces material wastage and overall project cost.

3. Design Flexibility
PEB allows future expansion and customization.

4. Lower Maintenance
High-quality steel structures offer long-term durability.

Industries like power plants, cement factories, warehouses and manufacturing units prefer PEB for large-scale infrastructure.
`,
  },
  {
    slug: "peb-vs-rcc-industrial-construction",
    title: "PEB vs RCC: Which is Better for Industrial Construction?",
    description:
      "Compare Pre-Engineered Buildings and RCC structures for industrial shed and factory construction projects.",
    date: "2026-02-20",
    updatedAt: "2026-02-20",
    keywords: [
      "PEB vs RCC",
      "industrial shed construction",
      "steel structure vs RCC",
      "factory building comparison",
      "A K ENGINEERING",
    ],
    content: `
When choosing between PEB and RCC for industrial construction, consider:

Speed:
PEB construction is significantly faster than RCC.

Cost:
PEB generally requires lower foundation cost.

Expansion:
Steel buildings allow easy modification.

Weight:
PEB structures are lighter, reducing load on soil.

For industrial sheds and warehouses, PEB is often the preferred choice.
`,
  },
];
