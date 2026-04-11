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

const strengths = [
  "Dubai-based business support",
  "Professional B2B presentation",
  "Fast response for quotation requests",
  "Construction-focused product positioning",
  "Clean mobile-friendly layout",
  "Trust-oriented corporate style",
];

const industries = [
  "Residential Projects",
  "Commercial Buildings",
  "Industrial Sites",
  "Infrastructure Works",
  "Contractor Supply",
  "Trading & Distribution",
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="badge">Dubai-based construction supplier</div>
            <h1>Reliable Scaffolding & Formwork Supply for Construction Projects</h1>
            <p className="lead">
              GNG New Tech LLC supplies scaffolding systems, formwork materials, timber beams,
              plywood, accessories, and related construction products for contractors, traders,
              and project buyers across the UAE, Middle East, and Africa.
            </p>

            <div className="tag-row">
              <div className="tag">International City</div>
              <div className="tag">Dubai, United Arab Emirates</div>
              <div className="tag">TRN Verified Business</div>
            </div>

            <div className="action-row">
              <Link href="/contact" className="btn btn-primary">Request a Quote</Link>
              <Link href="/products" className="btn btn-secondary">View Products</Link>
            </div>

            <div className="feature-strip">
              {['Scaffolding Supply', 'Formwork Materials', 'Project Support', 'Fast Response'].map((item) => (
                <div key={item} className="feature-chip">{item}</div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-soft">
              <div className="card-grid">
                <div className="info-card">
                  <div className="label">Positioning</div>
                  <h3>Construction supply specialist</h3>
                </div>
                <div className="info-card">
                  <div className="label">Audience</div>
                  <h3>Contractors & project buyers</h3>
                </div>
                <div className="info-card">
                  <div className="label">Style</div>
                  <h3>Blue-gray corporate identity</h3>
                </div>
                <div className="info-card">
                  <div className="label">Goal</div>
                  <h3>More quote-ready inquiries</h3>
                </div>
              </div>

              <div className="info-card" style={{ marginTop: 16 }}>
                <div className="tiny-label" style={{ color: '#1f5fbf' }}>Corporate presentation</div>
                <p className="section-copy" style={{ marginTop: 12, fontSize: 16 }}>
                  This website follows a cleaner blue-gray company style inspired by GNG’s official document layout,
                  creating a more consistent brand image across website, invoices, and company paperwork.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="container info-strip">
          {[
            'Dubai-based company',
            'Construction material focus',
            'Quotation-oriented website',
            'Professional business presentation',
          ].map((item) => (
            <div key={item} className="info-tile">{item}</div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div>
            <div className="section-label">About GNG</div>
            <h2>A stronger website identity aligned with official company documents</h2>
            <p className="section-copy">
              GNG New Tech LLC is a Dubai-based construction supply company serving contractors,
              traders, and project buyers with scaffolding systems, formwork materials, timber beams,
              plywood, accessories, and practical supply support.
            </p>
          </div>
          <div className="box">
            <div className="list-grid">
              {[
                'Dubai-based company presentation',
                'Construction material supply focus',
                'Professional quotation support',
                'Clearer B2B communication',
                'Consistent corporate identity',
              ].map((item) => <div key={item} className="box-soft">{item}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-head">
            <div className="section-label">Products</div>
            <h2>Main Product Categories</h2>
            <p className="section-copy">
              A cleaner structure helps visitors understand what GNG supplies at a glance,
              while creating a stronger path to quotation requests.
            </p>
          </div>

          <div className="three-col">
            {products.map((item) => (
              <div key={item.title} className="product-card">
                <div className="tiny-label">Category</div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <Link href="/contact" className="link">Request information →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div>
            <div className="section-label">Why Choose Us</div>
            <h2>Built to create more trust and better inquiries</h2>
            <p className="section-copy">
              The homepage positioning, business language, and visual style are designed
              to make GNG look more credible, more focused, and more commercially ready.
            </p>
          </div>
          <div className="list-grid two">
            {strengths.map((item) => <div key={item} className="box-soft">{item}</div>)}
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="container">
          <div className="section-head">
            <div className="section-label">Applications</div>
            <h2>Industries & Project Types We Serve</h2>
          </div>
          <div className="list-grid three">
            {industries.map((item) => <div key={item} className="box-soft">{item}</div>)}
          </div>
        </div>
      </section>

      <section className="section contact-shell">
        <div className="container contact-grid">
          <div>
            <div className="section-label" style={{ color: '#bfd6ff' }}>Contact Us</div>
            <h2 style={{ color: 'white' }}>Send us your inquiry or quotation request</h2>
            <p className="section-copy" style={{ color: 'rgba(235,244,255,0.92)' }}>
              Share your product requirements, estimated quantity, and project location.
              This section is designed to work as a practical quotation page for contractors,
              traders, and project buyers.
            </p>

            <div className="list-grid" style={{ marginTop: 24 }}>
              <div className="glass">
                <div className="section-label" style={{ color: '#bfd6ff', fontWeight: 700 }}>Company Information</div>
                <p style={{ marginTop: 18, lineHeight: 1.9 }}>
                  <strong>Company:</strong> GNG New Tech LLC<br />
                  <strong>Email:</strong> sales@gngnt.com<br />
                  <strong>Tel:</strong> 056 4480 245<br />
                  <strong>Location:</strong> International City, Dubai, UAE<br />
                  <strong>TRN:</strong> 100596621100003
                </p>
              </div>
              <div className="glass">
                <div className="section-label" style={{ color: '#bfd6ff', fontWeight: 700 }}>Inquiry Types</div>
                <div className="list-grid two" style={{ marginTop: 18 }}>
                  {['Product quotation', 'Project supply inquiry', 'Bulk purchase request', 'Rental requirement'].map((item) => (
                    <div key={item} className="box-soft" style={{ background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.15)', color: '#eef5ff' }}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="form-shell">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="section-label">Request a Quote</div>
                <div style={{ marginTop: 10, fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em' }}>Tell us what you need</div>
              </div>
              <div className="tag">Fast commercial response</div>
            </div>

            <form className="form-grid" style={{ marginTop: 24 }}>
              <input className="field" placeholder="Name" />
              <input className="field" placeholder="Company" />
              <input className="field" placeholder="Country" />
              <input className="field" placeholder="Phone / WhatsApp" />
              <input className="field" placeholder="Email" />
              <input className="field" placeholder="Product Needed" />
              <input className="field" placeholder="Quantity" />
              <input className="field" placeholder="Project Location" />
              <select className="field full" defaultValue="">
                <option value="" disabled>Purchase or Rental</option>
                <option>Purchase</option>
                <option>Rental</option>
              </select>
              <input className="field full" placeholder="Delivery Timeline / Required Date" />
              <textarea className="field full" placeholder="Message / Product Details" />
              <button type="submit" className="btn btn-primary full">Submit Inquiry</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
