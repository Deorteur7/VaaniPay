import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, CreditCard, User, Phone, ChevronRight } from 'lucide-react';
import { getMerchant, saveMerchant } from '../services/storage.js';

function Field({ icon: Icon, label, required, ...props }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00BAF2]" />
        <input
          {...props}
          className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 bg-white transition-shadow"
          style={{ '--tw-ring-color': '#00BAF2' }}
        />
      </div>
    </div>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const existing = getMerchant();

  const [form, setForm] = useState({
    shopName:  existing?.shopName  ?? '',
    ownerName: existing?.ownerName ?? '',
    upiId:     existing?.upiId     ?? '',
    phone:     existing?.phone     ?? '',
  });
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = () => {
    if (!form.shopName.trim())       { setError('Shop name is required'); return; }
    if (!form.upiId.trim())          { setError('UPI ID is required for payment QR'); return; }
    if (!form.upiId.includes('@'))   { setError('UPI ID must contain @ (e.g. myshop@paytm)'); return; }
    saveMerchant({ ...form, createdAt: existing?.createdAt ?? new Date().toISOString() });
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5F6FA' }}>
      {/* Paytm-style header */}
      <div className="paytm-header text-white px-4 pt-12 pb-10">
        <div className="max-w-md mx-auto">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black">
            {existing ? 'Update Shop' : 'Setup Your Shop'}
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            {existing ? 'Update your shop details below.' : 'One-time setup. Change anytime from Settings.'}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 px-4 -mt-4 max-w-md mx-auto w-full">
        <div className="paytm-card p-5 flex flex-col gap-4">
          <Field
            icon={Store}
            label="Shop Name"
            required
            placeholder="e.g. Ram General Store"
            value={form.shopName}
            onChange={set('shopName')}
          />
          <Field
            icon={User}
            label="Owner Name"
            placeholder="e.g. Ramesh Kumar"
            value={form.ownerName}
            onChange={set('ownerName')}
          />
          <Field
            icon={CreditCard}
            label="UPI ID"
            required
            placeholder="e.g. ramstore@paytm"
            value={form.upiId}
            onChange={set('upiId')}
            inputMode="email"
            autoCapitalize="none"
          />
          <Field
            icon={Phone}
            label="Phone (optional)"
            placeholder="e.g. 9876543210"
            value={form.phone}
            onChange={set('phone')}
            type="tel"
            inputMode="numeric"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="rounded-xl p-4 text-sm" style={{ background: '#E8F9FF' }}>
            <p className="font-bold text-[#0066CC] mb-1">💡 About UPI ID</p>
            <p className="text-xs text-blue-700">
              Find it in Paytm → Profile → UPI ID. Format: name@paytm or number@upi
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-4 pb-8 pt-4 max-w-md mx-auto w-full">
        <button
          onClick={handleSave}
          className="w-full paytm-btn py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg"
        >
          {existing ? 'Save Changes' : 'Start Billing'}
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
