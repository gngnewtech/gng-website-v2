import Image from "next/image";
import Link from "next/link";

const categories = [
  {
    title: "Scaffolding Systems",
    image: "/products/scaffolding.jpg",
    items: [
      "Cuplock Scaffolding",
      "Frame Scaffolding",
      "Steel Planks",
      "Base Jack",
    ],
    desc: "Practical scaffolding supply for access platforms, slab works, and general site support.",
  },
  {
    title: "Formwork Systems",
    image: "/products/formwork.jpg",
    items: [
      "Wall Formwork",
      "Column Formwork",
      "Slab Formwork",
      "Beam Formwork",
    ],
    desc: "Reliable formwork solutions for concrete structure works and project-based construction requirements.",
  },
  {
    title: "H20 Timber Beam",
    image: "/products/h20-beam.jpg",
    items: [
      "Standard H20 Timber Beam",
      "Formwork Beam Support",
      "Beam Accessories",
      "Site-use Beam Supply",
    ],
    desc: "Suitable for slab, beam, and wall formwork systems with stable site performance.",
  },
  {
    title: "Plywood & Boards",
    image: "/products/plywood.jpg",
    items: [
      "Film Faced Plywood",
      "Commercial Plywood",
      "Construction Boards",
      "Formwork Boards",
    ],
    desc: "Strong and practical board solutions for formwork support and repeated construction use.",
  },
  {
    title: "Accessories",
    image: "/products/accessories.jpg",
    items: [
      "Tie Rod",
      "Wing Nut",
      "Water Stop",
      "Clamp & Coupler",
    ],
    desc: "Essential accessories to support efficient connection, installation, and dismantling on site.",
  },
  {
    title: "Project Supply Support",
    image: "/products/project-support.jpg",
    items: [
      "Bulk Supply",
      "Quotation Support",
      "Contractor Inquiry Handling",
      "Trading Supply Coordination",
    ],
    desc: "Flexible support for contractors, traders, and project buyers across the UAE market.",
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
  "UAE-based construction supply focus",
  "Responsive quotation handling",
  "Practical product range for site use",
  "Suitable for contractors, traders, and project buyers",
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
              <article
                key={category.title}
                className="product-card product-card-with-image"
              >
                <div className="product-image-wrap">
                  <Image
                    src={category.image}
                    alt={category.title}
                    width={640}
                    height={400}
                    className="product-image"
                  />
                </div>

                <div className="product-card-body">
                  <h3>{category.title}</h3>

                  <ul>
                    {category.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>

                  <p>{category.desc}</p>

                  <div className="card-actions">
                    <Link href="/contact" className="secondary-btn">
                      Send Inquiry
                    </Link>
                  </div>
                </div>
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
            <h2>Supply approach that supports project requirements</h2>
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
            <div className="mini-title">REQUEST QUOTATION</div>
            <h2>Need product details, quantity support, or pricing?</h2>
            <p>
              Contact GNG New Tech LLC for scaffolding systems, formwork supply,
              timber beam, plywood, accessories, and project-based material support.
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
