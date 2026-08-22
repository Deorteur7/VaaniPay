import { useState, useRef } from 'react';
import { Mic, MicOff, Loader2, Camera, X, ImagePlus } from 'lucide-react';
import { speechToText, ocrImage, parseBill } from '../services/api.js';
import { getCatalog } from '../services/storage.js';

function getBestMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export default function VoiceBilling({ onBillParsed }) {
  const [mode, setMode]         = useState(null); // null | 'speak' | 'scan'
  const [status, setStatus]     = useState('idle'); // idle | recording | processing
  const [transcript, setTrans]  = useState('');
  const [error, setError]       = useState('');
  const [previewUrl, setPreview] = useState(null);
  const [detectedLang, setDetectedLang] = useState('');

  const recorderRef  = useRef(null);
  const chunksRef    = useRef([]);
  const startedAtRef = useRef(null);
  const discardRef   = useRef(false);
  const fileInputRef = useRef(null);
  const cameraRef    = useRef(null);

  // ── Voice recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    setError('');
    setTrans('');
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestMimeType();
      const opts     = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, opts);
      chunksRef.current  = [];
      startedAtRef.current = Date.now();
      discardRef.current = false;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (discardRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        await processSpeech(blob);
      };

      recorder.start(100);
      recorderRef.current = recorder;
      setStatus('recording');
    } catch {
      setError('Microphone access denied. Please allow microphone permission and try again.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      const duration = Date.now() - startedAtRef.current;
      if (duration > 30_000) {
        discardRef.current = true;
        recorderRef.current.stop();
        setError('Please keep each recording under 30 seconds.');
        setStatus('idle');
        return;
      }
      recorderRef.current.stop();
      setStatus('processing');
    }
  };

  // ── Process speech — auto-detects language ──────────────────────────────────
  const processSpeech = async (blob) => {
    try {
      setStatus('processing');
      // Pass 'unknown' — Sarvam auto-detects Indian language
      const result = await speechToText(blob, 'unknown');
      const text   = result.transcript || result;
      const lang   = result.languageCode || '';
      setTrans(typeof text === 'string' ? text : '');
      if (lang) setDetectedLang(lang);

      if (!text?.trim()) {
        setError('Could not understand the audio. Please speak clearly and try again.');
        setStatus('idle');
        return;
      }
      await parseAndReturn(typeof text === 'string' ? text : String(text));
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  // ── OCR from scanned image ──────────────────────────────────────────────────
  const handleImageSelected = async (file) => {
    if (!file) return;
    setError('');
    setTrans('');
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStatus('processing');
    try {
      const text = await ocrImage(file);
      setTrans(text);
      if (!text?.trim()) {
        setError('Could not read the image. Please ensure the writing is clear and well-lit.');
        setStatus('idle');
        return;
      }
      await parseAndReturn(text);
    } catch (err) {
      setError(err.message || 'OCR failed. Please try again.');
      setStatus('idle');
    }
  };

  const parseAndReturn = async (text) => {
    setStatus('processing');
    const catalog = getCatalog();
    const result  = await parseBill(text, catalog);
    setStatus('idle');
    onBillParsed(result, text);
  };

  const reset = () => {
    setMode(null);
    setStatus('idle');
    setTrans('');
    setError('');
    setPreview(null);
    setDetectedLang('');
  };

  // ── Mode chooser ─────────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-8">
        <div className="text-center mb-2">
          <p className="text-gray-500 text-sm">How would you like to add your bill?</p>
        </div>
        <div className="w-full flex gap-4">
          {/* Speak */}
          <button
            onClick={() => setMode('speak')}
            className="flex-1 flex flex-col items-center gap-3 bg-white rounded-2xl p-6 shadow-sm border-2 border-transparent active:border-[#00BAF2] transition-all"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00BAF2, #0066CC)' }}>
              <Mic className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-800 text-sm">Speak</p>
              <p className="text-xs text-gray-400 mt-0.5">Say your bill aloud</p>
              <p className="text-xs text-[#00BAF2] mt-1">🇮🇳 Any Indian language</p>
            </div>
          </button>

          {/* Scan */}
          <button
            onClick={() => setMode('scan')}
            className="flex-1 flex flex-col items-center gap-3 bg-white rounded-2xl p-6 shadow-sm border-2 border-transparent active:border-[#00BAF2] transition-all"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7B5CF0, #4C1D95)' }}>
              <Camera className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-800 text-sm">Scan</p>
              <p className="text-xs text-gray-400 mt-0.5">Click photo of paper bill</p>
              <p className="text-xs text-purple-500 mt-1">📷 OCR powered</p>
            </div>
          </button>
        </div>

        {/* Example hint */}
        <div className="w-full rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #E8F9FF, #F0F8FF)' }}>
          <p className="text-xs font-semibold text-[#0066CC] mb-1">💡 Tip</p>
          <p className="text-sm text-blue-800">
            Speak: "Rice 2 kilo 130 rupees, oil 1 litre 150"<br/>
            Scan: Take a photo of your handwritten bill
          </p>
        </div>
      </div>
    );
  }

  // ── Speak mode ───────────────────────────────────────────────────────────────
  if (mode === 'speak') {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-6">
        <div className="flex items-center justify-between w-full">
          <button onClick={reset} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
            <X size={16} /> Back
          </button>
          <p className="text-xs font-semibold text-[#00BAF2]">🎙 Voice Billing</p>
          <div className="w-12" />
        </div>

        {detectedLang && (
          <div className="bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <p className="text-xs text-green-700 font-medium">✓ Language detected: {detectedLang.replace('-IN', '')}</p>
          </div>
        )}

        {/* Mic button */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={status === 'recording' ? stopRecording : startRecording}
            disabled={status === 'processing'}
            className={`w-36 h-36 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 ${
              status === 'recording'
                ? 'animate-pulse'
                : status === 'processing'
                ? 'opacity-60 cursor-not-allowed'
                : ''
            }`}
            style={{
              background: status === 'recording'
                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                : status === 'processing'
                ? '#D1D5DB'
                : 'linear-gradient(135deg, #00BAF2, #0066CC)',
              boxShadow: status === 'recording'
                ? '0 0 0 16px rgba(239,68,68,0.15)'
                : '0 8px 32px rgba(0,186,242,0.35)',
            }}
          >
            {status === 'processing' ? (
              <Loader2 className="w-14 h-14 text-white animate-spin" />
            ) : status === 'recording' ? (
              <MicOff className="w-14 h-14 text-white" />
            ) : (
              <Mic className="w-14 h-14 text-white" />
            )}
          </button>

          <p className="text-gray-500 text-sm font-medium text-center">
            {status === 'idle'       && 'Tap to speak your bill'}
            {status === 'recording'  && '🔴 Recording… tap to stop'}
            {status === 'processing' && 'Processing your bill…'}
          </p>
          <p className="text-xs text-gray-400 text-center">
            Hindi • Telugu • Tamil • Kannada • Malayalam • and more
          </p>
        </div>

        {transcript && status === 'idle' && (
          <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-400 mb-1">Heard:</p>
            <p className="text-gray-800 text-sm">{transcript}</p>
          </div>
        )}

        {error && (
          <div className="w-full bg-red-50 rounded-xl p-4 border border-red-200">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Scan mode ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      <div className="flex items-center justify-between w-full">
        <button onClick={reset} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
          <X size={16} /> Back
        </button>
        <p className="text-xs font-semibold text-purple-500">📷 Scan Bill</p>
        <div className="w-12" />
      </div>

      {status === 'processing' ? (
        <div className="flex flex-col items-center gap-4 py-8">
          {previewUrl && (
            <img src={previewUrl} alt="Scanned bill" className="w-48 h-48 object-cover rounded-2xl shadow-md opacity-60" />
          )}
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          <p className="text-gray-500 text-sm">Reading your bill…</p>
        </div>
      ) : (
        <>
          {/* Camera capture */}
          <button
            onClick={() => cameraRef.current?.click()}
            className="w-full h-48 rounded-2xl border-2 border-dashed border-purple-300 flex flex-col items-center justify-center gap-3 bg-purple-50 active:bg-purple-100 transition-colors"
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7B5CF0, #4C1D95)' }}>
              <Camera className="w-8 h-8 text-white" />
            </div>
            <p className="text-purple-700 font-semibold text-sm">Take Photo</p>
            <p className="text-xs text-purple-400">Camera opens automatically</p>
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleImageSelected(e.target.files?.[0])}
          />

          <p className="text-gray-400 text-xs">— or upload from gallery —</p>

          {/* Gallery upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-medium shadow-sm active:bg-gray-50"
          >
            <ImagePlus size={18} className="text-purple-500" />
            Upload from Gallery
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageSelected(e.target.files?.[0])}
          />
        </>
      )}

      {error && (
        <div className="w-full bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="w-full rounded-2xl p-4 bg-purple-50">
        <p className="text-xs font-semibold text-purple-700 mb-1">💡 For best results</p>
        <p className="text-sm text-purple-800">
          Write items clearly — name, quantity, and price. Good lighting helps OCR read better.
        </p>
      </div>
    </div>
  );
}
