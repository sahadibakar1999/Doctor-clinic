import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Clearing old data...");
  await prisma.callLog.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.labTest.deleteMany();

  console.log("💉 Seeding Lab Tests...");
  const tests = [
    {
      name: "Fasting Blood Sugar (FBS)",
      category: "Biochemistry",
      price: 150,
      fastingRequired: true,
      fastingHours: 8,
      prepInstructions: "Strict fasting for 8-10 hours. Only plain water permitted. No morning tea or coffee.",
      sampleType: "Blood",
    },
    {
      name: "Lipid Profile",
      category: "Biochemistry",
      price: 650,
      fastingRequired: true,
      fastingHours: 12,
      prepInstructions: "12 hours overnight fast. Avoid fatty meals and alcohol 24h before. Water allowed.",
      sampleType: "Blood",
    },
    {
      name: "HbA1c (Glycated Hemoglobin)",
      category: "Hematology",
      price: 400,
      fastingRequired: false,
      fastingHours: 0,
      prepInstructions: "No fasting required. Can be done any time of day.",
      sampleType: "Blood",
    },
    {
      name: "Thyroid Profile (T3, T4, TSH)",
      category: "Endocrinology",
      price: 450,
      fastingRequired: false,
      fastingHours: 0,
      prepInstructions: "Morning sample preferred before taking daily morning thyroid medication.",
      sampleType: "Blood",
    },
    {
      name: "Ultrasound Whole Abdomen",
      category: "Radiology",
      price: 1200,
      fastingRequired: true,
      fastingHours: 4,
      prepInstructions: "4 hours fasting for food. Full bladder required; drink 4-5 glasses of water 1 hour prior to scan.",
      sampleType: "Scan",
    },
    {
      name: "Complete Blood Count (CBC)",
      category: "Hematology",
      price: 300,
      fastingRequired: false,
      fastingHours: 0,
      prepInstructions: "No special preparation or fasting required. Routine whole blood test.",
      sampleType: "Blood",
    },
    {
      name: "Liver Function Test (LFT)",
      category: "Biochemistry",
      price: 550,
      fastingRequired: true,
      fastingHours: 8,
      prepInstructions: "8 hours overnight fast. Strictly avoid alcohol 48 hours prior to test.",
      sampleType: "Blood",
    },
    {
      name: "Kidney Function Test (KFT/RFT)",
      category: "Biochemistry",
      price: 500,
      fastingRequired: false,
      fastingHours: 0,
      prepInstructions: "Maintain normal hydration. Avoid heavy meat intake 24h prior.",
      sampleType: "Blood",
    },
    {
      name: "Vitamin D3 (25-Hydroxy)",
      category: "Endocrinology",
      price: 1100,
      fastingRequired: false,
      fastingHours: 0,
      prepInstructions: "No fasting required. Normal diet and medication routine.",
      sampleType: "Blood",
    },
    {
      name: "Urine Routine & Microscopy",
      category: "Clinical Pathology",
      price: 180,
      fastingRequired: false,
      fastingHours: 0,
      prepInstructions: "First morning midstream clean-catch urine sample in sterile container.",
      sampleType: "Urine",
    }
  ];

  const createdTests: Record<string, any> = {};
  for (const t of tests) {
    const item = await prisma.labTest.create({
      data: t,
    });
    createdTests[t.name] = item;
  }

  console.log("📅 Seeding Appointments...");
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  // Format today's date keeping year-month-day
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const tomorrowDateOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0);

  const appointments = [
    {
      patientName: "Rajesh Sharma",
      patientPhone: "+91 98201 44521",
      testId: createdTests["Lipid Profile"].id,
      date: todayDateOnly,
      timeSlot: "08:00 AM",
      status: "CONFIRMED",
      fastingAcknowledged: false, // Pending Fasting!
      notes: "Caller requested earliest morning slot. Fasting cutoff was 8:00 PM yesterday.",
    },
    {
      patientName: "Priya Patel",
      patientPhone: "+91 98450 11234",
      testId: createdTests["Fasting Blood Sugar (FBS)"].id,
      date: todayDateOnly,
      timeSlot: "08:30 AM",
      status: "REMINDER_SENT",
      fastingAcknowledged: true,
      notes: "Acknowledged 8h fasting via Ananya AI reminder call.",
    },
    {
      patientName: "Amit Desai",
      patientPhone: "+91 97110 88992",
      testId: createdTests["Ultrasound Whole Abdomen"].id,
      date: todayDateOnly,
      timeSlot: "10:00 AM",
      status: "CONFIRMED",
      fastingAcknowledged: false, // 4h fasting + full bladder needed
      notes: "Needs bladder fullness reminders. Fasting started at 6 AM.",
    },
    {
      patientName: "Sunita Verma",
      patientPhone: "+91 99203 77610",
      testId: createdTests["HbA1c (Glycated Hemoglobin)"].id,
      date: todayDateOnly,
      timeSlot: "11:30 AM",
      status: "COMPLETED",
      fastingAcknowledged: true,
      notes: "Sample collected without delay.",
    },
    {
      patientName: "Vikram Malhotra",
      patientPhone: "+91 98199 55432",
      testId: createdTests["Lipid Profile"].id,
      date: tomorrowDateOnly,
      timeSlot: "08:00 AM",
      status: "CONFIRMED",
      fastingAcknowledged: false, // Tomorrow morning - prime candidate for outbound prep call!
      notes: "Booked via Vapi voice agent. Reminded about 12h fasting.",
    },
    {
      patientName: "Ananya Iyer",
      patientPhone: "+91 98712 33456",
      testId: createdTests["Thyroid Profile (T3, T4, TSH)"].id,
      date: tomorrowDateOnly,
      timeSlot: "09:00 AM",
      status: "CONFIRMED",
      fastingAcknowledged: true,
      notes: "Informed patient not to take morning Eltroxin tablet before blood draw.",
    },
    {
      patientName: "Kavita Rao",
      patientPhone: "+91 98400 99887",
      testId: createdTests["Liver Function Test (LFT)"].id,
      date: tomorrowDateOnly,
      timeSlot: "09:30 AM",
      status: "CONFIRMED",
      fastingAcknowledged: false,
      notes: "High risk of no-show if prep instructions are forgotten.",
    }
  ];

  for (const app of appointments) {
    await prisma.appointment.create({
      data: app,
    });
  }

  console.log("📞 Seeding Call Logs...");
  const callLogs = [
    {
      callId: "call_vapi_90182",
      callerPhone: "+91 98199 55432",
      transcript: "Patient: Hi, I need to get my cholesterol and Lipid Profile checked tomorrow morning.\nAI (Ananya): Certainly! A Lipid Profile is ₹650 and requires 12 hours of overnight fasting. Only plain water is allowed.\nPatient: Okay, what slots do you have tomorrow?\nAI (Ananya): We have 8:00 AM or 9:00 AM available. Which suits you better?\nPatient: Let's do 8:00 AM. Name is Vikram Malhotra.\nAI (Ananya): Your appointment is confirmed for tomorrow at 8:00 AM. Please ensure you do not eat anything after 8:00 PM tonight. See you tomorrow!",
      summary: "Booked Lipid Profile for Vikram Malhotra on tomorrow 8:00 AM. Quoted ₹650 and stressed 12-hour fasting requirement.",
      intent: "BOOKING",
      durationSeconds: 68,
      audioStatus: "COMPLETED",
      timestamp: new Date(Date.now() - 1000 * 60 * 35),
    },
    {
      callId: "call_vapi_88412",
      callerPhone: "+91 98201 99120",
      transcript: "Patient: Hello, can I drink tea or milk before my fasting blood sugar test tomorrow?\nAI (Ananya): No, strictly avoid tea, coffee, milk, or breakfast. Fasting Blood Sugar requires 8 to 10 hours of fasting where only plain water is permitted.\nPatient: Got it, thank you for clarifying!",
      summary: "Patient inquired if tea/milk allowed before FBS test. AI Ananya clarified strict water-only protocol.",
      intent: "PREP_QUERY",
      durationSeconds: 42,
      audioStatus: "COMPLETED",
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
    },
    {
      callId: "call_vapi_77190",
      callerPhone: "+91 98450 11234",
      transcript: "AI (Ananya): Hello, am I speaking with Priya Patel?\nPatient: Yes, Priya here.\nAI (Ananya): This is Ananya calling from Apex Diagnostic Centre regarding your Fasting Blood Sugar test scheduled for today at 8:30 AM. As a reminder, this test requires 8 hours of fasting. Will you be able to follow this?\nPatient: Yes, I finished dinner at 9:30 PM last night and haven't eaten anything.\nAI (Ananya): Wonderful! Your fasting readiness is confirmed. We look forward to seeing you at 8:30 AM.",
      summary: "Outbound reminder call to Priya Patel for FBS test. Fasting protocol verified and acknowledged.",
      intent: "BOOKING",
      durationSeconds: 51,
      audioStatus: "COMPLETED",
      timestamp: new Date(Date.now() - 1000 * 60 * 240),
    },
    {
      callId: "call_vapi_65410",
      callerPhone: "+91 99123 44556",
      transcript: "Patient: Hi, what are the preparations for Whole Abdomen Ultrasound scan?\nAI (Ananya): An Ultrasound Whole Abdomen costs ₹1200 and requires 4 hours of food fasting. Additionally, a full bladder is necessary, so please drink 4 to 5 glasses of water one hour before your appointment without urinating.\nPatient: Okay, I will schedule it later. Thank you.\nAI (Ananya): You're most welcome! Have a healthy day.",
      summary: "Inquiry about Ultrasound Whole Abdomen prep rules. Full bladder and 4-hour fasting explained.",
      intent: "PREP_QUERY",
      durationSeconds: 58,
      audioStatus: "COMPLETED",
      timestamp: new Date(Date.now() - 1000 * 60 * 480),
    },
    {
      callId: "call_vapi_54199",
      callerPhone: "+91 97110 88992",
      transcript: "Patient: I had an appointment at 9 AM but I got stuck in traffic. Can I move to 10:00 AM?\nAI (Ananya): Let me check availability for you. Yes, 10:00 AM is open with Dr. Sharma for Ultrasound Abdomen. I have rescheduled your appointment to 10:00 AM today.\nPatient: Thanks a lot Ananya.",
      summary: "Rescheduled Amit Desai's appointment from 9:00 AM to 10:00 AM due to traffic.",
      intent: "RESCHEDULE",
      durationSeconds: 49,
      audioStatus: "COMPLETED",
      timestamp: new Date(Date.now() - 1000 * 60 * 600),
    }
  ];

  for (const log of callLogs) {
    await prisma.callLog.create({
      data: log,
    });
  }

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
