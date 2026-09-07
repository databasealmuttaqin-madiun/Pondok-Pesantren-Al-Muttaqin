import React, { useState, useEffect } from "react";
import { Store, Plus, Trash2, Search, Edit3, Check, X, RefreshCw } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function MasterKantinPanel() {
  const [kantinList, setKantinList] = useState<{ id: number; nama: string }[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const fetchMasterKantin = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("master_kantin")
        .select("*")
        .order("nama", { ascending: true });
        
      if (data) {
        setKantinList(data);
        // Sync back to local storage so other components (like KantinPanel) can read it quickly
        const namesOnly = data.map(d => d.nama);
        localStorage.setItem("master_kantin_list", JSON.stringify(namesOnly));
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMasterKantin();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = newItemName.trim();
    if (!formatted) return;
    
    // Prevent duplicates (case-insensitive) locally
    if (kantinList.some((k) => k.nama.toLowerCase() === formatted.toLowerCase())) {
      alert("Nama kantin sudah ada!");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("master_kantin")
        .insert([{ nama: formatted }])
        .select();
        
      if (error) {
         alert("Gagal menyimpan data: " + error.message);
         return;
      }
      if (data) {
        const updated = [...kantinList, data[0]].sort((a, b) => a.nama.localeCompare(b.nama));
        setKantinList(updated);
        localStorage.setItem("master_kantin_list", JSON.stringify(updated.map(u => u.nama)));
        setNewItemName("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = async (id: number, nama: string) => {
    if (!confirm(`Hapus unit kantin "${nama}"?`)) return;
    
    try {
      await supabase.from("master_kantin").delete().eq("id", id);
      const updated = kantinList.filter((k) => k.id !== id);
      setKantinList(updated);
      localStorage.setItem("master_kantin_list", JSON.stringify(updated.map(u => u.nama)));
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat menghapus");
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

    // Check if new name exists (other than itself)
    const exists = kantinList.some((k) => k.id !== id && k.nama.toLowerCase() === formatted.toLowerCase());
    if (exists) {
      alert("Nama kantin sudah digunakan!");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("master_kantin")
        .update({ nama: formatted })
        .eq("id", id)
        .select();
        
      if (error) {
         alert("Gagal update data: " + error.message);
         return;
      }
      if (data) {
        const updated = kantinList.map(k => k.id === id ? data[0] : k);
        updated.sort((a, b) => a.nama.localeCompare(b.nama));
        setKantinList(updated);
        localStorage.setItem("master_kantin_list", JSON.stringify(updated.map(u => u.nama)));
        setEditingId(null);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const filteredList = kantinList.filter((k) => k.nama.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-600" />
            Master Data Kantin
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kelola nama-nama unit kantin yang akan tersedia di modul Kantin.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchMasterKantin}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"
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
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleAddItem} className="flex items-center gap-2 mb-6 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <input
          type="text"
          placeholder="Nama Unit Kantin Baru (Misal: Kantin Putra 2)"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-900"
          required
        />
        <button
          type="submit"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </form>

      <div className="space-y-2">
        {filteredList.map((kantinObj, idx) => {
          const isEditing = editingId === kantinObj.id;

          return (
            <div key={kantinObj.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-3 w-full mr-4">
                <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                  {idx + 1}
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border-b border-emerald-500 focus:outline-none bg-transparent font-semibold"
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
              
              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => handleSaveEdit(kantinObj.id)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                      title="Simpan"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Batal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(kantinObj.id, kantinObj.nama)}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="Edit Nama"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(kantinObj.id, kantinObj.nama)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
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
              Data unit kantin tidak ditemukan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
