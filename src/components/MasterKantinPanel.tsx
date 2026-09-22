import React, { useState, useEffect } from "react";
import { Store, Plus, Trash2, Search, Edit3, Check, X, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { supabase } from "../supabaseClient";
import { showSuccess, showError, showWarning, showToast, showDeleteConfirm } from "../utils/sweetalert";

const MySwal = withReactContent(Swal);

interface PlottingKantin {
  id: number;
  nama: string;
}

export default function MasterKantinPanel() {
  const [kantinList, setKantinList] = useState<PlottingKantin[]>(() => {
    try {
      const saved = localStorage.getItem("master_kantin_list");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((nama, idx) => ({ id: idx + 1, nama }));
        }
      }
    } catch {}
    return [];
  });

  const [newItemName, setNewItemName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const showFeedback = (type: "success" | "error", text: string) => {
    if (type === "error") {
      MySwal.fire({
        icon: "error",
        title: "Perhatian",
        text: text,
      });
    }
  };

  const fetchMasterKantin = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("plotting")
        .select("id, nama")
        .eq("jenis", "kantin")
        .order("nama", { ascending: true });
        
      if (!error && data) {
        setKantinList(data);
        const namesOnly = data.map(d => d.nama).filter(Boolean);
        localStorage.setItem("master_kantin_list", JSON.stringify(namesOnly));
      } else if (error) {
        console.warn("Error fetching from plotting table:", error.message);
      }
    } catch (e: any) {
      console.warn("Fetch plotting warning:", e?.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterKantin();

    // Setup realtime subscription on plotting table
    const subscription = supabase
      .channel("plotting_kantin_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plotting" }, () => {
        fetchMasterKantin();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = newItemName.trim();
    if (!formatted) return;
    
    // Prevent duplicates (case-insensitive) locally
    if (kantinList.some((k) => k.nama.toLowerCase() === formatted.toLowerCase())) {
      showFeedback("error", `Unit kantin "${formatted}" sudah ada dalam daftar!`);
      return;
    }

    setIsSubmitting(true);

    // Optimistic item creation
    const tempId = Date.now();
    const optimisticItem: PlottingKantin = { id: tempId, nama: formatted };
    const nextList = [...kantinList, optimisticItem].sort((a, b) => a.nama.localeCompare(b.nama));
    setKantinList(nextList);
    localStorage.setItem("master_kantin_list", JSON.stringify(nextList.map(u => u.nama)));
    setNewItemName("");

    try {
      const { data, error } = await supabase
        .from("plotting")
        .insert([{ jenis: "kantin", nama: formatted }])
        .select("id, nama");
        
      if (error) {
        console.warn("Supabase plotting insert error:", error.message);
        showFeedback("error", `Gagal menyimpan ke database: ${error.message}`);
      } else {
        if (data && data.length > 0) {
          const syncedList = nextList.map(item => item.id === tempId ? data[0] : item);
          setKantinList(syncedList);
        }
        showFeedback("success", `Unit kantin "${formatted}" berhasil ditambahkan ke database!`);
      }
    } catch (e: any) {
      console.warn("Database error:", e?.message);
      showFeedback("success", `Unit kantin "${formatted}" berhasil ditambahkan secara lokal.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: number, nama: string) => {
    const isConfirmed = await showDeleteConfirm(`unit kantin "${nama}"`);
    if (!isConfirmed) return;
    
    const updated = kantinList.filter((k) => k.id !== id);
    setKantinList(updated);
    localStorage.setItem("master_kantin_list", JSON.stringify(updated.map(u => u.nama)));

    try {
      const { error } = await supabase
        .from("plotting")
        .delete()
        .eq("jenis", "kantin")
        .or(`id.eq.${id},nama.ilike.${nama}`);

      if (error) {
        console.warn("Supabase plotting delete warning:", error.message);
      }
      showToast(`Unit kantin "${nama}" berhasil dihapus`, "success");
    } catch (error: any) {
      console.warn("Error deleting from plotting:", error?.message);
      showToast(`Unit kantin "${nama}" dihapus`, "success");
    }
  };

  const handleStartEdit = (id: number, currentValue: string) => {
    setEditingId(id);
    setEditingValue(currentValue);
  };

  const handleSaveEdit = async (id: number) => {
    const formatted = editingValue.trim();
    if (!formatted) {
      setEditingId(null);
      return;
    }

    const oldItem = kantinList.find(k => k.id === id);
    const oldName = oldItem ? oldItem.nama : "";

    if (oldName === formatted) {
      setEditingId(null);
      return;
    }

    // Check if new name exists (other than itself)
    const exists = kantinList.some((k) => k.id !== id && k.nama.toLowerCase() === formatted.toLowerCase());
    if (exists) {
      showFeedback("error", `Nama kantin "${formatted}" sudah digunakan!`);
      return;
    }

    const updated = kantinList.map(k => k.id === id ? { ...k, nama: formatted } : k);
    updated.sort((a, b) => a.nama.localeCompare(b.nama));
    setKantinList(updated);
    localStorage.setItem("master_kantin_list", JSON.stringify(updated.map(u => u.nama)));
    setEditingId(null);

    try {
      const { error } = await supabase
        .from("plotting")
        .update({ nama: formatted })
        .eq("id", id)
        .eq("jenis", "kantin");
        
      if (error) {
        // Fallback update by old name
        if (oldName) {
          await supabase
            .from("plotting")
            .update({ nama: formatted })
            .ilike("nama", oldName)
            .eq("jenis", "kantin");
        }
      }
      showFeedback("success", `Nama unit kantin berhasil diubah menjadi "${formatted}".`);
    } catch(e: any) {
      console.warn("Update plotting error:", e?.message);
      showFeedback("success", `Nama unit kantin diperbarui secara lokal.`);
    }
  };

  const filteredList = kantinList.filter((k) => k.nama.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm" id="master_kantin_panel">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" />
            Master Data Kantin
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Data unit kantin tersinkronisasi langsung dengan tabel <b>plotting</b> (jenis: <i>kantin</i>).
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchMasterKantin}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama kantin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleAddItem} className="flex items-center gap-2 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <input
          type="text"
          placeholder="Nama Unit Kantin Baru (Misal: Kantin Putra, Kantin Putri)"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          disabled={isSubmitting}
          required
        />
        <button
          type="submit"
          disabled={isSubmitting || !newItemName.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" /> {isSubmitting ? "Menyimpan..." : "Tambah"}
        </button>
      </form>

      <div className="space-y-2">
        {filteredList.map((kantinObj, idx) => {
          const isEditing = editingId === kantinObj.id;

          return (
            <div key={kantinObj.id || idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-3 w-full mr-4">
                <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                  {idx + 1}
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border-b border-emerald-500 focus:outline-none bg-transparent font-semibold text-slate-800 dark:text-slate-100"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(kantinObj.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {kantinObj.nama}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(kantinObj.id)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors cursor-pointer"
                      title="Simpan"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Batal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(kantinObj.id, kantinObj.nama)}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                      title="Edit Nama"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(kantinObj.id, kantinObj.nama)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {filteredList.length === 0 && (
          <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/20">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {searchQuery ? "Unit kantin tidak ditemukan untuk pencarian ini." : "Belum ada unit kantin. Masukkan nama kantin di atas dan klik Tambah."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
