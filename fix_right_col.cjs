const fs = require('fs');
let code = fs.readFileSync('src/components/KantinPanel.tsx', 'utf-8');

const regex = /\{\/\* Box Kas Terkini & Proyeksi \*\/\}[\s\S]*?\{\/\* Riwayat Terakhir untuk Kantin Terpilih \*\/\}/;
const newBox = `{/* Box Kas Terkini & Proyeksi */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-blue-600" />
                Ringkasan Kas {selectedKantinInput}
              </h3>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sisa Kas Sebelumnya</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatRupiah(currentKasSelectedKantin)}</span>
                </div>
                
                {(uangMasukNum > 0 || uangKeluarNum > 0) && (
                  <>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                        <ArrowDownLeft className="w-3 h-3 text-emerald-500" /> Uang Masuk
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        + {formatRupiah(uangMasukNum)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                        <ArrowUpRight className="w-3 h-3 text-rose-500" /> Uang Keluar
                      </span>
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        - {formatRupiah(uangKeluarNum)}
                      </span>
                    </div>
                  </>
                )}
                
                <div className="pt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">Proyeksi Kas Akhir</span>
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                    {formatRupiah(proyeksiKas)}
                  </span>
                </div>
              </div>
            </div>

            {/* Riwayat Terakhir untuk Kantin Terpilih */}`;

code = code.replace(regex, newBox);
fs.writeFileSync('src/components/KantinPanel.tsx', code);
