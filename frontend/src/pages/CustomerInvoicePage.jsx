import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decodeInvoice } from '../services/storage.js';
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';

export default function CustomerInvoicePage() {
  const [params] = useSearchParams();
  const encoded  = params.get('data');

  const invoice = useMemo(() => {
    if (!encoded) return null;
    try { return decodeInvoice(encoded); }
    catch { return null; }
  }, [encoded]);

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <XCircle size={48} className="text-red-400" />
        <h1 className="text-xl font-bold text-gray-800">Invoice Not Found</h1>
        <p className="text-gray-500 text-sm">The link may be expired or invalid.</p>
      </div>
    );
  }

  const upiUrl = `upi://pay?pa=${encodeURIComponent(invoice.merchantUpiId)}&pn=${encodeURIComponent(invoice.shopName)}&am=${invoice.subtotal.toFixed(2)}&tn=${encodeURIComponent(invoice.id)}&cu=INR`;

  const formattedDate = new Date(invoice.date).toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 pt-12 pb-6">
        <p className="text-blue-200 text-xs mb-1">Invoice from</p>
        <h1 className="text-xl font-bold">{invoice.shopName}</h1>
        <p className="text-blue-200 text-xs mt-0.5">{formattedDate}</p>
      </div>

      <div className="px-4 py-6 flex flex-col gap-4">

        {/* Status badge */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">{invoice.id}</p>
          <span className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full ${
            invoice.status === 'paid'
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {invoice.status === 'paid' ? (
              <><CheckCircle size={12} /> Paid</>
            ) : (
              <>⏳ Payment Pending</>
            )}
          </span>
        </div>

        {/* Receipt card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Items */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Items</p>
            <div className="flex flex-col gap-3">
              {invoice.items.map((item, i) => (
                <div key={i} className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      {item.quantity} {item.unit} × ₹{item.pricePerUnit.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">₹{item.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex justify-between items-center">
            <p className="font-bold text-gray-800">Total</p>
            <p className="text-2xl font-bold text-blue-600">₹{invoice.subtotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Pay button */}
        {invoice.status !== 'paid' && (
          <a
            href={upiUrl}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
          >
            Pay ₹{invoice.subtotal.toFixed(2)} with Paytm
            <ExternalLink size={18} />
          </a>
        )}

        {invoice.status === 'paid' && (
          <div className="w-full bg-green-50 border border-green-200 text-green-700 py-4 rounded-2xl text-center font-semibold flex items-center justify-center gap-2">
            <CheckCircle size={20} /> Payment Completed
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 mt-2">
          Powered by VaaniPay · AI Voice Billing
        </p>
      </div>
    </div>
  );
}
