import Link from "next/link";

const categories = [
  {
    title: "Scaffolding Systems",
    items: [
      "Cuplock Scaffolding",
      "Frame Scaffolding",
      "Steel Planks",
      "Walk Boards",
      "Base Jack",
      "U Head Jack",
    ],
    desc: "Suitable for slab work, access platforms, external elevation works, and general site support.",
  },
  {
    title: "Formwork Systems",
    items: [
      "Wall Formwork",
      "Column Formwork",
      "Slab Formwork",
      "Beam Formwork",
      "Prop Support System",
      "Formwork Panels",
    ],
    desc: "Efficient and dependable formwork supply for concrete structure works and general construction projects.",
  },
  {
    title: "H20 Timber Beam",
    items: [
      "Standard H20 Timber Beam",
      "Formwork Beam Support",
      "Beam Accessories",
    ],
    desc: "Widely used for slab, beam, and wall formwork systems with stable performance and practical site application.",
  },
  {
    title: "Plywood & Boards",
    items: [
      "Film Faced Plywood",
      "Commercial Plywood",
      "Construction Boards",
      "Formwork Boards",
    ],
    desc: "Strong and practical board solutions for repeated use in formwork and construction site support.",
  },
  {
    title: "Accessories",
    items: [
      "Tie Rod",
      "Wing Nut",
      "Water Stop",
      "Clamp",
      "Coupler",
      "Formwork Fasteners",
    ],
    desc: "Complete accessory supply to support efficient installation, connection, and dismantling on site.",
  },
  {
    title: "Project Supply Support",
    items: [
      "Bulk Supply",
      "Fast Delivery Coordination",
      "Site-based Material Support",
      "Contractor Inquiry Handling",
      "Trading Supply Support",
    ],
    desc: "Responsive product support for project buyers, contractors, and construction material traders.",
  },
];

const applications = [
  "Residential construction projects",
  "Commercial building works",
  "Concrete slab and beam support",
  "Wall and column formwork application",
  "General contractor procurement",
  "Construction material trading supply",
];

const strengths = [
  "Reliable product supply for construction projects",
  "Suitable for contractors, traders, and project buyers",
  "Practical support for UAE market requirements",
  "Fast response for quotation and product inquiries",
];

export default function ProductsPage() {
  return (
    <main>
      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div className="badge">PRODUCT CATEGORIES</div>
            <h1>Scaffolding & Formwork Products</h1>
            <p className="section-lead">
              Reliable supply solutions for contractors, traders, and project buyers
              in the UAE.
            </p>
          </div>

          <div className="product-grid">
            {categories.map((category) => (
              <article key={category.title} className="product-card">
                <h3>{category.title}</h3>
                <ul>
                  {category.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>{category.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container two-col">
          <div className="info-card">
            <div className="mini-title">APPLICATION</div>
            <h2>Where our products are used</h2>
            <ul className="simple-list">
              {applications.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="info-card">
            <div className="mini-title">WHY GNG</div>
            <h2>Supply approach that supports project needs</h2>
            <ul className="simple-list">
              {strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container cta-panel">
          <div>
            <div className="mini-title">SEND INQUIRY</div>
            <h2>Need product details or a quotation?</h2>
            <p>
              Contact GNG New Tech LLC for product inquiries, quantity requests,
              and project-based supply support.
            </p>
          </div>

          <div className="cta-actions">
            <Link href="/contact" className="cta">
              Request Quote
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
