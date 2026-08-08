import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, Check } from "lucide-react";

interface Props {
  children?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleCopyError = () => {
    const errorDetails = `Error: ${this.state.error?.toString()}\n\nStack:\n${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(err => console.error("Failed to copy error details:", err));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-left shadow-lg max-w-4xl mx-auto">
          <div className="flex items-start gap-3.5 mb-4">
            <div className="p-2.5 bg-red-100 dark:bg-red-900/60 rounded-xl text-red-600 dark:text-red-300 shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-red-800 dark:text-red-200">
                Terjadi Kesalahan pada Komponen Tampilan
              </h2>
              <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
                Aplikasi mengalami kendala saat memproses data. Anda dapat mencoba memuat ulang atau kembali ke dashboard utama.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/80 rounded-xl font-mono text-xs text-red-700 dark:text-red-300 overflow-x-auto mb-4 whitespace-pre-wrap max-h-48 overflow-y-auto shadow-inner">
            <p className="font-bold mb-1 text-red-800 dark:text-red-200">Pesan Error:</p>
            {this.state.error ? this.state.error.toString() : "Kesalahan tidak diketahui"}
            {this.state.errorInfo && (
              <details className="mt-2 pt-2 border-t border-red-100 dark:border-red-900/50 text-[11px] text-slate-500 dark:text-slate-400">
                <summary className="cursor-pointer hover:underline text-red-600 dark:text-red-400 font-semibold mb-1">
                  Tampilkan Jejak Panggilan (Stack Trace)
                </summary>
                {this.state.errorInfo.componentStack}
              </details>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Muat Ulang Halaman
            </button>
            
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Home className="w-3.5 h-3.5" />
              Coba Buka Kembali Tab Ini
            </button>

            <button
              onClick={this.handleCopyError}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
            >
              {this.state.copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-bold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Salin Detail Error</span>
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

