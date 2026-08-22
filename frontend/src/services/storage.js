const K = {
  MERCHANT: 'vp_merchant',
  INVOICES: 'vp_invoices',
  CATALOG:  'vp_catalog',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Merchant ──────────────────────────────────────────────────────────────────
export function getMerchant() {
  return read(K.MERCHANT, null);
}

export function saveMerchant(merchant) {
  write(K.MERCHANT, merchant);
}

// ── Invoices ──────────────────────────────────────────────────────────────────
export function getInvoices() {
  return read(K.INVOICES, []);
}

export function getInvoice(id) {
  return getInvoices().find((inv) => inv.id === id) ?? null;
}

export function saveInvoice(invoice) {
  const list = getInvoices();
  const idx  = list.findIndex((i) => i.id === invoice.id);
  if (idx >= 0) list[idx] = invoice;
  else list.unshift(invoice);
  write(K.INVOICES, list);
}

export function generateInvoiceId() {
  const d   = new Date();
  const ds  = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${ds}-${rnd}`;
}

// ── Product catalog (auto-learned) ────────────────────────────────────────────
export function getCatalog() {
  return read(K.CATALOG, {});
}

export function learnFromItems(items) {
  const catalog = getCatalog();
  for (const item of items) {
    const key = item.name.toLowerCase().trim();
    catalog[key] = {
      name:      item.name,
      unit:      item.unit,
      lastPrice: item.pricePerUnit,
      lastSeen:  new Date().toISOString(),
      count:     (catalog[key]?.count ?? 0) + 1,
    };
  }
  write(K.CATALOG, catalog);
}

// ── Analytics helpers ─────────────────────────────────────────────────────────
export function getTodayStats() {
  const today = new Date().toDateString();
  const invoices = getInvoices();
  const todayInvoices = invoices.filter(
    (inv) => new Date(inv.date).toDateString() === today
  );
  const revenue = todayInvoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.subtotal, 0);
  const pending = todayInvoices
    .filter((i) => i.status === 'pending')
    .reduce((s, i) => s + i.subtotal, 0);
  return { revenue, pending, count: todayInvoices.length };
}

export function getTopProducts(limit = 5) {
  const catalog = getCatalog();
  return Object.values(catalog)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── URL-safe invoice encode / decode for customer sharing ─────────────────────
export function encodeInvoice(invoice) {
  return btoa(encodeURIComponent(JSON.stringify(invoice)));
}

export function decodeInvoice(encoded) {
  return JSON.parse(decodeURIComponent(atob(encoded)));
}
