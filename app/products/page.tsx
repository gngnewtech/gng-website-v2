const items = [
  'Scaffolding Systems',
  'Formwork Systems',
  'H20 Timber Beam',
  'Plywood & Boards',
  'Accessories',
  'Project Supply Support',
];

export default function ProductsPage() {
  return (
    <main className="section soft">
      <div className="container">
        <div className="eyebrow" style={{ color: '#1f5fbf' }}>Products</div>
        <h1 className="title2">Construction Supply Categories</h1>
        <div className="grid-3">
          {items.map((item) => (
            <div className="card" key={item}>
              <div className="eyebrow">Category</div>
              <h3>{item}</h3>
              <p className="muted">Designed as a strong B2B presentation section for future product detail expansion.</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
