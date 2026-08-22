import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Share2, RotateCcw, Copy, ExternalLink } from 'lucide-react';
import { encodeInvoice } from '../services/storage.js';

export default function QRPayment({ invoice, merchant, onPaymentDone, onNewBill }) {
  const [paid, setPaid] = useState(invoice.status === 'paid');
  const [copied, setCopied] = useState(false);

  const upiUrl = `upi://pay?pa=${encodeURIComponent(merchant.upiId)}&pn=${encodeURIComponent(merchant.shopName)}&am=${invoice.subtotal.toFixed(2)}&tn=${encodeURIComponent(invoice.id)}&cu=INR`;

  const shareUrl = `${window.location.origin}/invoice?data=${encodeInvoice(invoice)}`;

  const handleMarkPaid = () => {
    setPaid(true);
    onPaymentDone();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: `Invoice ${invoice.id}`, url: shareUrl }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-6 pb-28">

      {/* Invoice summary */}
      <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="font-bold text-gray-800">{merchant.shopName}</p>
            <p className="text-xs text-gray-400">{invoice.id}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">₹{invoice.subtotal.toFixed(2)}</p>
            <p className="text-xs text-gray-400">{invoice.items.length} items</p>
          </div>
        </div>

        {/* Items mini list */}
        <div className="border-t border-gray-100 pt-2 space-y-1">
          {invoice.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>{item.name} × {item.quantity} {item.unit}</span>
              <span>₹{item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {!paid ? (
        <>
          {/* UPI QR */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-semibold text-gray-600">Scan to Pay via Paytm / UPI</p>
            <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100">
              <QRCodeSVG
                value={upiUrl}
                size={220}
                level="M"
                includeMargin={false}
                fgColor="#1e3a5f"
              />
            </div>
            <p className="text-xs text-gray-400">UPI ID: {merchant.upiId}</p>
          </div>

          {/* Mark paid buttons */}
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleMarkPaid}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-transform"
            >
              ✅ Mark Payment Received
            </button>
            <p className="text-center text-xs text-gray-400">
              Tap after payment confirmation or for cash payments
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Paid state */}
          <div className="flex flex-col items-center gap-1">
            <CheckCircle size={56} className="text-green-500" />
            <p className="text-xl font-bold text-green-700">Payment Received!</p>
            <p className="text-sm text-gray-500">₹{invoice.subtotal.toFixed(2)} – {invoice.id}</p>
          </div>

          {/* Customer invoice QR */}
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-sm font-semibold text-gray-600">Share Invoice with Customer</p>
            <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100">
              <QRCodeSVG
                value={shareUrl}
                size={200}
                level="M"
                includeMargin={false}
                fgColor="#1e3a5f"
              />
            </div>
            <p className="text-xs text-gray-400 text-center">Customer scans to view their invoice</p>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm"
              >
                <Share2 size={16} />
                {copied ? 'Copied!' : 'Share Link'}
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1 border border-gray-300 px-4 py-3 rounded-xl text-gray-600 text-sm"
              >
                <Copy size={15} />
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center border border-gray-300 px-4 py-3 rounded-xl text-gray-600"
              >
                <ExternalLink size={15} />
              </a>
            </div>
          </div>

          {/* New bill */}
          <button
            onClick={onNewBill}
            className="flex items-center gap-2 text-blue-600 font-semibold py-3"
          >
            <RotateCcw size={18} /> Start New Bill
          </button>
        </>
      )}
    </div>
  );
}
