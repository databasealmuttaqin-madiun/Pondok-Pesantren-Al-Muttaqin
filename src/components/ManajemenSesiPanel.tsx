import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Clock, Plus, Edit, Trash2, Save, X } from "lucide-react";
import { showSuccess, showError, showWarning, showToast, showDeleteConfirm } from "../utils/sweetalert";

export default function ManajemenSesiPanel() {
  const [sesiList, setSesiList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nama_sesi: "", urutan: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    fetchSesi();
  }, []);

  const fetchSesi = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("sesi_mengaji")
      .select("*")
      .order("urutan", { ascending: true });
    
    if (error) {
      console.error(error);
    } else {
      setSesiList(data || []);
    }
    setIsLoading(false);
  };

  const handleSaveAdd = async () => {
    if (!editForm.nama_sesi.trim()) {
      showWarning("Nama Sesi Diperlukan", "Harap isi nama sesi mengaji.");
      return;
    }
    
    const { error } = await supabase
      .from("sesi_mengaji")
      .insert([{ nama_sesi: editForm.nama_sesi.trim(), urutan: editForm.urutan }]);
      
    if (error) {
      showError("Gagal Menambah Sesi", error.message);
    } else {
      setShowAddForm(false);
      setEditForm({ nama_sesi: "", urutan: 0 });
      showSuccess("Berhasil", "Sesi mengaji baru berhasil ditambahkan.");
      fetchSesi();
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.nama_sesi.trim()) {
      showWarning("Nama Sesi Diperlukan", "Nama sesi tidak boleh kosong.");
      return;
    }
    
    const { error } = await supabase
      .from("sesi_mengaji")
      .update({ nama_sesi: editForm.nama_sesi.trim(), urutan: editForm.urutan })
      .eq("id", id);
      
    if (error) {
      showError("Gagal Mengubah Sesi", error.message);
    } else {
      setIsEditing(null);
      setEditForm({ nama_sesi: "", urutan: 0 });
      showToast("Sesi berhasil diperbarui", "success");
      fetchSesi();
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    const isConfirmed = await showDeleteConfirm(`sesi "${nama}"`);
    if (!isConfirmed) return;
    
    const { error } = await supabase
      .from("sesi_mengaji")
      .delete()
      .eq("id", id);
      
    if (error) {
      showError("Gagal Menghapus Sesi", error.message);
    } else {
      showToast(`Sesi "${nama}" berhasil dihapus`, "success");
      fetchSesi();
    }
  };

  const startEdit = (sesi: any) => {
    setIsEditing(sesi.id);
    setEditForm({ nama_sesi: sesi.nama_sesi, urutan: sesi.urutan });
    setShowAddForm(false);
  };

  const startAdd = () => {
    setShowAddForm(true);
    setIsEditing(null);
    setEditForm({ nama_sesi: "", urutan: sesiList.length + 1 });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Manajemen Sesi Mengaji
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Kelola daftar sesi pengajian (misal: Subuh, Sore, Malam).
          </p>
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Tambah Sesi
        </button>
      </div>

      {dbError && (
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800 mb-6">
          <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Perhatian: Tabel Database Belum Dibuat!</h3>
          <p className="text-sm text-red-700 dark:text-red-400 mb-4">
            Sistem mendeteksi bahwa tabel <strong>sesi_mengaji</strong> belum ada di database Supabase Anda. Anda perlu menjalankan kode SQL berikut di <strong>SQL Editor Supabase</strong>:
          </p>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto select-all">
{`-- 1. Buat Tabel Sesi Mengaji
CREATE TABLE public.sesi_mengaji (
    id SERIAL PRIMARY KEY,
    nama_sesi TEXT NOT NULL,
    urutan INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tambahkan kolom sesi_id ke jurnal_pengajian
ALTER TABLE public.jurnal_pengajian 
ADD COLUMN sesi_id INT REFERENCES public.sesi_mengaji(id) ON DELETE SET NULL;

-- 3. Set RLS (Row Level Security) agar tabel bisa diakses
ALTER TABLE public.sesi_mengaji ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bisa dibaca oleh semua" ON public.sesi_mengaji FOR SELECT USING (true);
CREATE POLICY "Bisa diubah oleh pengguna login" ON public.sesi_mengaji USING (auth.role() = 'authenticated');

-- 4. Isi Data Sesi Awal
INSERT INTO public.sesi_mengaji (nama_sesi, urutan) VALUES 
('Sesi 1 (Subuh)', 1),
('Sesi 2 (Sore)', 2),
('Sesi 3 (Malam)', 3);`}
          </pre>
          <p className="text-xs text-red-600 dark:text-red-400 mt-3 font-semibold">
            Setelah Anda menjalankan SQL di atas di Supabase, silakan refresh halaman ini.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 text-xs font-semibold uppercase">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">No/Urutan</th>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">Nama Sesi</th>
                <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {showAddForm && (
                <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={editForm.urutan}
                      onChange={(e) => setEditForm({...editForm, urutan: Number(e.target.value)})}
                      className="w-20 rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={editForm.nama_sesi}
                      onChange={(e) => setEditForm({...editForm, nama_sesi: e.target.value})}
                      placeholder="Nama Sesi (Misal: Sesi 1)"
                      className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={handleSaveAdd} className="p-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200"><Save className="w-4 h-4" /></button>
                      <button onClick={() => setShowAddForm(false)} className="p-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200"><X className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )}
              
              {sesiList.length === 0 && !showAddForm ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Belum ada data sesi mengaji.
                  </td>
                </tr>
              ) : (
                sesiList.map((sesi) => (
                  <tr key={sesi.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      {isEditing === sesi.id ? (
                        <input
                          type="number"
                          value={editForm.urutan}
                          onChange={(e) => setEditForm({...editForm, urutan: Number(e.target.value)})}
                          className="w-20 rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500"
                        />
                      ) : (
                        sesi.urutan
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing === sesi.id ? (
                        <input
                          type="text"
                          value={editForm.nama_sesi}
                          onChange={(e) => setEditForm({...editForm, nama_sesi: e.target.value})}
                          className="w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500"
                        />
                      ) : (
                        <span className="font-medium text-slate-800 dark:text-slate-200">{sesi.nama_sesi}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing === sesi.id ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleSaveEdit(sesi.id)} className="p-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200"><Save className="w-4 h-4" /></button>
                          <button onClick={() => setIsEditing(null)} className="p-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEdit(sesi)} className="p-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(sesi.id, sesi.nama_sesi)} className="p-1.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
