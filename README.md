# VaaniPay — Voice + OCR Billing for Indian Shops

A Paytm-style mobile web app for small kirana store owners. Create bills by speaking in any Indian language or scanning a handwritten paper bill. Generate UPI payment QR codes instantly, and get AI business advice on your dashboard.

## Features

### Billing
- **Speak** — speak in any Indian language (Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, etc.) — language auto-detected by Sarvam AI, no selection needed
- **Scan** — take a photo of a handwritten bill, Sarvam Vision AI reads the text via OCR, falls back to Gemini Vision

### Payments
- Auto-generates UPI QR code for the bill total
- Shareable payment link for customers
- Real-time payment status polling

### Dashboard & AI Advisor
- Today's revenue and bill count
- 7-day bar chart
- All-time and pending totals
- Top products by sales count
- **AI Business Advisor** — chat button/fab on dashboard, powered by Gemini
  - Answers: "How is my business doing?", "Should I raise rice prices?", "What's my best product?", etc.
  - Analyzes your actual invoice and catalog data

### UI
- Paytm-style design: `#00BAF2` / `#0066CC` gradient header, clean cards, mobile-first

## Setup

### 1. Clone and install

```bash
npm install           # in /backend
npm install           # in /frontend
```

### 2. Configure .env

Copy `.env.example` to `.env` in the project root and fill in:

```
SARVAM_API_KEY=...
GEMINI_API_KEY=...
```

### 3. Run

```bash
# Terminal 1 — Backend
cd backend && npm start

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:5173

## API Keys
- **Sarvam AI**: https://dashboard.sarvam.ai (free tier available)
- **Google Gemini**: https://aistudio.google.com/app/apikey (free tier available)
