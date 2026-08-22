import { useMemo, useState, useRef, useEffect } from 'react';
import { getInvoices, getTodayStats, getTopProducts, getMerchant, getCatalog } from '../services/storage.js';
import { chatWithAdvisor } from '../services/api.js';
import {
  TrendingUp, ShoppingBag, Clock, CheckCircle2,
  Package, MessageSquare, Send, X, Bot, Loader2
} from 'lucide-react';

const localDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

function buildSalesAnalysis(invoices) {
  const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    return localDateKey(date);
  });
  const daily = Object.fromEntries(dates.map((date) => [date, { revenue: 0, bills: 0 }]));
  const products = {};

  paidInvoices.forEach((invoice) => {
    const date = localDateKey(invoice.date);
    if (date && daily[date]) {
      daily[date].revenue += Number(invoice.subtotal) || 0;
      daily[date].bills += 1;
    }
    (invoice.items || []).forEach((item) => {
      const key = item.name?.trim() || 'Unknown item';
      const quantity = Number(item.quantity) || 0;
      const sales = Number(item.total) || quantity * (Number(item.pricePerUnit) || 0);
      products[key] = products[key] || { name: key, quantity: 0, revenue: 0 };
      products[key].quantity += quantity;
      products[key].revenue += sales;
    });
  });

  const sumPeriod = (period) => period.reduce((total, date) => total + daily[date].revenue, 0);
  const billPeriod = (period) => period.reduce((total, date) => total + daily[date].bills, 0);
  const previousDates = dates.slice(0, 7);
  const currentDates = dates.slice(7);
  const currentRevenue = sumPeriod(currentDates);
  const previousRevenue = sumPeriod(previousDates);
  const currentBills = billPeriod(currentDates);
  const previousBills = billPeriod(previousDates);
  const changePercent = previousRevenue
    ? Number((((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1))
    : null;

  return {
    comparison: {
      period: 'Last 7 calendar days vs previous 7 calendar days (paid invoices only)',
      currentRevenue,
      previousRevenue,
      revenueChange: currentRevenue - previousRevenue,
      revenueChangePercent: changePercent,
      currentBills,
      previousBills,
      billChange: currentBills - previousBills,
    },
    dailySales: dates.map((date) => ({ date, ...daily[date] })),
    topProductsByRevenue: Object.values(products).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
  };
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, gradient, icon: Icon }) {
  return (
    <div className="flex-1 rounded-2xl p-4 text-white relative overflow-hidden" style={{ background: gradient }}>
      <div className="absolute right-3 top-3 opacity-20">
        <Icon size={36} />
      </div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs font-semibold opacity-90 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] opacity-75 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Weekly bar chart ──────────────────────────────────────────────────────────
function WeeklyChart({ invoices }) {
  const days  = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();

  const data = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d  = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const ds = d.toDateString();
      const rev = invoices
        .filter((inv) => new Date(inv.date).toDateString() === ds && inv.status === 'paid')
        .reduce((s, inv) => s + inv.subtotal, 0);
      return { label: days[d.getDay()], rev, isToday: i === 6 };
    });
  }, [invoices]);

  const max = Math.max(...data.map((d) => d.rev), 1);

  return (
    <div className="paytm-card p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-800">Revenue — Last 7 Days</p>
        <p className="text-xs text-[#00BAF2] font-semibold">
          ₹{data.reduce((s, d) => s + d.rev, 0).toFixed(0)} total
        </p>
      </div>
      <div className="flex items-end gap-2 h-24">
        {data.map(({ label, rev, isToday }, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-lg transition-all"
              style={{
                height: `${(rev / max) * 80}px`,
                minHeight: rev > 0 ? 4 : 2,
                background: isToday
                  ? 'linear-gradient(180deg, #00BAF2, #0066CC)'
                  : rev > 0
                  ? 'linear-gradient(180deg, #B3E5FC, #81D4FA)'
                  : '#F0F2F5',
              }}
            />
            <p className={`text-[10px] font-semibold ${isToday ? 'text-[#00BAF2]' : 'text-[#9EA3B0]'}`}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Chat Drawer ────────────────────────────────────────────────────────────
function AIChatDrawer({ onClose, businessContext }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      isWelcome: true,
      content: `Namaste! 👋 I'm your VaaniPay business advisor.\n\nI can see your shop's data. Ask me anything:\n• "How is my business doing?"\n• "Should I increase the price of rice?"\n• "What's my best-selling product?"\n• "How can I earn more?"`,
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendText = async (text) => {
    if (!text?.trim() || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: text };
    // Keep every actual turn so the advisor can answer follow-up questions in context.
    const history = messages
      .filter((m) => !m.isWelcome)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const reply = await chatWithAdvisor(text, businessContext, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, couldn't reach the AI: ${err.message}` }]);
    }
    setLoading(false);
  };

  const send = () => sendText(input.trim());

  const quickTaps = [
    'Why are my sales down?',
    'How is my business doing?',
    'Should I increase any prices?',
    'What are my top-selling products?',
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="flex-1" onClick={onClose} />
      <div className="flex flex-col bg-white rounded-t-3xl shadow-2xl" style={{ height: '80vh', maxWidth: '100vw' }}>
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00BAF2, #0066CC)' }}>
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">AI Business Advisor</p>
              <p className="text-xs text-green-500 font-medium">● Online · Analyzing your data</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 shrink-0 mt-1"
                  style={{ background: 'linear-gradient(135deg, #00BAF2, #0066CC)' }}>
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div
                className="max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed"
                style={{
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #00BAF2, #0066CC)' : '#F5F6FA',
                  color: msg.role === 'user' ? '#fff' : '#1A1A2E',
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                  borderBottomLeftRadius:  msg.role === 'assistant' ? 4 : 16,
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #00BAF2, #0066CC)' }}>
                <Bot size={14} className="text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3 rounded-bl-sm">
                <Loader2 size={16} className="text-[#00BAF2] animate-spin" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions stay available after a reply; typing below continues the same chat. */}
        {!loading && (
          <div className="px-4 pt-2 flex gap-2 overflow-x-auto border-t border-gray-100">
            {quickTaps.map((question) => (
              <button
                key={question}
                onClick={() => sendText(question)}
                className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#0066CC] active:bg-blue-100"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 items-end">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendText(input.trim())}
            placeholder="Ask about your business…"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none"
            style={{ '--tw-ring-color': '#00BAF2' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #00BAF2, #0066CC)' }}
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const invoices    = getInvoices();
  const today       = getTodayStats();
  const topProducts = getTopProducts(5);
  const merchant    = getMerchant();
  const catalog     = getCatalog();
  const [showChat, setShowChat] = useState(false);

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.subtotal, 0);
  const pending      = invoices.filter((i) => i.status === 'pending');
  const pendingAmt   = pending.reduce((s, i) => s + i.subtotal, 0);
  const recent       = invoices.slice(0, 15);

  // Build business context for AI
  const businessContext = useMemo(() => ({
    merchant: { shopName: merchant?.shopName, ownerName: merchant?.ownerName },
    summary: {
      totalRevenue,
      totalBills: invoices.length,
      paidBills: invoices.filter((i) => i.status === 'paid').length,
      pendingAmount: pendingAmt,
      pendingBills: pending.length,
      todayRevenue: today.revenue,
      todayBills: today.count,
    },
    topProducts: topProducts.slice(0, 8),
    recentInvoices: recent.slice(0, 10).map((inv) => ({
      id: inv.id,
      date: inv.date,
      subtotal: inv.subtotal,
      status: inv.status,
      itemCount: inv.items.length,
      items: inv.items.map((it) => ({ name: it.name, qty: it.quantity, price: it.pricePerUnit, unit: it.unit })),
    })),
    salesAnalysis: buildSalesAnalysis(invoices),
    catalog: Object.values(catalog).slice(0, 20),
  }), [invoices]);

  if (invoices.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F5F6FA' }}>
        <header className="paytm-header text-white px-4 pt-10 pb-5">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black">Dashboard</h1>
              <p className="text-blue-100 text-xs">Your business at a glance</p>
            </div>
            <button
              onClick={() => setShowChat(true)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-2"
            >
              <Bot size={16} className="text-white" />
              <span className="text-white text-xs font-semibold">AI Advisor</span>
            </button>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center pb-24">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
            <TrendingUp size={36} className="text-gray-300" />
          </div>
          <p className="text-gray-600 font-bold text-lg">No bills yet</p>
          <p className="text-gray-400 text-sm">Create your first bill to see analytics and get AI business advice here.</p>
        </div>
        {/* Floating AI button even on empty state */}
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-xl flex items-center justify-center z-40 transition-transform active:scale-95"
          style={{ background: 'linear-gradient(135deg, #00BAF2, #0066CC)', boxShadow: '0 4px 20px rgba(0,186,242,0.4)' }}
        >
          <Bot size={24} className="text-white" />
        </button>
        {showChat && (
          <AIChatDrawer onClose={() => setShowChat(false)} businessContext={businessContext} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: '#F5F6FA' }}>
      {/* Header */}
      <header className="paytm-header text-white px-4 pt-10 pb-5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black">Dashboard</h1>
            <p className="text-blue-100 text-xs">{invoices.length} total bills · {merchant?.shopName}</p>
          </div>
          {/* AI chat button in header */}
          <button
            onClick={() => setShowChat(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-3 py-2"
          >
            <Bot size={16} className="text-white" />
            <span className="text-white text-xs font-semibold">AI Advisor</span>
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4 max-w-md mx-auto w-full">

        {/* Today stats */}
        <div>
          <p className="text-[11px] font-bold text-[#9EA3B0] uppercase tracking-wider mb-2">Today</p>
          <div className="flex gap-3">
            <StatCard
              label="Revenue"
              value={`₹${today.revenue.toFixed(0)}`}
              gradient="linear-gradient(135deg, #00BAF2, #0066CC)"
              icon={TrendingUp}
            />
            <StatCard
              label="Bills Created"
              value={today.count}
              gradient="linear-gradient(135deg, #7B5CF0, #4C1D95)"
              icon={ShoppingBag}
            />
          </div>
        </div>

        {/* All-time stats */}
        <div>
          <p className="text-[11px] font-bold text-[#9EA3B0] uppercase tracking-wider mb-2">All Time</p>
          <div className="flex gap-3">
            <StatCard
              label="Total Earned"
              value={`₹${totalRevenue.toFixed(0)}`}
              gradient="linear-gradient(135deg, #00C853, #00897B)"
              icon={CheckCircle2}
            />
            <StatCard
              label="Pending"
              value={`₹${pendingAmt.toFixed(0)}`}
              sub={`${pending.length} bill${pending.length !== 1 ? 's' : ''}`}
              gradient="linear-gradient(135deg, #FF9800, #E65100)"
              icon={Clock}
            />
          </div>
        </div>

        {/* Weekly chart */}
        <WeeklyChart invoices={invoices} />

        {/* AI advisor promo card */}
        <button
          onClick={() => setShowChat(true)}
          className="w-full rounded-2xl p-4 text-left flex items-center gap-4 active:scale-98 transition-transform"
          style={{ background: 'linear-gradient(135deg, #1A1A2E, #16213E)' }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #00BAF2, #0066CC)' }}>
            <Bot size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Ask AI Business Advisor</p>
            <p className="text-gray-400 text-xs mt-0.5">Should I raise prices? How's my business doing?</p>
          </div>
          <MessageSquare size={18} className="text-[#00BAF2]" />
        </button>

        {/* Top products */}
        {topProducts.length > 0 && (
          <div className="paytm-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={16} className="text-[#00BAF2]" />
              <p className="text-sm font-bold text-gray-800">Top Products</p>
            </div>
            <div className="flex flex-col gap-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#E8ECF0', color: i < 3 ? '#1A1A2E' : '#9EA3B0' }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.count}x sold · ₹{p.lastPrice}/{p.unit}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg px-2 py-1">
                    <p className="text-xs font-bold text-[#00BAF2]">₹{p.lastPrice}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent invoices */}
        <div className="paytm-card p-4">
          <p className="text-sm font-bold text-gray-800 mb-3">Recent Bills</p>
          <div className="flex flex-col">
            {recent.map((inv, idx) => (
              <div
                key={inv.id}
                className="flex justify-between items-center py-3"
                style={{ borderTop: idx > 0 ? '1px solid #F5F6FA' : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: inv.status === 'paid' ? '#E8F5E9' : '#FFF3E0' }}>
                    {inv.status === 'paid'
                      ? <CheckCircle2 size={18} className="text-green-600" />
                      : <Clock size={18} style={{ color: '#FF9800' }} />
                    }
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">{inv.id}</p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(inv.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      {' · '}{inv.items.length} item{inv.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-900">₹{inv.subtotal.toFixed(0)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {inv.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating AI chat button */}
      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-xl flex items-center justify-center z-40 transition-transform active:scale-95"
        style={{ background: 'linear-gradient(135deg, #00BAF2, #0066CC)', boxShadow: '0 4px 20px rgba(0,186,242,0.4)' }}
      >
        <Bot size={24} className="text-white" />
      </button>

      {/* AI Chat Drawer */}
      {showChat && (
        <AIChatDrawer onClose={() => setShowChat(false)} businessContext={businessContext} />
      )}
    </div>
  );
}
