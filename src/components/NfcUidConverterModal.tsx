import React, { useState } from "react";
import { X, ArrowRightLeft, Copy, Check, Sparkles, Smartphone, Usb, Cpu, HelpCircle, CheckCircle2 } from "lucide-react";
import { convertNfcUid, isNfcMatch } from "../utils/nfcConverter";
import { SantriData } from "../supabaseClient";

interface NfcUidConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: SantriData[];
  initialUid?: string;
  onApplyUid?: (uid: string) => void;
}

export default function NfcUidConverterModal({
  isOpen,
  onClose,
  students = [],
  initialUid = "08:08:A1:B2",
  onApplyUid
}: NfcUidConverterModalProps) {
  const [inputVal, setInputVal] = useState<string>(initialUid);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const result = convertNfcUid(inputVal);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
  };

  // Find if any student matches this card in any representation
  const matchedStudent = inputVal ? students.find(s => s.nfc_id && isNfcMatch(inputVal, s.nfc_id)) : null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in" id="nfc_converter_modal">
      <div className="bg-white dark:bg-[#111c44] rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-150 dark:border-slate-800 flex flex-col my-auto max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-6 py-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 shadow-inner">
              <ArrowRightLeft className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider leading-tight flex items-center gap-2">
                <span>Konversi Format UID NFC</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold uppercase">Hex ⇄ Decimal</span>
              </h3>
              <p className="text-xs text-indigo-100 font-medium mt-0.5">
                Konversi otomatis Hex HP ke format Decimal alat NFC Reader fisik
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          
          {/* Input Box */}
          <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Masukkan Kode UID Kartu (Hex atau Decimal):</span>
              <span className="text-[10px] font-normal text-slate-500 lowercase">contoh: 08:08:A1:B2 / 2996963336</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="08:08:A1:B2 atau 0808A1B2 atau 2996963336"
                className="flex-1 font-mono text-sm font-bold px-3.5 py-2.5 bg-white dark:bg-[#111c44] border border-slate-250 dark:border-slate-750 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setInputVal("08:08:A1:B2")}
                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Contoh Soal
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Contoh lain:</span>
              {[
                { label: "08:08:A1:B2 (Hex)", val: "08:08:A1:B2" },
                { label: "2996963336 (USB Reader)", val: "2996963336" },
                { label: "134783410 (Decimal Std)", val: "134783410" },
                { label: "A1:B2:C3:D4", val: "A1:B2:C3:D4" },
              ].map(chip => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => setInputVal(chip.val)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400 transition-all cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Matched Student Alert if any */}
          {matchedStudent && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                    Kartu Ini Terhubung ke Santri: {matchedStudent.nama_lengkap}
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    Kamar: {matchedStudent.kamar || "-"} • NFC ID tersimpan: <code className="font-bold">{matchedStudent.nfc_id}</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conversion Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: Konversi Reverse Byte (Little-Endian / USB Reader Output) */}
            <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/40 dark:from-indigo-950/30 dark:to-blue-950/20 border-2 border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-4.5 space-y-3 relative overflow-hidden shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-indigo-600 text-white shadow-sm">
                    <Usb className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block leading-tight">
                      1. HASIL ALAT NFC READER FISIK (USB)
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                      Reverse Byte (Little-Endian / LSB First)
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase">
                  Paling Umum di USB Reader
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Nilai Decimal (10-Digit):
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl font-black font-mono text-indigo-900 dark:text-indigo-200 tracking-tight">
                    {result.decimalReverse || "-"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(result.decimalReverse, "dec_rev")}
                    className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer"
                    title="Salin Decimal USB Reader"
                  >
                    {copiedKey === "dec_rev" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-[10.5px] text-slate-600 dark:text-slate-300 space-y-1 leading-relaxed bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-50 dark:border-slate-800">
                <p className="font-semibold text-indigo-900 dark:text-indigo-300">
                  🔍 <strong>Urutan Byte Dibalik:</strong>
                </p>
                <p className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  {result.hexColon || "-"} ➔ <strong>{result.hexReverseColon || "-"}</strong>
                </p>
                <p className="text-[9.5px] text-slate-500 dark:text-slate-400">
                  Hex <code>0x{result.hexReverse || "-"}</code> diubah ke desimal menghasilkan <strong>{result.decimalReverse || "-"}</strong>.
                </p>
              </div>

              {onApplyUid && result.decimalReverse && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyUid(result.decimalReverse);
                    onClose();
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Gunakan Format Ini Untuk Daftar
                </button>
              )}
            </div>

            {/* Card 2: Konversi Standar (Big-Endian) */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-3 relative overflow-hidden shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-purple-600 text-white shadow-sm">
                    <Smartphone className="w-4 h-4" />
                  </span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 block leading-tight">
                      2. KONVERSI STANDAR
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                      Big-Endian (MSB First / Urutan Asli)
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Nilai Decimal Standar:
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xl font-black font-mono text-slate-800 dark:text-white tracking-tight">
                    {result.decimalStandard || "-"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(result.decimalStandard, "dec_std")}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                    title="Salin Decimal Standar"
                  >
                    {copiedKey === "dec_std" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-[10.5px] text-slate-600 dark:text-slate-300 space-y-1 leading-relaxed bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-150 dark:border-slate-800">
                <p className="font-semibold text-purple-900 dark:text-purple-300">
                  🔍 <strong>Urutan Byte Normal:</strong>
                </p>
                <p className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  Hex <strong>0x{result.hexClean || "-"}</strong> ({result.hexColon || "-"})
                </p>
                <p className="text-[9.5px] text-slate-500 dark:text-slate-400">
                  Padded 10-Digit: <code>{result.decimalStandard10 || "-"}</code>
                </p>
              </div>

              {onApplyUid && result.decimalStandard && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyUid(result.decimalStandard);
                    onClose();
                  }}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Gunakan Format Ini Untuk Daftar
                </button>
              )}
            </div>

          </div>

          {/* Hex Summary Box */}
          <div className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Detail Format Hexadecimal (Sensor HP / NDEF Reader):</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Hex Format Titik Dua (HP):</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">{result.hexColon || "-"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(result.hexColon, "hex_colon")}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {copiedKey === "hex_colon" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Hex Raw (Tanpa Titik Dua):</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">{result.hexClean || "-"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(result.hexClean, "hex_clean")}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  {copiedKey === "hex_clean" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Explanatory Info Card */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/60 rounded-2xl p-4 space-y-2 text-blue-900 dark:text-blue-200 text-xs">
            <h5 className="font-black flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-blue-800 dark:text-blue-300">
              <HelpCircle className="w-4 h-4" />
              <span>Sistem Otomatis Mengenali Kedua Format!</span>
            </h5>
            <p className="leading-relaxed text-[11px] text-blue-800/90 dark:text-blue-300/90">
              Anda <strong>tidak perlu khawatir</strong> jika kartu didaftarkan melalui HP (Hex <code>08:08:A1:B2</code>) atau melalui alat USB Reader (Decimal <code>2996963336</code>). Sistem Absensi Al Muttaqin telah dilengkapi algoritma konversi dua arah otomatis, sehingga saat santri melakukan tap di HP maupun di alat reader USB fisik, presensi akan <strong>otomatis langsung terverifikasi</strong>!
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
