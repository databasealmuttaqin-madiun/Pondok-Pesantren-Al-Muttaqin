import sys

with open("src/App.tsx", "r") as f:
    lines = f.readlines()

new_block = """            {/* 5. PENGAJIAN GROUP (ACCORDION) */}
            {accessibleTabs.some(t => t.group === "PENGAJIAN") && (!sidebarSearchQuery || "pengajian materi target capaian".includes(sidebarSearchQuery.toLowerCase())) && (
              <div 
                className="w-full pt-1.5 relative group/flyout"
                onMouseEnter={() => setHoveredFlyout("pengajian")}
                onMouseLeave={() => setHoveredFlyout(null)}
              >
                {!sidebarCollapsed ? (
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
                ) : (
                  <div className="w-full flex justify-center py-1">
                    <button
                      onClick={() => setIsPengajianExpanded(!isPengajianExpanded)}
                      className={`p-2 rounded-xl transition-colors ${
                        ["manajemen_materi", "target_pengajian"].includes(activeTab)
                          ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                          : "text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                      }`}
                      title="Pengajian"
                    >
                      <BookOpen className="w-4.5 h-4.5" />
                    </button>
                  </div>
                )}
                {/* Expanded Inline Submenu */}
                {!sidebarCollapsed && isPengajianExpanded && (
                  <div className="space-y-0.5 mt-0.5">
                    {accessibleTabs.filter(t => t.group === "PENGAJIAN").map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTab(sub.id as any)}
                          className={`w-full flex items-center justify-start px-3 py-2 gap-3 rounded-xl transition-all text-xs ${
                            isSubActive
                              ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/60"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`} />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed Flyout Popover */}
                {sidebarCollapsed && hoveredFlyout === "pengajian" && (
                  <div className="absolute left-full top-0 ml-2 z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      Pengajian
                    </div>
                    {accessibleTabs.filter(t => t.group === "PENGAJIAN").map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = activeTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveTab(sub.id as any)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            isSubActive
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <SubIcon className="w-4 h-4 text-slate-400" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
"""

for i in range(len(lines)):
    if "            {/* 4. PLOTTING / MANAJEMEN GROUP (ACCORDION) */}" in lines[i]:
        # found the start of plotting group
        pass
    if '            )}' in lines[i] and '</nav>' in lines[i+1]:
        # we found the end of the navigation. Insert pengajian group before </nav>
        lines.insert(i + 1, new_block)
        break

with open("src/App.tsx", "w") as f:
    f.writelines(lines)
