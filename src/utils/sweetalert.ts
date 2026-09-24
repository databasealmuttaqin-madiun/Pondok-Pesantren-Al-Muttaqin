import Swal, { SweetAlertOptions, SweetAlertIcon } from "sweetalert2";

// Helper to check if dark mode is active
const isDarkMode = () => {
  return document.documentElement.classList.contains("dark") || document.body.classList.contains("dark");
};

// Base config that dynamically respects light/dark theme and matches app aesthetics
const getBaseConfig = (): SweetAlertOptions => {
  const dark = isDarkMode();
  return {
    background: dark ? "#111322" : "#ffffff",
    color: dark ? "#f8fafc" : "#0f172a",
    customClass: {
      popup: "rounded-2xl shadow-2xl border " + (dark ? "border-slate-800 text-slate-100" : "border-slate-100 text-slate-900"),
      title: "font-display font-bold text-lg " + (dark ? "text-slate-100" : "text-slate-900"),
      htmlContainer: "text-sm " + (dark ? "text-slate-300" : "text-slate-600"),
      confirmButton: "px-5 py-2.5 rounded-xl font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2",
      cancelButton: "px-5 py-2.5 rounded-xl font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2",
      actions: "gap-2.5",
    },
    buttonsStyling: true,
  };
};

/**
 * Show a general alert (Success, Error, Info, Warning)
 */
export const showAlert = (
  titleOrOptions: string | SweetAlertOptions,
  text?: string,
  icon: SweetAlertIcon = "info"
) => {
  const base = getBaseConfig();
  if (typeof titleOrOptions === "string") {
    return Swal.fire({
      ...base,
      title: titleOrOptions,
      text: text,
      icon: icon,
      confirmButtonColor: "#0284c7",
      confirmButtonText: "OK",
    } as any);
  }
  return Swal.fire({
    ...base,
    confirmButtonColor: "#0284c7",
    confirmButtonText: "OK",
    ...titleOrOptions,
  } as any);
};

/**
 * Show a Success alert popup
 */
export const showSuccess = (title: string, text?: string, options?: SweetAlertOptions) => {
  return Swal.fire({
    ...getBaseConfig(),
    icon: "success",
    title,
    text,
    confirmButtonColor: "#059669",
    confirmButtonText: "OK",
    ...options,
  } as any);
};

/**
 * Show an Error alert popup
 */
export const showError = (title: string, text?: string, options?: SweetAlertOptions) => {
  return Swal.fire({
    ...getBaseConfig(),
    icon: "error",
    title,
    text,
    confirmButtonColor: "#dc2626",
    confirmButtonText: "Tutup",
    ...options,
  } as any);
};

/**
 * Show a Warning alert popup
 */
export const showWarning = (title: string, text?: string, options?: SweetAlertOptions) => {
  return Swal.fire({
    ...getBaseConfig(),
    icon: "warning",
    title,
    text,
    confirmButtonColor: "#d97706",
    confirmButtonText: "Mengerti",
    ...options,
  } as any);
};

/**
 * Show an Info alert popup
 */
export const showInfo = (title: string, text?: string, options?: SweetAlertOptions) => {
  return Swal.fire({
    ...getBaseConfig(),
    icon: "info",
    title,
    text,
    confirmButtonColor: "#0284c7",
    confirmButtonText: "OK",
    ...options,
  } as any);
};

/**
 * Show a Confirmation popup. Returns a Promise resolving to true if confirmed, false otherwise.
 */
