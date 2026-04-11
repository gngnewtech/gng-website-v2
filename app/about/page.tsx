export default function AboutPage() {
  return (
    <main>
      <section className="hero page-hero">
        <div className="container" style={{ padding: '84px 0 90px', position: 'relative' }}>
          <div className="badge">About GNG</div>
          <h1>A company presentation aligned with official documents and real business needs</h1>
          <p className="lead">
            GNG New Tech LLC is a Dubai-based construction supply company serving contractors,
            traders, and project buyers with scaffolding systems, formwork materials, timber beams,
            plywood, accessories, and practical project support.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div className="box">
            <div className="section-label">Who We Are</div>
            <p className="section-copy">
              We present GNG as a reliable B2B supplier with a clean corporate identity, practical communication,
              and quotation-ready service for the UAE and surrounding regional market.
            </p>
          </div>
          <div className="box">
            <div className="section-label">What We Supply</div>
            <div className="list-grid two" style={{ marginTop: 18 }}>
              {['Scaffolding Systems', 'Formwork Materials', 'H20 Timber Beam', 'Plywood & Boards', 'Accessories', 'Project Supply Support'].map((item) => (
                <div key={item} className="box-soft">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container two-col">
          <div>
            <div className="section-label">Our Service Approach</div>
            <h2>Clearer B2B communication and stronger commercial presentation</h2>
            <p className="section-copy">
              We focus on helping buyers understand what GNG supplies, how to contact us quickly,
              and how to submit quotation requests in a more practical and professional way.
            </p>
          </div>
          <div className="list-grid">
            {[
              'Professional quotation support',
              'Construction material supply focus',
              'Responsive communication',
              'Consistent corporate identity',
            ].map((item) => <div key={item} className="box-soft">{item}</div>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container box" style={{ background: 'linear-gradient(135deg, #183862 0%, #234b85 100%)', color: 'white', borderColor: 'transparent' }}>
          <div className="two-col">
            <div>
              <div className="section-label" style={{ color: '#bfd6ff' }}>Corporate Information</div>
              <h2 style={{ color: 'white' }}>A style consistent with invoices and official company paperwork</h2>
              <p className="section-copy" style={{ color: 'rgba(235,244,255,0.92)' }}>
                The updated website direction reflects the same blue-gray professional identity used in company documents,
                helping GNG look more credible, more established, and more commercially prepared.
              </p>
            </div>
            <div className="glass">
              <p style={{ lineHeight: 1.9 }}>
                <strong>Company:</strong> GNG New Tech LLC<br />
                <strong>Email:</strong> sales@gngnt.com<br />
                <strong>Tel:</strong> 056 4480 245<br />
                <strong>Location:</strong> International City, Dubai, UAE<br />
                <strong>TRN:</strong> 100596621100003
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
