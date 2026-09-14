import sys

with open("src/App.tsx", "r") as f:
    lines = f.readlines()

new_block = """
              {/* PENGAJIAN GROUP */}
              {accessibleTabs.some(t => t.group === "PENGAJIAN") && (
                <div className="pt-1.5">
                  <div
                    onClick={() => setIsPengajianExpanded(!isPengajianExpanded)}
                    className="px-3 pt-2 pb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none transition-colors"
                  >
                    <span>Pengajian</span>
                    {isPengajianExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>

                  {isPengajianExpanded && (
                    <div className="space-y-0.5 mt-0.5">
                      {accessibleTabs.filter(t => t.group === "PENGAJIAN").map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = activeTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setActiveTab(sub.id as any);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs ${
                              isSubActive
                                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
"""

for i in range(len(lines)):
    if "              {/* PLOTTING GROUP */}" in lines[i]:
        pass
    if '              )}' in lines[i] and '            </div>' in lines[i+1] and '            {/* Mobile Sidebar Footer */}' in lines[i+3]:
        lines.insert(i + 1, new_block)
        break

with open("src/App.tsx", "w") as f:
    f.writelines(lines)
