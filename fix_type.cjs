const fs = require('fs');
let code = fs.readFileSync('src/components/KantinPanel.tsx', 'utf-8');

// The error on `patched_form.tsx` is irrelevant because it's some other file.
// Let's remove the edit modal's dependency on `jenis === "masuk" | "keluar"` by adapting it for `rekap`.

const editModalRegex = /<select[\s\S]*?value=\{editingItem\.jenis\}[\s\S]*?<\/select>/m;
const newEditModalSelect = `<select
                    value={editingItem.jenis}
                    onChange={(e) => setEditingItem({ ...editingItem, jenis: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="rekap">Rekap Harian</option>
                    <option value="masuk">Uang Masuk (Lama)</option>
                    <option value="keluar">Uang Keluar (Lama)</option>
                  </select>`;
code = code.replace(editModalRegex, newEditModalSelect);

const editNominalRegex = /<input[\s\S]*?value=\{editingItem\.jenis === "masuk" \? editingItem\.uang_masuk : editingItem\.uang_keluar\}[\s\S]*?\}\} \/>/m;
const newEditNominal = `<div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Masuk</label>
                    <input
                      type="number"
                      value={editingItem.uang_masuk}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10) || 0;
                        setEditingItem({ ...editingItem, uang_masuk: num });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Keluar</label>
                    <input
                      type="number"
                      value={editingItem.uang_keluar}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10) || 0;
                        setEditingItem({ ...editingItem, uang_keluar: num });
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs"
                    />
                  </div>
                </div>`;
code = code.replace(editNominalRegex, newEditNominal);

const saveEditRegex = /const uangMasuk = editingItem\.jenis === "masuk" \? editingItem\.uang_masuk : 0;\s*const uangKeluar = editingItem\.jenis === "keluar" \? editingItem\.uang_keluar : 0;/;
const newSaveEdit = `const uangMasuk = editingItem.uang_masuk || 0;
    const uangKeluar = editingItem.uang_keluar || 0;`;
code = code.replace(saveEditRegex, newSaveEdit);

const historyBadgeRegex = /<div\s*className=\{\`font-bold shrink-0 text-xs \$\{\s*t\.jenis === "masuk" \? "text-emerald-600" : "text-rose-600"\s*\}\`\}\s*>\s*\{t\.jenis === "masuk" \? "\+" : "- "\} \{formatRupiah\(t\.uang_masuk \|\| t\.uang_keluar\)\}\s*<\/div>/m;
const newHistoryBadge = `<div className="text-right shrink-0">
                        {t.uang_masuk > 0 && <div className="text-xs font-bold text-emerald-600">+{formatRupiah(t.uang_masuk)}</div>}
                        {t.uang_keluar > 0 && <div className="text-xs font-bold text-rose-600">-{formatRupiah(t.uang_keluar)}</div>}
                      </div>`;
code = code.replace(historyBadgeRegex, newHistoryBadge);

const listBadgeRegex = /<span className=\{\`inline-flex items-center gap-1\.5 px-2\.5 py-1 rounded-full text-\[10px\] font-bold \$\{\s*item\.jenis === "masuk"\s*\? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900\/30 dark:text-emerald-400"\s*: "bg-rose-100 text-rose-700 dark:bg-rose-900\/30 dark:text-rose-400"\s*\}\`\}>\s*\{item\.jenis === "masuk" \? \(\s*<ArrowDownLeft className="w-3 h-3" \/>\s*\) : \(\s*<ArrowUpRight className="w-3 h-3" \/>\s*\)\}\s*\{item\.jenis === "masuk" \? "Uang Masuk" : "Uang Keluar"\}\s*<\/span>/m;
const newListBadge = `<span className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400\`}>
                        Rekap
                      </span>`;
code = code.replace(listBadgeRegex, newListBadge);

// Handle export text in CSV
const exportRegex = /item\.jenis === "masuk" \? "Uang Masuk" : "Uang Keluar"/g;
code = code.replace(exportRegex, `item.jenis === "rekap" ? "Rekap Harian" : (item.jenis === "masuk" ? "Uang Masuk" : "Uang Keluar")`);

fs.writeFileSync('src/components/KantinPanel.tsx', code);
