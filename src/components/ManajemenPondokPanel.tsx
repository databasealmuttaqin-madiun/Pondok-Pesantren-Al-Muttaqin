import React, { useState } from "react";
import { Clock, Home, Sliders, Layers } from "lucide-react";
import { SantriData } from "../supabaseClient";
import ManajemenSesiPanel from "./ManajemenSesiPanel";
import ManagementPanel from "./ManagementPanel";
import MasterKantinPanel from "./MasterKantinPanel";
import PageHeader from "./PageHeader";

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
  initialSubTab?: "sesi" | "kamar" | "pengajian" | "kantin";
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
  onAssignMetadata,
  initialSubTab = "sesi"
}: ManajemenPondokPanelProps) {
  const getSubTitle = () => {
    if (initialSubTab === "sesi") return "Manajemen Sesi Mengaji";
    if (initialSubTab === "kamar") return "Plotting Kamar Asrama";
    if (initialSubTab === "pengajian") return "Plotting Kelas Pengajian";
    if (initialSubTab === "kantin") return "Master Kantin";
    return "Plotting Pondok";
  };

  return (
    <div className="space-y-6" id="manajemen_pondok_module">
      <PageHeader category="Plotting Pondok" title={getSubTitle()} />

      {/* Rendering panels */}
      {initialSubTab === "sesi" && (
        <div className="w-full">
          <ManajemenSesiPanel />
        </div>
      )}
      {initialSubTab === "kamar" && (
        <div className="w-full">
          <ManagementPanel
            initialMode="kamar"
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
      {initialSubTab === "pengajian" && (
        <div className="w-full">
          <ManagementPanel
            initialMode="pengajian"
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
      {initialSubTab === "kantin" && (
        <div className="w-full">
          <MasterKantinPanel />
        </div>
      )}
    </div>
  );
}
