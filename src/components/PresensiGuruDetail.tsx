import React from "react";
import AbsensiGuruPanel from "./AbsensiGuruPanel";

interface PresensiGuruDetailProps {
  currentUser?: { 
    username: string; 
    role: string; 
    name: string; 
    id?: string; 
    gender?: string;
  } | null;
  initialSubTab?: "absensi" | "mengajar" | "semua_guru";
  onSubTabChange?: (tab: "absensi" | "mengajar" | "semua_guru") => void;
}

export default function PresensiGuruDetail({ currentUser, initialSubTab, onSubTabChange }: PresensiGuruDetailProps) {
  return (
    <AbsensiGuruPanel 
      currentUser={currentUser} 
      initialSubTab={initialSubTab} 
      onSubTabChange={onSubTabChange} 
    />
  );
}

