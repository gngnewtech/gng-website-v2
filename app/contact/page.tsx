"use client";

import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const whatsappNumber = "971586009788";

    const text =
      `Hello GNG New Tech LLC,%0A%0A` +
      `I would like to send an inquiry.%0A%0A` +
      `Full Name: ${fullName || "-"}%0A` +
      `Company: ${company || "-"}%0A` +
      `Phone / WhatsApp: ${phone || "-"}%0A` +
      `Email: ${email || "-"}%0A` +
      `Product Needed: ${product || "-"}%0A` +
      `Quantity: ${quantity || "-"}%0A` +
      `Message: ${message || "-"}`;

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${text}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <main>
      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div className="badge">CONTACT US</div>
            <h1>Request a Quote</h1>
            <p className="section-lead">
              Send us your inquiry for scaffolding, formwork, plywood,
              accessories, or project supply support.
            </p>
          </div>

          <div className="contact-grid">
            <div className="contact-info-card">
              <div className="mini-title">COMPANY INFORMATION</div>
              <h2>GNG New Tech LLC</h2>
              <p>
                Reliable construction supply support for scaffolding systems,
                formwork materials, timber beams, plywood, accessories, and
                project-based supply coordination.
              </p>

              <div className="contact-info-list">
                <div className="contact-info-item">
                  <strong>Address</strong>
                  <span>A01, Shop 10, International City, Dubai, UAE</span>
                </div>

                <div className="contact-info-item">
                  <strong>Phone / WhatsApp</strong>
                  <span>+971 58 600 9788</span>
                </div>

                <div className="contact-info-item">
                  <strong>Email</strong>
                  <span>sales@gngnt.com</span>
                </div>

                <div className="contact-info-item">
                  <strong>Website</strong>
                  <span>www.gngnt.com</span>
                </div>

                <div className="contact-info-item">
                  <strong>TRN</strong>
                  <span>100596621100003</span>
                </div>
              </div>

              <div className="contact-note">
                <div className="mini-title">BUSINESS SUPPORT</div>
                <p>
                  We welcome inquiries for bulk supply, contractor orders,
                  project-based requests, and trading cooperation.
                </p>
              </div>
            </div>

            <div className="contact-form-card">
              <div className="mini-title">SEND INQUIRY</div>
              <h2>Tell us what you need</h2>

              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="name">Full Name</label>
                    <input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="company">Company</label>
                    <input
                      id="company"
                      type="text"
                      placeholder="Company name"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="phone">Phone / WhatsApp</label>
                    <input
                      id="phone"
                      type="text"
                      placeholder="Your mobile or WhatsApp"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="Your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="product">Product Needed</label>
                    <input
                      id="product"
                      type="text"
                      placeholder="Product name or category"
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="quantity">Quantity</label>
                    <input
                      id="quantity"
                      type="text"
                      placeholder="Required quantity"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field full-width">
                    <label htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      placeholder="Please describe your project requirement, product details, size, quantity, or delivery request."
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="cta">
                    Submit Inquiry via WhatsApp
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container cta-panel">
          <div>
            <div className="mini-title">FAST RESPONSE</div>
            <h2>Need faster communication?</h2>
            <p>
              Reach out to GNG New Tech LLC through WhatsApp or email for
              quotation requests and project supply discussions.
            </p>
          </div>

          <div className="cta-actions">
            <a
              href="https://wa.me/971586009788"
              target="_blank"
              rel="noreferrer"
              className="secondary-btn"
            >
              Open WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