export const showConfirm = async (
  titleOrConfig:
    | string
    | {
        title: string;
        text?: string;
        html?: string;
        icon?: SweetAlertIcon;
        confirmButtonText?: string;
        cancelButtonText?: string;
        confirmButtonColor?: string;
        cancelButtonColor?: string;
        isDanger?: boolean;
      },
  text?: string,
  isDanger = false
): Promise<boolean> => {
  const base = getBaseConfig();
  let title = "";
  let bodyText = text;
  let html = "";
  let icon: SweetAlertIcon = isDanger ? "warning" : "question";
  let confirmText = "Ya, Lanjutkan";
  let cancelText = "Batal";
  let dangerMode = isDanger;
  let customConfirmColor: string | undefined = undefined;
  let customCancelColor: string | undefined = undefined;

  if (typeof titleOrConfig === "object") {
    title = titleOrConfig.title;
    bodyText = titleOrConfig.text;
    html = titleOrConfig.html || "";
    icon = titleOrConfig.icon || (titleOrConfig.isDanger ? "warning" : "question");
    confirmText = titleOrConfig.confirmButtonText || "Ya, Lanjutkan";
    cancelText = titleOrConfig.cancelButtonText || "Batal";
    dangerMode = titleOrConfig.isDanger ?? false;
    customConfirmColor = titleOrConfig.confirmButtonColor;
    customCancelColor = titleOrConfig.cancelButtonColor;
  } else {
    title = titleOrConfig;
  }

  const result = await Swal.fire({
    ...base,
    title,
    text: bodyText,
    html: html || undefined,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: customConfirmColor || (dangerMode ? "#dc2626" : "#0284c7"),
    cancelButtonColor: customCancelColor || (isDarkMode() ? "#334155" : "#94a3b8"),
    reverseButtons: true,
  });

  return result.isConfirmed;
};

/**
 * Show a Delete Confirmation popup specifically tuned for deleting records.
 */
export const showDeleteConfirm = async (
  itemName: string,
  customWarning?: string
): Promise<boolean> => {
  return showConfirm({
    title: `Hapus ${itemName}?`,
    text: customWarning || "Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus data ini?",
    icon: "warning",
    confirmButtonText: "Ya, Hapus",
    cancelButtonText: "Batal",
    isDanger: true,
  });
};

/**
 * Show a Toast notification in top right corner
 */
export const showToast = (
  title: string,
  icon: SweetAlertIcon = "success",
  duration = 2500
) => {
  const dark = isDarkMode();
  const Toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: duration,
    timerProgressBar: true,
    background: dark ? "#111322" : "#ffffff",
    color: dark ? "#f8fafc" : "#0f172a",
    customClass: {
      popup: "rounded-xl shadow-lg border " + (dark ? "border-slate-800" : "border-slate-100"),
      title: "text-sm font-medium",
    },
    didOpen: (toast) => {
      toast.addEventListener("mouseenter", Swal.stopTimer);
      toast.addEventListener("mouseleave", Swal.resumeTimer);
    },
  });

  return Toast.fire({
    icon,
    title,
  });
};

/**
 * Show an Input Prompt popup
 */
export const showPrompt = async (
  titleOrConfig:
    | string
    | {
        title: string;
        text?: string;
        inputPlaceholder?: string;
        inputValue?: string;
        inputType?: "text" | "password" | "number" | "textarea";
        inputValidator?: (value: string) => string | null | Promise<string | null>;
      },
  placeholder = ""
): Promise<string | null> => {
  const base = getBaseConfig();
  let title = "";
  let text = "";
  let inputPlaceholder = placeholder;
  let inputValue = "";
  let inputType: "text" | "password" | "number" | "textarea" = "text";
  let inputValidator: ((value: string) => string | null | Promise<string | null>) | undefined;

  if (typeof titleOrConfig === "object") {
    title = titleOrConfig.title;
    text = titleOrConfig.text || "";
    inputPlaceholder = titleOrConfig.inputPlaceholder || "";
    inputValue = titleOrConfig.inputValue || "";
    inputType = titleOrConfig.inputType || "text";
    inputValidator = titleOrConfig.inputValidator;
  } else {
    title = titleOrConfig;
  }

  const result = await Swal.fire({
    ...base,
    title,
    text,
    input: inputType,
    inputValue,
    inputPlaceholder,
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
    confirmButtonColor: "#0284c7",
    cancelButtonColor: isDarkMode() ? "#334155" : "#94a3b8",
    reverseButtons: true,
    inputValidator,
  });

  if (result.isConfirmed && result.value !== undefined) {
    return result.value as string;
  }
  return null;
};

export default Swal;
