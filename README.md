# AuraLab — Diagnostic Lab & Clinic Voice Management System 🩺🎙️

AuraLab is a full-stack Diagnostic Lab & Clinic Voice Management System powered by **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM (SQLite)**, and clean REST Webhooks compatible with **Vapi** and **Retell AI**.

---

## 🎯 Key Problems Solved
1. **Front-Desk Call Overload**: AI receptionist ("Ananya") automates routine diagnostic test inquiries, quotes prices in INR (₹), and schedules appointment slots.
2. **Invalid Test Samples & No-Shows**: Automated protocol checks prevent patients from eating before strict fasting tests (e.g. 12-hour fast for Lipid Profile, 8-hour fast for Fasting Blood Sugar). Calculates dynamic fasting food cutoffs (e.g., "Stop eating by 8:00 PM the previous evening").
3. **Real-Time Slot Management**: Verifies slot availability to prevent double bookings, dynamically suggests open morning/afternoon slots, and manages outbound reminder queues.

---

## 🏗️ Architecture & Tech Stack
- **Framework**: Next.js 14 App Router with React 18 & TypeScript
- **Styling**: Tailwind CSS with clinical healthcare color tokens (medical blues, emerald greens, amber alert states)
- **Database**: Prisma ORM with SQLite (`prisma/dev.db`)
- **Icons**: Lucide React
- **Voice Integration**: Universal REST webhook endpoint supporting:
  - Vapi `tool-calls` & `function-call` formats
  - Retell AI tool invocation payloads
  - OpenAI Assistant Function Calling

---

## 📁 Key Routes & Pages

### Frontend Pages
- **Admin Dashboard (`/`)**:
  - Stat cards: *Today's Appointments*, *Fasting Pending Ack*, *Calls Handled by AI Today*, *No-Show Risk Rate*.
  - Appointment Table with fasting warning badges, status management, and one-click outbound call triggers.
  - Interactive **Live Voice Agent Test Simulator** modal with microphone input & real-time tool inspector.
- **Diagnostic Lab Catalog (`/tests`)**:
  - Full management of lab tests, INR prices, fasting durations, sample types, and spoken prep guidelines.
- **Call Transcripts & Logs (`/calls`)**:
  - Historical voice call records with audio playback visualizers, AI conversation transcripts, and detected intents.
- **Voice Agent Setup (`/voice-agent`)**:
  - Complete configuration guide, system prompt ("Ananya"), and tool schemas ready to copy into Vapi or Retell dashboards.

### API Webhooks & Endpoints
- `POST /api/voice/webhook`:
  - `check_test_prep(test_name)`: Returns exact preparation rules, fasting hours, and price.
  - `get_available_slots(date)`: Checks database and returns available morning/afternoon slots.
  - `book_lab_appointment(...)`: Validates slot, prevents collisions, saves appointment, and delivers confirmation with dynamic cutoff times.
  - `confirm_fasting_readiness(appointment_id)`: Marks `fastingAcknowledged: true`.
- `POST /api/voice/simulate`: Real-time simulator engine for testing conversational voice dialogues.
- `GET /api/lab/tests` & `POST /api/lab/tests`: Catalog management.
- `GET /api/lab/appointments`: Appointments filtered by date, status, and fasting status.
- `POST /api/lab/reminders/trigger`: Dispatches outbound prep reminders with personalized fasting calculations.
- `GET /api/lab/stats`: Dashboard operational metrics and no-show risk calculations.
- `GET /api/lab/calls`: Voice call logs and summaries.

---

## 🚀 Getting Started

### 1. Install dependencies & initialize database
```bash
npm install
npx prisma db push
npx ts-node prisma/seed.ts
```

### 2. Run the application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (or `http://localhost:3001` if port 3000 is occupied).

---

## 🤖 Voice Agent System Prompt (Vapi / Retell)
```markdown
[ROLE & PERSONA]
You are "Ananya", the inbound medical receptionist for Apex Diagnostic Centre.
Your tone is empathetic, clear, calm, and efficient.
You speak fluent Indian English (with natural polite phrasing like "Certainly", "Sure, give me a moment").

[RULES & BOUNDARIES]
- Maximum 2 sentences per response. Never speak in paragraphs.
- Never diagnose medical conditions or advise on medicines.
- Always highlight fasting guidelines clearly. Fasting errors lead to canceled tests.
```
