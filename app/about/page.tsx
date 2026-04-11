export default function AboutPage() {
  return (
    <main className="section white">
      <div className="container">
        <div className="eyebrow" style={{ color: '#1f5fbf' }}>About</div>
        <h1 className="title2">About GNG New Tech LLC</h1>
        <div className="grid-2">
          <div className="card">
            <h3>Who We Are</h3>
            <p className="muted">
              GNG New Tech LLC is a Dubai-based construction supply company serving contractors,
              traders, and project buyers with practical product supply support.
            </p>
            <h3>What We Supply</h3>
            <p className="muted">
              Scaffolding systems, formwork materials, timber beams, plywood, accessories,
              and related construction products.
            </p>
          </div>
          <div className="card">
            <h3>Markets We Serve</h3>
            <p className="muted">United Arab Emirates, Middle East, Africa, contractors, project buyers, and trading customers.</p>
            <h3>Service Approach</h3>
            <p className="muted">Clear communication, quotation readiness, and a cleaner B2B process that helps buyers understand what we supply and how to contact us quickly.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
