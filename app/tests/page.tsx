"use client";

import { useState, useEffect } from "react";
import {
  FlaskConical,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  IndianRupee,
  CheckCircle2,
  Trash2,
  Edit2,
  Filter,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { VoiceSimulatorModal } from "@/components/VoiceSimulatorModal";
import { formatCurrencyINR, cn } from "@/lib/utils";

interface LabTest {
  id: string;
  name: string;
  category: string;
  price: number;
  fastingRequired: boolean;
  fastingHours: number;
  prepInstructions: string;
  sampleType: string;
  _count?: {
    appointments: number;
  };
}

export default function LabCatalogPage() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Add/Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTest | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "Biochemistry",
    price: "",
    fastingRequired: false,
    fastingHours: 0,
    prepInstructions: "",
    sampleType: "Blood",
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchTests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("query", searchQuery);
      if (selectedCategory !== "ALL") params.append("category", selectedCategory);

      const res = await fetch(`/api/lab/tests?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setTests(data.tests);
      }
    } catch (err) {
      console.error("Error fetching tests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [selectedCategory, searchQuery]);

  const handleOpenAddModal = () => {
    setEditingTest(null);
    setFormData({
      name: "",
      category: "Biochemistry",
      price: "",
      fastingRequired: false,
      fastingHours: 0,
      prepInstructions: "",
      sampleType: "Blood",
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (test: LabTest) => {
    setEditingTest(test);
    setFormData({
      name: test.name,
      category: test.category,
      price: test.price.toString(),
      fastingRequired: test.fastingRequired,
      fastingHours: test.fastingHours,
      prepInstructions: test.prepInstructions,
      sampleType: test.sampleType,
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleDeleteTest = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`/api/lab/tests/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchTests();
      }
    } catch (err) {
      console.error("Delete test error:", err);
    }
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      setErrorMsg("Please fill in test name and price.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const url = editingTest ? `/api/lab/tests/${editingTest.id}` : "/api/lab/tests";
      const method = editingTest ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          fastingHours: formData.fastingRequired ? parseInt(formData.fastingHours as any || 0, 10) : 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchTests();
      } else {
        setErrorMsg(data.error || "Failed to save test.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save test.");
    } finally {
      setSaving(false);
    }
  };

  // Categories list
  const categories = ["ALL", "Biochemistry", "Hematology", "Endocrinology", "Radiology", "Clinical Pathology"];

  const fastingCount = tests.filter((t) => t.fastingRequired).length;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Navbar onOpenSimulator={() => setIsSimulatorOpen(true)} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Diagnostic Lab Catalog
              </h1>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                {tests.length} Active Tests
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Manage test pricing, sample categories, fasting durations, and prep guidelines enforced by the AI Voice Agent.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Lab Test</span>
            </button>
          </div>
        </div>

        {/* Quick summary badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Tests
            </span>
            <div className="mt-1 text-2xl font-bold text-slate-900">{tests.length}</div>
            <p className="text-xs text-slate-400 mt-1">Available for voice booking</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Fasting-Dependent Tests
            </span>
            <div className="mt-1 text-2xl font-bold text-amber-950">{fastingCount} Tests</div>
            <p className="text-xs text-amber-700 mt-1">Monitored for sample validity breaches</p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Non-Fasting Tests
            </span>
            <div className="mt-1 text-2xl font-bold text-emerald-950">
              {tests.length - fastingCount} Tests
            </div>
            <p className="text-xs text-emerald-700 mt-1">Walk-in or any-time sample collection</p>
          </div>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  selectedCategory === cat
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tests by name or prep..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none shadow-xs"
            />
          </div>
        </div>

        {/* Test Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tests.map((test) => (
            <div
              key={test.id}
              className={cn(
                "flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md bg-white",
                test.fastingRequired
                  ? "border-amber-200/90 hover:border-amber-300"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {test.category}
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-slate-900 leading-snug">
                      {test.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-brand-700">
                      {formatCurrencyINR(test.price)}
                    </span>
                    <div className="text-[10px] font-medium text-slate-400">
                      Sample: {test.sampleType}
                    </div>
                  </div>
                </div>

                {/* Fasting Badge */}
                <div className="mt-3">
                  {test.fastingRequired ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-2.5 text-xs text-amber-900">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>{test.fastingHours} Hours Fasting Required</span>
                      </div>
                      <p className="mt-1 text-[11px] text-amber-950 font-normal leading-relaxed">
                        {test.prepInstructions}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-900">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>No Fasting Required</span>
                      </div>
                      <p className="mt-1 text-[11px] text-emerald-900/80 font-normal leading-relaxed">
                        {test.prepInstructions}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {test._count?.appointments || 0} scheduled bookings
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(test)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100"
                    title="Edit Test Details"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTest(test.id, test.name)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100"
                    title="Delete Test"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add / Edit Test Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative flex flex-col w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingTest ? "Edit Diagnostic Test" : "Add New Diagnostic Test"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTest} className="p-6 space-y-4">
              {errorMsg && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Test Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Lipid Profile, Fasting Blood Sugar"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Category & Sample */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none bg-white"
                  >
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Hematology">Hematology</option>
                    <option value="Endocrinology">Endocrinology</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Clinical Pathology">Clinical Pathology</option>
                    <option value="Microbiology">Microbiology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sample Type</label>
                  <input
                    type="text"
                    value={formData.sampleType}
                    onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                    placeholder="e.g. Blood, Urine, Scan"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹ INR) *</label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="e.g. 650"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Fasting Options */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={formData.fastingRequired}
                    onChange={(e) => setFormData({ ...formData, fastingRequired: e.target.checked })}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>Fasting Required for this test?</span>
                </label>

                {formData.fastingRequired && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Fasting Duration (Hours)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={formData.fastingHours}
                      onChange={(e) =>
                        setFormData({ ...formData, fastingHours: parseInt(e.target.value || "0", 10) })
                      }
                      className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Prep Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preparation Instructions (Spoken by AI Voice Agent)
                </label>
                <textarea
                  rows={3}
                  value={formData.prepInstructions}
                  onChange={(e) => setFormData({ ...formData, prepInstructions: e.target.value })}
                  placeholder="e.g. Strict 10-12 hours overnight fast. Only plain water allowed. Avoid alcohol 24h prior."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingTest ? "Update Test" : "Create Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      <VoiceSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onDataUpdated={fetchTests}
      />
    </div>
  );
}
