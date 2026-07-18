import React, { useState } from "react";
import { Clock, Home, Sliders, Layers } from "lucide-react";
import { SantriData } from "../supabaseClient";
import ManajemenSesiPanel from "./ManajemenSesiPanel";
import ManagementPanel from "./ManagementPanel";

interface ManajemenPondokPanelProps {
  students: SantriData[];
  rooms: string[];
  setRooms: (rooms: string[]) => void;
  recitationClasses: string[];
  setRecitationClasses: (classes: string[]) => void;
  schoolClasses: string[];
  setSchoolClasses: (classes: string[]) => void;
  metadataMap: Record<string, { kamar?: string; kelas_sekolah?: string; kelas_pengajian?: string }>;
  onAssignMetadata: (nik: string, key: "kamar" | "kelas_sekolah" | "kelas_pengajian", value: string) => void;
}

export default function ManajemenPondokPanel({
  students,
  rooms,
  setRooms,
  recitationClasses,
  setRecitationClasses,
  schoolClasses,
  setSchoolClasses,
  metadataMap,
  onAssignMetadata
}: ManajemenPondokPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"sesi" | "plotting" | "coming_soon">("sesi");

  return (
    <div className="space-y-6" id="manajemen_pondok_module">
      {/* Header block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight uppercase flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-600" />
            Manajemen Pondok Pesantren
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold leading-relaxed max-w-2xl">
            Pusat administrasi aktivitas pondok pesantren, asrama kamar tidur santri, pengajian Al-Quran, dan pengaturan sesi absensi harian santri.
          </p>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-inner max-w-xl">
        <button
          onClick={() => setActiveSubTab("sesi")}
          className={`px-4 py-2.5 text-xs font-black rounded-xl text-center cursor-pointer transition-all flex items-center gap-2 ${
            activeSubTab === "sesi"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Clock className="w-4 h-4" /> Manajemen Sesi
        </button>
        <button
          onClick={() => setActiveSubTab("plotting")}
          className={`px-4 py-2.5 text-xs font-black rounded-xl text-center cursor-pointer transition-all flex items-center gap-2 ${
            activeSubTab === "plotting"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <Sliders className="w-4 h-4" /> Plotting Kamar & Ngaji
        </button>
        <button
          onClick={() => setActiveSubTab("coming_soon")}
          className={`px-4 py-2.5 text-xs font-black rounded-xl text-center cursor-pointer transition-all flex items-center gap-2 ${
            activeSubTab === "coming_soon"
              ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
              : "text-slate-400 dark:text-slate-600 cursor-not-allowed"
          }`}
          disabled
        >
          <Layers className="w-4 h-4" /> Menu Lainnya (Menyusul)
        </button>
      </div>

      {/* Rendering panels */}
      {activeSubTab === "sesi" && (
        <div className="w-full">
          <ManajemenSesiPanel />
        </div>
      )}

      {activeSubTab === "plotting" && (
        <div className="w-full">
          <ManagementPanel
            students={students}
            rooms={rooms}
            setRooms={setRooms}
            recitationClasses={recitationClasses}
            setRecitationClasses={setRecitationClasses}
            schoolClasses={schoolClasses}
            setSchoolClasses={setSchoolClasses}
            metadataMap={metadataMap}
            onAssignMetadata={onAssignMetadata}
          />
        </div>
      )}
    </div>
  );
}
