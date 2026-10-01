import React, { useState } from "react";
import { Clock, Home, Sliders, Layers } from "lucide-react";
import { SantriData } from "../supabaseClient";
import ManajemenSesiPanel from "./ManajemenSesiPanel";
import ManagementPanel from "./ManagementPanel";
import MasterKantinPanel from "./MasterKantinPanel";
import PlottingKamarPanel from "./PlottingKamarPanel";
import PlottingPengajianPanel from "./PlottingPengajianPanel";
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
  currentUser?: any;
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
  initialSubTab = "sesi",
  currentUser
}: ManajemenPondokPanelProps) {
  const getSubTitle = () => {
    if (initialSubTab === "sesi") return "Sesi Mengaji";
    if (initialSubTab === "kamar") return "Kamar";
    if (initialSubTab === "pengajian") return "Kelas Pengajian";
    if (initialSubTab === "kantin") return "Kantin";
    return "Plotting Pondok";
  };

  return (
    <div className="space-y-6" id="manajemen_pondok_module">
      {initialSubTab !== "kamar" && initialSubTab !== "pengajian" && (
        <PageHeader category="Plotting Pondok" title={getSubTitle()} />
      )}

      {/* Rendering panels */}
      {initialSubTab === "sesi" && (
        <div className="w-full">
          <ManajemenSesiPanel />
        </div>
      )}
      {initialSubTab === "kamar" && (
        <div className="w-full">
          <PlottingKamarPanel
            students={students}
            rooms={rooms}
            setRooms={setRooms}
            metadataMap={metadataMap}
            onAssignMetadata={onAssignMetadata}
            currentUser={currentUser}
          />
        </div>
      )}
      {initialSubTab === "pengajian" && (
        <div className="w-full">
          <PlottingPengajianPanel
            students={students}
            recitationClasses={recitationClasses}
            setRecitationClasses={setRecitationClasses}
            metadataMap={metadataMap}
            onAssignMetadata={onAssignMetadata}
            currentUser={currentUser}
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
