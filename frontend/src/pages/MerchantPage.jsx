import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VoiceBilling from '../components/VoiceBilling.jsx';
import Cart          from '../components/Cart.jsx';
import QRPayment     from '../components/QRPayment.jsx';
import {
  getMerchant,
  generateInvoiceId,
  saveInvoice,
  learnFromItems,
} from '../services/storage.js';

function Steps({ current }) {
  const steps = [
    { label: 'Bill', emoji: '🎙' },
    { label: 'Review', emoji: '📝' },
    { label: 'Pay', emoji: '💳' },
  ];
  return (
    <div className="flex items-center justify-center gap-1 py-3 bg-white" style={{ borderBottom: '1px solid #F0F2F5' }}>
      {steps.map(({ label, emoji }, i) => {
        const active = i === current;
        const done   = i < current;
        return (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 ${active ? 'opacity-100' : done ? 'opacity-80' : 'opacity-35'}`}>
              <div
                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center`}
                style={{
                  background: done ? '#00C853' : active ? '#00BAF2' : '#E8ECF0',
                  color: done || active ? '#fff' : '#9EA3B0',
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-semibold ${active ? 'text-[#00BAF2]' : done ? 'text-[#00C853]' : 'text-[#9EA3B0]'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-6 h-0.5 rounded-full mx-1" style={{ background: done ? '#00C853' : '#E8ECF0' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MerchantPage() {
  const navigate  = useNavigate();
  const merchant  = getMerchant();

  const [step, setStep]        = useState(0);
  const [parsed, setParsed]    = useState(null);
  const [transcript, setTrans] = useState('');
  const [invoice, setInvoice]  = useState(null);

  if (!merchant) { navigate('/setup'); return null; }

  const handleBillParsed = (result, text) => {
    setParsed(result);
    setTrans(text);
    setStep(1);
  };

  const handleCartConfirm = ({ items, subtotal, transcript: tx }) => {
    const inv = {
      id:            generateInvoiceId(),
      date:          new Date().toISOString(),
      shopName:      merchant.shopName,
      merchantUpiId: merchant.upiId,
      items,
      subtotal,
      status:        'pending',
      paymentTime:   null,
      transcript:    tx,
    };
    saveInvoice(inv);
    learnFromItems(items);
    setInvoice(inv);
    setStep(2);
  };

  const handlePaymentDone = () => {
    const updated = { ...invoice, status: 'paid', paymentTime: new Date().toISOString() };
    saveInvoice(updated);
    setInvoice(updated);
  };

  const handleNewBill = () => {
    setParsed(null);
    setTrans('');
    setInvoice(null);
    setStep(0);
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: '#F5F6FA' }}>
      {/* Paytm-style header */}
      <header className="paytm-header text-white px-4 pt-10 pb-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">
              V
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight">VaaniPay</h1>
              <p className="text-blue-100 text-xs">{merchant.shopName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-blue-200 font-medium">VOICE BILLING</p>
            <p className="text-xs text-white/80">🇮🇳 Any Language</p>
          </div>
        </div>
      </header>

      <Steps current={step} />

      <div className="flex-1 overflow-auto pb-24 max-w-md mx-auto w-full">
        {step === 0 && <VoiceBilling onBillParsed={handleBillParsed} />}
        {step === 1 && parsed && (
          <Cart
            parsed={parsed}
            transcript={transcript}
            onConfirm={handleCartConfirm}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && invoice && (
          <QRPayment
            invoice={invoice}
            merchant={merchant}
            onPaymentDone={handlePaymentDone}
            onNewBill={handleNewBill}
          />
        )}
      </div>
    </div>
  );
}
