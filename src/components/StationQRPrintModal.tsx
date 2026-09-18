import React from "react";
import { X, Printer, QrCode, ShieldCheck, Download, Copy, Check } from "lucide-react";
import Swal from "sweetalert2";
import { DEFAULT_STATIC_QR_TOKEN } from "./QRScannerModal";

interface StationQRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
}

export default function StationQRPrintModal({
  isOpen,
  onClose,
  token = DEFAULT_STATIC_QR_TOKEN
}: StationQRPrintModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  // URL QR Server image
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(token)}`;

  const handleCopyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:border-none">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                QR Code Stasiun Sekolah
              </h3>
              <p className="text-[11px] text-slate-400">
                Cetak & Tempelkan pada Titik Masuk Guru
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Card Area */}
        <div className="p-6 text-center flex flex-col items-center">
          <div className="border-2 border-dashed border-slate-300 p-6 rounded-2xl bg-slate-50/50 w-full flex flex-col items-center">
            
            {/* Header Sekolah */}
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                Pondok Pesantren Al-Muttaqin
              </span>
              <h4 className="text-base font-extrabold text-slate-900 mt-2">
                STASIUN PRESENSI GURU
              </h4>
              <p className="text-xs text-slate-500">
                Pindai dengan aplikasi guru dalam radius &le; 50 meter
              </p>
            </div>

            {/* Gambar QR Code */}
            <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200">
              <img
                src={qrImageUrl}
                alt="QR Code Stasiun Presensi Al-Muttaqin"
                className="w-48 h-48 object-contain"
                crossOrigin="anonymous"
              />
            </div>

            {/* Token Teks */}
            <div className="mt-4 w-full bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-left">
              <div className="truncate mr-2">
                <p className="text-[10px] uppercase font-bold text-slate-400">Token Statis:</p>
                <p className="text-xs font-mono font-bold text-slate-700 truncate">{token}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyToken}
                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0 print:hidden cursor-pointer"
                title="Salin Token"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Terlindungi GPS Geofencing (Toleransi 50 Meter)</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 pt-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Lembar QR</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
