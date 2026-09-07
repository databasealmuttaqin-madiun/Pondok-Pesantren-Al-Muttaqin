const fs = require('fs');
let code = fs.readFileSync('src/components/KantinPanel.tsx', 'utf-8');

const regex = /\{\/\* 2\. Jenis Transaksi: Masuk vs Keluar \*\/\}[\s\S]*?\{\/\* 5\. Keterangan \*\/\}/;
const newUI = `{/* 2. Tanggal Transaksi */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tanggal Rekap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* 3. Nominal Uang Masuk & Keluar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Total Uang Masuk (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      placeholder="0"
                      value={uangMasukStr}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\\D/g, "");
                        setUangMasukStr(raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "");
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Total Uang Keluar (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="text"
                      placeholder="0"
                      value={uangKeluarStr}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\\D/g, "");
                        setUangKeluarStr(raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "");
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 text-slate-800 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Keterangan */}`;

code = code.replace(regex, newUI);

// Fix other dependencies like `proyeksiKas` and `nominalNumber`.
// We need to look at what `nominalNumber` was doing.
// Let's remove `nominalNumber` and `proyeksiKas` usages if they exist in the right column.

fs.writeFileSync('src/components/KantinPanel.tsx', code);
