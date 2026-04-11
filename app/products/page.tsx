import Link from "next/link";

const products = [
  {
    title: "Scaffolding Systems",
    desc: "Reliable access and support systems for construction, industrial, and maintenance projects.",
  },
  {
    title: "Formwork Systems",
    desc: "Practical formwork solutions designed to support efficient site operations and concrete works.",
  },
  {
    title: "H20 Timber Beam",
    desc: "Quality timber beam supply for formwork applications with professional commercial support.",
  },
  {
    title: "Plywood & Boards",
    desc: "Construction-grade panel materials for formwork, temporary works, and general project supply.",
  },
  {
    title: "Accessories",
    desc: "Essential components and site-use accessories to complete system requirements with confidence.",
  },
  {
    title: "Rental & Project Supply",
    desc: "Flexible support for project-based requirements, including supply coordination and rental inquiries.",
  },
];

export default function ProductsPage() {
  return (
    <main>
      <section className="hero page-hero">
        <div className="container" style={{ padding: '84px 0 90px', position: 'relative' }}>
          <div className="badge">Products</div>
          <h1>Main product categories for contractors, traders, and project buyers</h1>
          <p className="lead">
            A cleaner structure helps visitors understand what GNG supplies at a glance,
            while creating a stronger path to quotation requests.
          </p>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container three-col">
          {products.map((item) => (
            <div key={item.title} className="product-card">
              <div className="tiny-label">Category</div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <Link href="/contact" className="link">Request information →</Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
