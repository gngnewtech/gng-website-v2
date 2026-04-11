export default function ContactPage() {
  return (
    <main className="contact-wrap section">
      <div className="container two-col" style={{ alignItems: 'start' }}>
        <div>
          <div className="eyebrow" style={{ color: '#bfdbfe' }}>Contact Us</div>
          <h1 className="title2" style={{ color: 'white' }}>Send us your inquiry or quotation request</h1>
          <p style={{ color: 'rgba(255,255,255,.9)', lineHeight: 1.9, fontSize: 20 }}>
            Share your product requirements, estimated quantity, and project location.
            This section is designed to work as a practical quotation page for contractors,
            traders, and project buyers.
          </p>
          <div className="info-box info-list" style={{ marginTop: 24 }}>
            <div><strong>Company:</strong> GNG New Tech LLC</div>
            <div><strong>Email:</strong> sales@gngnt.com</div>
            <div><strong>Tel:</strong> 056 4480 245</div>
            <div><strong>Location:</strong> International City, Dubai, UAE</div>
            <div><strong>TRN:</strong> 100596621100003</div>
          </div>
        </div>
        <div className="contact-card">
          <div className="eyebrow" style={{ color: '#1f5fbf' }}>Request a Quote</div>
          <h2 style={{ fontSize: 34, marginTop: 10 }}>Tell us what you need</h2>
          <div className="form-grid">
            {['Name', 'Company', 'Country', 'Phone / WhatsApp', 'Email', 'Product Needed', 'Quantity', 'Project Location'].map((field) => (
              <div className="input" key={field}>{field}</div>
            ))}
            <div className="input full">Purchase or Rental</div>
            <div className="input full">Delivery Timeline / Required Date</div>
            <div className="input full" style={{ minHeight: 120 }}>Message / Product Details</div>
            <a className="cta" href="mailto:sales@gngnt.com" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>Contact by Email</a>
          </div>
        </div>
      </div>
    </main>
  );
}
