# AuraLab — Diagnostic Lab & Clinic Voice Management System 🩺🎙️

AuraLab is a full-stack Diagnostic Lab & Clinic Voice Management System powered by **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma ORM (SQLite)**, and clean REST Webhooks compatible with **Vapi** and **Retell AI**.

---

## 🎯 Key Problems Solved
1. **Front-Desk Call Overload**: AI receptionist ("Ananya") automates routine diagnostic test inquiries, quotes prices in INR (₹), and schedules appointment slots.
2. **Invalid Test Samples & No-Shows**: Automated protocol checks prevent patients from eating before strict fasting tests (e.g. 12-hour fast for Lipid Profile, 8-hour fast for Fasting Blood Sugar). Calculates dynamic fasting food cutoffs (e.g., "Stop eating by 8:00 PM the previous evening").
3. **Real-Time Slot Management**: Verifies slot availability to prevent double bookings, dynamically suggests open morning/afternoon slots, and manages outbound reminder queues.

---

## 🚀 Quick Start (For Team Members)

### Prerequisites
Make sure you have these installed on your system:

| Tool | Required Version | Download Link |
|------|-----------------|---------------|
| **Node.js** | v18.0 or higher | [nodejs.org](https://nodejs.org/) |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com/) |
| **npm** | Comes with Node.js | — |

> **Check versions:**
> ```bash
> node --version   # Should show v18.x or higher
> npm --version    # Should show 9.x or higher
> git --version    # Any version works
> ```

### Step 1: Clone the Repository
```bash
git clone https://github.com/sahadibakar1999/Doctor-clinic.git
cd Doctor-clinic
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Set Up the Database
```bash
# Generate Prisma client
npx prisma generate

# Create the SQLite database & apply schema
npx prisma db push

# Seed the database with sample data (test catalog, appointments, etc.)
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

> **Windows users:** If the seed command fails, try:
> ```powershell
> npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed.ts
> ```

### Step 4: Run the Application
```bash
npm run dev
```

Open your browser and go to: **[http://localhost:3000](http://localhost:3000)**

> If port 3000 is busy, Next.js will use port 3001 — check the terminal output.

### ✅ You're Done!
You should now see the AuraLab admin dashboard with stat cards, appointment management, and voice agent testing tools.

---

## 🔧 Troubleshooting

<details>
<summary><strong>PowerShell: "running scripts is disabled on this system"</strong></summary>

Run this in PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```
Then retry `npm run dev`.
</details>

<details>
<summary><strong>Prisma: "database does not exist"</strong></summary>

```bash
npx prisma db push
```
This creates the SQLite database file at `prisma/dev.db`.
</details>

<details>
<summary><strong>Port 3000 already in use</strong></summary>

Either close the other app using port 3000, or run:
```bash
npx next dev -p 3001
```
</details>

<details>
<summary><strong>Node.js version too old</strong></summary>

Download the latest LTS version from [nodejs.org](https://nodejs.org/).
</details>

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
| Page | URL | Description |
|------|-----|-------------|
| **Admin Dashboard** | `/` | Stat cards, appointment table, fasting warnings, live voice simulator |
| **Lab Catalog** | `/tests` | Manage diagnostic tests, prices (₹), fasting durations, sample types |
| **Call Logs** | `/calls` | Voice call history, transcripts, AI-detected intents |
| **Voice Agent Setup** | `/voice-agent` | Configuration guide, system prompt, tool schemas for Vapi/Retell |

### API Webhooks & Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/voice/webhook` | Main voice AI webhook (check_test_prep, get_available_slots, book_lab_appointment, confirm_fasting_readiness) |
| `POST` | `/api/voice/simulate` | Real-time simulator for testing voice dialogues |
| `GET/POST` | `/api/lab/tests` | Diagnostic test catalog CRUD |
| `GET` | `/api/lab/appointments` | Appointments filtered by date/status/fasting |
| `POST` | `/api/lab/reminders/trigger` | Outbound prep reminder dispatch |
| `GET` | `/api/lab/stats` | Dashboard metrics & no-show risk |
| `GET` | `/api/lab/calls` | Voice call logs |

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (http://localhost:3000) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:push` | Push schema changes to database |
| `npm run prisma:seed` | Seed database with sample data |

---

## 🌐 Deploy to Vercel (Free Hosting)

The easiest way to deploy this app so your team can access it **without installing anything**:

1. Go to [vercel.com](https://vercel.com/) and sign in with your GitHub account
2. Click **"Import Project"** → Select **`Doctor-clinic`** repository
3. Vercel auto-detects Next.js — just click **Deploy**
4. Your app will be live at `https://doctor-clinic-xxxx.vercel.app`

> **Note:** For production, consider switching from SQLite to PostgreSQL (e.g., [Neon](https://neon.tech/) or [Supabase](https://supabase.com/) — both have free tiers).

Share the Vercel URL with your team — no installation needed! 🎉

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

---

## 👥 Team & Contributions

Built by the AuraLab team. Contributions welcome — fork, create a branch, and submit a PR!

## 📄 License

This project is private. All rights reserved.
