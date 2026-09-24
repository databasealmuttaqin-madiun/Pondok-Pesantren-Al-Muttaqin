import React, { useState, useEffect } from "react";
import { 
  Search, RefreshCw, User, Phone, GraduationCap, Sparkles 
} from "lucide-react";
import PageHeader from "./PageHeader";
import { supabase } from "../supabaseClient";

interface GuruSekolahProfile {
  id?: string;
  created_at?: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  nomor_hp?: string;
  kategori_guru: string;
  pengguna_id?: string;
  username?: string;
  foto_diri?: string;
}

interface DaftarGuruSekolahPanelProps {
  currentUser?: { username: string; role: string; name: string; gender?: string } | null;
}

export default function DaftarGuruSekolahPanel({ currentUser }: DaftarGuruSekolahPanelProps) {
  const [profiles, setProfiles] = useState<GuruSekolahProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const { data: dbGuru } = await supabase
        .from("guru")
        .select("id, created_at, nama_lengkap, jenis_kelamin, nomor_hp, kategori_guru, pengguna_id");

      const { data: dbPengguna } = await supabase
        .from("pengguna")
        .select("id, username, nama_lengkap, no_hp, peran_utama, gender");

      const pMap = new Map<string, any>();
      if (dbPengguna) {
        dbPengguna.forEach((u: any) => pMap.set(String(u.id), u));
      }

      const cleanKey = (name: string) => {
        return (name || "")
          .toLowerCase()
          .replace(/(s\.pd\.i|s\.pd|s\.s|m\.pd|s\.kom|s\.ag|m\.ag|s\.t|m\.t|lc|ustadz|ustadzah|ust\.|dr\.|drs\.|dra\.|h\.|hj\.)/gi, "")
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      };

      const combinedMap = new Map<string, GuruSekolahProfile>();

      if (dbGuru && dbGuru.length > 0) {
        dbGuru.forEach((g: any) => {
          const linkedPengguna = g.pengguna_id ? pMap.get(String(g.pengguna_id)) : null;
          const uname = linkedPengguna?.username || "";
          const fullName = g.nama_lengkap || linkedPengguna?.nama_lengkap || "Guru";
          const key = cleanKey(fullName) || (uname ? uname.toLowerCase() : String(g.id));

          if (combinedMap.has(key)) {
            const existing = combinedMap.get(key)!;
            combinedMap.set(key, {
              ...existing,
              nama_lengkap: fullName.length > existing.nama_lengkap.length ? fullName : existing.nama_lengkap,
              nomor_hp: existing.nomor_hp || g.nomor_hp || linkedPengguna?.no_hp || "",
              username: existing.username || uname
            });
          } else {
            combinedMap.set(key, {
              id: g.id,
              created_at: g.created_at,
              nama_lengkap: fullName,
              jenis_kelamin: (g.jenis_kelamin === "P" || linkedPengguna?.gender === "P") ? "P" : "L",
              nomor_hp: g.nomor_hp || linkedPengguna?.no_hp || "",
              kategori_guru: g.kategori_guru || linkedPengguna?.peran_utama || "Guru SMP",
              pengguna_id: g.pengguna_id,
              username: uname
            });
          }
        });
      }

      if (dbPengguna) {
        dbPengguna.forEach((u: any) => {
          const role = String(u.peran_utama || u.role || "").toLowerCase();
          if (role.includes("guru") || role.includes("smp") || role.includes("sekolah")) {
            const fullName = u.nama_lengkap || u.username;
            const key = cleanKey(fullName) || (u.username ? u.username.toLowerCase() : `pengguna_${u.id}`);
            
            if (combinedMap.has(key)) {
              const existing = combinedMap.get(key)!;
              combinedMap.set(key, {
                ...existing,
                username: existing.username || u.username,
                nomor_hp: existing.nomor_hp || u.no_hp || "",
                pengguna_id: existing.pengguna_id || u.id
              });
            } else {
              combinedMap.set(key, {
                id: undefined,
                nama_lengkap: fullName,
                jenis_kelamin: u.gender === "P" ? "P" : "L",
                nomor_hp: u.no_hp || "",
                kategori_guru: u.peran_utama || "Guru SMP",
                pengguna_id: u.id,
                username: u.username
              });
            }
          }
        });
      }

      const list = Array.from(combinedMap.values());
      setProfiles(list);
      localStorage.setItem("guru_sekolah_all_profiles", JSON.stringify(list));
    } catch (err) {
      console.warn("Error fetching profiles:", err);
      const saved = localStorage.getItem("guru_sekolah_all_profiles");
      if (saved) {
        try {
          setProfiles(JSON.parse(saved));
        } catch (_) {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const filteredProfiles = profiles.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.nama_lengkap?.toLowerCase().includes(q) ||
      p.nomor_hp?.toLowerCase().includes(q) ||
      p.kategori_guru?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        category="Sekolah" 
        title="Daftar Guru Sekolah" 
        description="Direktori profil dan data kontak seluruh guru pendidik sekolah."
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Direktori Profil Guru Sekolah
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daftar lengkap data guru pendidik yang terdaftar di sekolah.
            </p>
          </div>
          
          <button
            onClick={fetchProfiles}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> 
            <span>Segarkan</span>
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-400 w-4 h-4" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 dark:text-slate-100"
            placeholder="Cari berdasarkan nama lengkap, nomor HP, atau kategori guru..."
          />
        </div>

        {filteredProfiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProfiles.map((guru, idx) => (
              <div 
                key={`guru-${guru.id || guru.username || idx}`} 
                className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 hover:shadow-md transition-all space-y-4 bg-white dark:bg-slate-900"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-100 dark:border-blue-800/50 shrink-0">
                    {guru.nama_lengkap ? guru.nama_lengkap.charAt(0).toUpperCase() : "G"}
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" /> {guru.kategori_guru || "Guru SMP"}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        guru.jenis_kelamin === "P" 
                          ? "bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-100 dark:border-pink-800/50" 
                          : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50"
                      }`}>
                        {guru.jenis_kelamin === "P" ? "Perempuan" : "Laki-laki"}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                      {guru.nama_lengkap || "-"}
                    </h4>
                    
                    {guru.username && (
                      <p className="text-xs text-slate-400 font-medium">
                        Akun: <span className="font-mono text-slate-600 dark:text-slate-300">{guru.username}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/40 p-3 rounded-xl">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No. WhatsApp</p>
                    {guru.nomor_hp ? (
                      <a 
                        href={`https://wa.me/${String(guru.nomor_hp).replace(/[^0-9]/g, "")}`}
                        target="_blank" 
                        rel="noreferrer"
                        className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-0.5 truncate"
                      >
                        <Phone className="w-3 h-3 text-emerald-500 shrink-0" /> {guru.nomor_hp}
                      </a>
                    ) : (
                      <p className="text-slate-400 font-medium mt-0.5">-</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kategori</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5 truncate">{guru.kategori_guru || "Guru SMP"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <User className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tidak ditemukan profil guru yang cocok.</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata pencarian Anda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
