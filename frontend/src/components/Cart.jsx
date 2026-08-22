import { useState } from 'react';
import { Trash2, Plus, AlertCircle, ChevronRight } from 'lucide-react';

const BLANK_ITEM = { name: '', quantity: 1, unit: 'pcs', pricePerUnit: 0, total: 0 };

function ItemRow({ item, index, onChange, onDelete }) {
  const update = (field, raw) => {
    const val  = field === 'name' || field === 'unit' ? raw : parseFloat(raw) || 0;
    const next = { ...item, [field]: val };
    if (field === 'quantity' || field === 'pricePerUnit') {
      next.total = next.quantity * next.pricePerUnit;
    }
    onChange(index, next);
  };

  return (
    <div className="paytm-card p-3">
      <input
        value={item.name}
        onChange={(e) => update('name', e.target.value)}
        placeholder="Item name"
        className="w-full text-sm font-bold text-gray-800 pb-2 mb-2 focus:outline-none"
        style={{ borderBottom: '1px solid #F0F2F5' }}
      />
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <p className="text-[10px] text-[#9EA3B0] mb-0.5 font-semibold">QTY</p>
          <input
            type="number" inputMode="decimal" value={item.quantity}
            onChange={(e) => update('quantity', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#00BAF2' }}
          />
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-[#9EA3B0] mb-0.5 font-semibold">UNIT</p>
          <select
            value={item.unit}
            onChange={(e) => update('unit', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#00BAF2' }}
          >
            {['pcs', 'kg', 'g', 'litre', 'ml', 'packet', 'dozen', 'bottle'].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-[#9EA3B0] mb-0.5 font-semibold">PRICE ₹</p>
          <input
            type="number" inputMode="decimal" value={item.pricePerUnit}
            onChange={(e) => update('pricePerUnit', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#00BAF2' }}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-xs font-black text-[#00BAF2]">₹{item.total.toFixed(0)}</p>
          <button onClick={() => onDelete(index)} className="p-1 text-red-400 active:text-red-600">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Cart({ parsed, transcript, onConfirm, onBack }) {
  const [items, setItems]   = useState(
    (parsed?.items ?? []).map((it) => ({ ...it, total: it.total ?? it.quantity * it.pricePerUnit }))
  );
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ ...BLANK_ITEM });

  const subtotal = items.reduce((s, i) => s + i.total, 0);

  const updateItem = (idx, updated) => setItems((prev) => prev.map((it, i) => (i === idx ? updated : it)));
  const deleteItem = (idx)          => setItems((prev) => prev.filter((_, i) => i !== idx));

  const addItem = () => {
    if (!newItem.name.trim() || newItem.pricePerUnit <= 0) return;
    setItems((prev) => [...prev, { ...newItem, total: newItem.quantity * newItem.pricePerUnit }]);
    setNewItem({ ...BLANK_ITEM });
    setShowAdd(false);
  };

  const handleConfirm = () => {
    if (items.length === 0) return;
    onConfirm({ items, subtotal, transcript });
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-4 pb-36">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[#00BAF2] text-sm font-bold">← Re-record</button>
        <p className="text-gray-400 text-sm">{items.length} item{items.length !== 1 ? 's' : ''}</p>
      </div>

      {parsed?.unclear?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-700 mb-1">Please review:</p>
            {parsed.unclear.map((u, i) => <p key={i} className="text-xs text-amber-600">• {u}</p>)}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item, idx) => (
          <ItemRow key={idx} item={item} index={idx} onChange={updateItem} onDelete={deleteItem} />
        ))}
      </div>

      {showAdd ? (
        <div className="paytm-card p-4 border-2" style={{ borderColor: '#00BAF2' }}>
          <p className="text-sm font-bold text-gray-800 mb-3">Add item</p>
          <input
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            placeholder="Item name"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#00BAF2' }}
          />
          <div className="flex gap-2 mb-3">
            <input type="number" inputMode="decimal" placeholder="Qty"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
              className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none"
            />
            <input type="number" inputMode="decimal" placeholder="Price ₹"
              value={newItem.pricePerUnit || ''}
              onChange={(e) => setNewItem({ ...newItem, pricePerUnit: parseFloat(e.target.value) || 0 })}
              className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 border border-gray-300 py-2.5 rounded-xl text-sm text-gray-600 font-semibold">Cancel</button>
            <button onClick={addItem} className="flex-1 paytm-btn py-2.5 rounded-xl text-sm">Add</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 active:border-[#00BAF2] active:text-[#00BAF2] transition-colors"
        >
          <Plus size={16} /> Add item manually
        </button>
      )}

      {/* Fixed bottom */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-10" style={{ background: '#F5F6FA', borderTop: '1px solid #E8ECF0', paddingTop: 12 }}>
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-3">
            <p className="text-gray-600 font-semibold">Bill Total</p>
            <p className="text-2xl font-black text-gray-900">₹{subtotal.toFixed(2)}</p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={items.length === 0}
            className="w-full paytm-btn py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-40"
          >
            Generate Payment QR <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
