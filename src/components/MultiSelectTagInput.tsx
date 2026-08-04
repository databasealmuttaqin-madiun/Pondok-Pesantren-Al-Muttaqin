import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";

export interface OptionItem {
  id: string;
  label: string;
}

interface MultiSelectTagInputProps {
  selectedValues: string[];
  onChange: (values: string[]) => void;
  options: (string | OptionItem)[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const MultiSelectTagInput: React.FC<MultiSelectTagInputProps> = ({
  selectedValues,
  onChange,
  options,
  placeholder = "Pilih data...",
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to OptionItem format
  const normalizedOptions: OptionItem[] = options.map((opt) =>
    typeof opt === "string" ? { id: opt, label: opt } : opt
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (id: string) => {
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter((v) => v !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const handleRemoveTag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== id));
  };

  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Input Field Container */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[44px] flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl transition-all cursor-pointer ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : ""}`}
      >
        {selectedValues.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {selectedValues.map((val) => {
              const item = normalizedOptions.find((o) => o.id === val);
              const label = item ? item.label : val;
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/90 dark:border-blue-800/80 rounded-lg text-xs font-semibold animate-in zoom-in-95 duration-150 select-none"
                >
                  <span className="truncate max-w-[180px]">{label}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveTag(e, val)}
                    className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 transition-colors p-0.5 rounded cursor-pointer flex items-center justify-center"
                    title="Hapus"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 select-none py-1">
            {placeholder}
          </span>
        )}

        {/* Right Arrow Chevron */}
        <div className="ml-auto pl-1 text-slate-400 shrink-0">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-500" : ""
            }`}
          />
        </div>
      </div>

      {/* Dropdown Options Overlay */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Optional Filter/Search Input */}
          {normalizedOptions.length > 5 && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <input
                type="text"
                placeholder="Cari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-800 dark:text-white"
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-slate-400 text-center font-medium">
                Tidak ada pilihan.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleToggleOption(opt.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center justify-between select-none ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.5]" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectTagInput;
