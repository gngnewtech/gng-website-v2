export default function ContactPage() {
  return (
    <main>
      <section className="section contact-shell" style={{ paddingTop: 84, paddingBottom: 90 }}>
        <div className="container contact-grid">
          <div>
            <div className="section-label" style={{ color: '#bfd6ff' }}>Contact Us</div>
            <h1 style={{ color: 'white' }}>Send us your inquiry or quotation request</h1>
            <p className="lead" style={{ color: 'rgba(235,244,255,0.92)' }}>
              Share your product requirements, estimated quantity, delivery timeline,
              and project location. This page is designed as a practical quotation page
              for contractors, traders, and project buyers.
            </p>

            <div className="list-grid" style={{ marginTop: 28 }}>
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
