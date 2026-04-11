import Link from 'next/link';

const products = [
  'Scaffolding Systems',
  'Formwork Systems',
  'H20 Timber Beam',
  'Plywood & Boards',
  'Accessories',
  'Project Supply Support',
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="badge">Dubai-based construction supplier</div>
            <h1 className="h1">Reliable Scaffolding &amp; Formwork Supply for Construction Projects</h1>
            <p className="lead">
              GNG New Tech LLC supplies scaffolding systems, formwork materials, timber beams,
              plywood, accessories, and related construction products for contractors, traders,
              and project buyers across the UAE, Middle East, and Africa.
            </p>
            <div className="pills">
              <div className="pill">International City</div>
              <div className="pill">Dubai, United Arab Emirates</div>
              <div className="pill">TRN Verified Business</div>
            </div>
            <div className="actions">
              <Link href="/contact" className="cta">Request a Quote</Link>
              <Link href="/products" className="cta secondary">View Products</Link>
            </div>
          </div>
          <div className="panel">
            <div className="inner-panel">
              <div className="cards4">
                <div className="small-card"><div className="eyebrow">Positioning</div><h3>Construction supply specialist</h3></div>
                <div className="small-card"><div className="eyebrow">Audience</div><h3>Contractors &amp; project buyers</h3></div>
                <div className="small-card"><div className="eyebrow">Style</div><h3>Blue-gray corporate identity</h3></div>
                <div className="small-card"><div className="eyebrow">Goal</div><h3>More quote-ready inquiries</h3></div>
              </div>
              <div className="small-card" style={{ marginTop: 16 }}>
                <div className="eyebrow" style={{ color: '#1f5fbf' }}>Corporate presentation</div>
                <p className="muted" style={{ marginBottom: 0 }}>
                  This website follows a cleaner blue-gray company style inspired by GNG’s official document layout,
                  creating a more consistent brand image across website, invoices, and company paperwork.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="white" style={{ borderTop: '1px solid #dde5f0', borderBottom: '1px solid #dde5f0' }}>
        <div className="container section" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <div className="grid-4">
            {['Dubai-based company', 'Construction material focus', 'Quotation-oriented website', 'Professional business presentation'].map((item) => (
              <div className="soft-card" key={item}>{item}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="section white">
        <div className="container two-col">
          <div>
            <div className="eyebrow" style={{ color: '#1f5fbf' }}>About GNG</div>
            <h2 className="title2">A stronger website identity aligned with official company documents</h2>
            <p className="muted">
              GNG New Tech LLC is a Dubai-based construction supply company serving contractors, traders,
              and project buyers with scaffolding systems, formwork materials, timber beams, plywood,
              accessories, and practical supply support.
            </p>
          </div>
          <div className="card">
            <div className="grid-2">
              {['Dubai-based company presentation', 'Construction material supply focus', 'Professional quotation support', 'Clearer B2B communication'].map((x) => (
                <div className="soft-card" key={x}>{x}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section soft">
        <div className="container">
          <div className="eyebrow" style={{ color: '#1f5fbf' }}>Products</div>
          <h2 className="title2">Main Product Categories</h2>
          <div className="grid-3">
            {products.map((item) => (
              <div className="card" key={item}>
                <div className="eyebrow">Category</div>
                <h3>{item}</h3>
                <p className="muted">Professional presentation page with cleaner English, stronger B2B wording, and better inquiry flow.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section white">
        <div className="container blue-band">
          <div className="two-col" style={{ alignItems: 'start' }}>
            <div>
              <div className="eyebrow" style={{ color: '#bfdbfe' }}>Corporate Information</div>
              <h2 style={{ fontSize: 34, margin: '12px 0 14px' }}>A company presentation style aligned with invoices and official documents</h2>
              <p style={{ color: 'rgba(255,255,255,.9)', lineHeight: 1.9 }}>
                The updated website direction reflects the same professional identity used in company paperwork,
                helping GNG look more credible, more established, and more commercially prepared.
              </p>
            </div>
            <div className="info-box info-list">
              <div><strong>Company:</strong> GNG New Tech LLC</div>
              <div><strong>Email:</strong> sales@gngnt.com</div>
              <div><strong>Tel:</strong> 056 4480 245</div>
              <div><strong>Location:</strong> International City, Dubai, UAE</div>
              <div><strong>TRN:</strong> 100596621100003</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
