// Script to push database schema and seed data to Turso
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/turso-setup.ts

import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";

// Load .env file manually if not already in process.env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken || authToken === "PASTE_YOUR_TOKEN_HERE") {
    console.error("\n❌ TURSO_AUTH_TOKEN is missing or still set to 'PASTE_YOUR_TOKEN_HERE' in your .env file!");
    console.error("   Open .env and paste your Turso auth token for TURSO_AUTH_TOKEN.\n");
    process.exit(1);
  }

  console.log("🔗 Connecting to Turso:", url);
  const client = createClient({ url, authToken });

  // 1. Create tables
  console.log("\n📦 Creating tables...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS LabTest (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      fastingRequired INTEGER NOT NULL DEFAULT 0,
      fastingHours INTEGER NOT NULL DEFAULT 0,
      prepInstructions TEXT NOT NULL,
      sampleType TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("   ✅ LabTest table created");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS Appointment (
      id TEXT PRIMARY KEY,
      patientName TEXT NOT NULL,
      patientPhone TEXT NOT NULL,
      testId TEXT NOT NULL,
      date DATETIME NOT NULL,
      timeSlot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      fastingAcknowledged INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (testId) REFERENCES LabTest(id) ON DELETE CASCADE
    )
  `);
  console.log("   ✅ Appointment table created");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS CallLog (
      id TEXT PRIMARY KEY,
      callId TEXT NOT NULL UNIQUE,
      callerPhone TEXT NOT NULL,
      transcript TEXT,
      summary TEXT NOT NULL,
      intent TEXT NOT NULL,
      durationSeconds INTEGER DEFAULT 45,
      audioStatus TEXT DEFAULT 'COMPLETED',
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("   ✅ CallLog table created");

  // 2. Seed sample data
  console.log("\n🌱 Seeding sample data...");

  const testId = (prefix: string) => `${prefix}_${Date.now().toString(36)}`;

  const tests = [
    {
      id: testId("lipid"),
      name: "Lipid Profile",
      category: "Biochemistry",
      price: 850,
      fastingRequired: 1,
      fastingHours: 12,
      prepInstructions: "10-12 hours overnight fasting. Only plain water permitted. Avoid alcohol 24 hours prior. Avoid fatty meals the previous day.",
      sampleType: "Blood",
    },
    {
      id: testId("fbs"),
      name: "Fasting Blood Sugar (FBS)",
      category: "Biochemistry",
      price: 150,
      fastingRequired: 1,
      fastingHours: 8,
      prepInstructions: "Minimum 8 hours fasting required. Plain water is allowed. No tea, coffee, or juice. Take the test before breakfast.",
      sampleType: "Blood",
    },
    {
      id: testId("thyroid"),
      name: "Thyroid Profile (T3, T4, TSH)",
      category: "Blood Test",
      price: 650,
      fastingRequired: 0,
      fastingHours: 0,
      prepInstructions: "No fasting required. Can be done at any time of day. If on thyroid medication, take it after the blood draw.",
      sampleType: "Blood",
    },
    {
      id: testId("cbc"),
      name: "Complete Blood Count (CBC)",
      category: "Blood Test",
      price: 350,
      fastingRequired: 0,
      fastingHours: 0,
      prepInstructions: "No fasting required. Stay hydrated. Inform the lab if you are on any blood-thinning medication.",
      sampleType: "Blood",
    },
    {
      id: testId("lft"),
      name: "Liver Function Test (LFT)",
      category: "Biochemistry",
      price: 550,
      fastingRequired: 1,
      fastingHours: 10,
      prepInstructions: "10 hours fasting recommended. Avoid alcohol for 48 hours before the test. Only plain water is permitted during fasting.",
      sampleType: "Blood",
    },
    {
      id: testId("kft"),
      name: "Kidney Function Test (KFT/RFT)",
      category: "Biochemistry",
      price: 500,
      fastingRequired: 0,
      fastingHours: 0,
      prepInstructions: "No special preparation. Stay well hydrated. Inform lab of any medications you are currently taking.",
      sampleType: "Blood",
    },
    {
      id: testId("vitd"),
      name: "Vitamin D3 (25-Hydroxy)",
      category: "Blood Test",
      price: 1200,
      fastingRequired: 0,
      fastingHours: 0,
      prepInstructions: "No fasting required. Sample can be collected at any time. Avoid high-dose Vitamin D supplements 24 hours before the test.",
      sampleType: "Serum",
    },
    {
      id: testId("uso"),
      name: "Ultrasound Whole Abdomen",
      category: "Radiology",
      price: 1500,
      fastingRequired: 1,
      fastingHours: 6,
      prepInstructions: "6 hours fasting before the scan. Drink 4-5 glasses of water 1 hour before the scan and do not urinate (full bladder required).",
      sampleType: "Scan",
    },
  ];

  for (const test of tests) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO LabTest (id, name, category, price, fastingRequired, fastingHours, prepInstructions, sampleType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [test.id, test.name, test.category, test.price, test.fastingRequired, test.fastingHours, test.prepInstructions, test.sampleType],
    });
  }
  console.log(`   ✅ ${tests.length} lab tests seeded`);

  // Seed some appointments
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const appointments = [
    { id: testId("apt"), patientName: "Priya Sharma", patientPhone: "+91 98765 43210", testId: tests[0].id, timeSlot: "08:00 AM", status: "CONFIRMED", fastingAcknowledged: 0 },
    { id: testId("apt"), patientName: "Rahul Verma", patientPhone: "+91 87654 32109", testId: tests[1].id, timeSlot: "08:30 AM", status: "CONFIRMED", fastingAcknowledged: 1 },
    { id: testId("apt"), patientName: "Anita Das", patientPhone: "+91 76543 21098", testId: tests[2].id, timeSlot: "09:00 AM", status: "REMINDER_SENT", fastingAcknowledged: 0 },
    { id: testId("apt"), patientName: "Vikram Singh", patientPhone: "+91 65432 10987", testId: tests[4].id, timeSlot: "09:30 AM", status: "CONFIRMED", fastingAcknowledged: 0 },
  ];

  for (const apt of appointments) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO Appointment (id, patientName, patientPhone, testId, date, timeSlot, status, fastingAcknowledged) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [apt.id, apt.patientName, apt.patientPhone, apt.testId, tomorrow.toISOString(), apt.timeSlot, apt.status, apt.fastingAcknowledged],
    });
  }
  console.log(`   ✅ ${appointments.length} appointments seeded`);

  // Seed some call logs
  const callLogs = [
    { id: testId("call"), callId: `call_ai_${Date.now()}`, callerPhone: "+91 98765 43210", summary: "Patient inquired about Lipid Profile preparation guidelines and pricing.", intent: "PREP_QUERY", durationSeconds: 65 },
    { id: testId("call"), callId: `call_ai_${Date.now() + 1}`, callerPhone: "+91 87654 32109", summary: "Patient booked Fasting Blood Sugar appointment for tomorrow 8:30 AM.", intent: "BOOKING", durationSeconds: 82 },
  ];

  for (const call of callLogs) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO CallLog (id, callId, callerPhone, summary, intent, durationSeconds) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [call.id, call.callId, call.callerPhone, call.summary, call.intent, call.durationSeconds],
    });
  }
  console.log(`   ✅ ${callLogs.length} call logs seeded`);

  console.log("\n🎉 Turso database setup complete!");
  console.log("   You can now deploy on Vercel.\n");

  client.close();
}

main().catch((err) => {
  console.error("❌ Setup failed:", err);
  process.exit(1);
});
