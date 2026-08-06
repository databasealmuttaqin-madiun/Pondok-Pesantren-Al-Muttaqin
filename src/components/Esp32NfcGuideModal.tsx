import React, { useState } from "react";
import { Cpu, Wifi, Usb, CheckCircle2, Copy, X, Terminal, Zap, ShieldAlert, Radio } from "lucide-react";

interface Esp32NfcGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateTap?: (testUid: string) => void;
}

export default function Esp32NfcGuideModal({
  isOpen,
  onClose,
  onSimulateTap
}: Esp32NfcGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"pinout" | "wifi_code" | "serial_code" | "test">("pinout");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [wifiSsid, setWifiSsid] = useState<string>("WIFI_PONDOK");
  const [wifiPass, setWifiPass] = useState<string>("pass12345");
  const [testUid, setTestUid] = useState<string>("12A3B4C5");
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentHost = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const arduinoWifiCode = `/*
  =============================================================
  PROGRAM ESP32 + MFRC522 (NFC/RFID READER) VIA WIFI HTTP POST
  Aplikasi: SIM Pondok Pesantren Al Muttaqin
  =============================================================
  Perpustakaan Wajib Dihubungkan di Arduino IDE:
  1. MFRC522 oleh github.com/miguelbalboa/rfid
  2. WiFi & HTTPClient (Bawaan ESP32 Board Manager)
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// --- KONFIGURASI PIN ESP32 & RC522 ---
#define SS_PIN    5   // Pin SDA
#define RST_PIN   22  // Pin RST
#define BUZZER_PIN 4  // (Opsional) Buzzer ke GPIO 4

MFRC522 mfrc522(SS_PIN, RST_PIN);

// --- KONFIGURASI WIFI & SERVER VERCEL ---
const char* ssid     = "${wifiSsid}";
const char* password = "${wifiPass}";

// --- KONFIGURASI SUPABASE REST API ---
const char* supabaseUrl = "https://eflhcunxpckcynozywol.supabase.co/rest/v1/nfc_taps";
const char* supabaseKey = "sb_publishable_fqZTO3lL9cb88K61NXjKHw_zH8O3TuZ";
const char* deviceId    = "ESP32_GATE_01";

unsigned long lastScanTime = 0;
String lastCardUid = "";

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  SPI.begin();
  mfrc522.PCD_Init();

  Serial.println("\n===========================================");
  Serial.println("  ESP32 + RC522 NFC READER UNTUK AL MUTTAQIN");
  Serial.println("===========================================");

  // Koneksi WiFi
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Terhubung!");
  Serial.print("IP ESP32: ");
  Serial.println(WiFi.localIP());
  Serial.println("Siap Membaca Kartu Santri/Warga...");

  // Beep ganda tanda alat siap
  digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW); delay(100);
  digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
}

void loop() {
  // Cek apakah ada kartu ditempelkan
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  // Format UID ke String Hex (Contoh: 12A3B4C5)
  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();

  // Debounce kartu yang sama dalam 2 detik
  if (cardUid == lastCardUid && (millis() - lastScanTime < 2000)) {
    mfrc522.PICC_HaltA();
    return;
  }

  lastCardUid = cardUid;
  lastScanTime = millis();

  Serial.println("\n[KARTU DITAP]: " + cardUid);

  // Beep 1x
  digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW);

  // Kirim data langsung ke Supabase REST API (Bebas Error 404 Vercel!)
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure(); // Mendukung HTTPS tanpa perlu SSL Certificate

    http.begin(client, supabaseUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", supabaseKey);
    http.addHeader("Authorization", String("Bearer ") + supabaseKey);
    http.addHeader("Prefer", "return=minimal");

    String jsonBody = "{\"uid\":\"" + cardUid + "\",\"device_id\":\"" + String(deviceId) + "\"}";
    int httpResponseCode = http.POST(jsonBody);

    if (httpResponseCode > 0) {
      Serial.println("[HTTP CODE]: " + String(httpResponseCode) + " (Berhasil Tersambung!)");
    } else {
      Serial.println("Error HTTP POST: " + String(httpResponseCode));
    }
    http.end();
  } else {
    Serial.println("WiFi Terputus! Mencoba menghubungkan kembali...");
    WiFi.reconnect();
  }

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
`;

  const arduinoSerialCode = `/*
  =============================================================
  PROGRAM ESP32 + MFRC522 VIA KABEL USB SERIAL (115200 BAUD)
  Aplikasi: SIM Pondok Pesantren Al Muttaqin
  =============================================================
*/

#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN    5
#define RST_PIN   22
#define BUZZER_PIN 4

MFRC522 mfrc522(SS_PIN, RST_PIN);

unsigned long lastScanTime = 0;
String lastCardUid = "";

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  SPI.begin();
  mfrc522.PCD_Init();

  Serial.println("ESP32_RC522_READY");
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();

  if (cardUid == lastCardUid && (millis() - lastScanTime < 1500)) {
    mfrc522.PICC_HaltA();
    return;
  }

  lastCardUid = cardUid;
  lastScanTime = millis();

  // Cetak format "UID:12A3B4C5" yang dibaca oleh Web Serial API
  Serial.print("CARD_UID:");
  Serial.println(cardUid);

  digitalWrite(BUZZER_PIN, HIGH); delay(120); digitalWrite(BUZZER_PIN, LOW);

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
`;

  const handleCopy = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(type);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleTestTap = async () => {
    if (!testUid.trim()) return;
    const clean = testUid.trim().toUpperCase();
    if (onSimulateTap) {
      onSimulateTap(clean);
    }
    try {
      const res = await fetch("/api/nfc/tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_uid: clean, device_id: "SIMULATOR_TEST" })
      });
      const data = await res.json();
      if (data.success) {
        setTestFeedback(`✅ Berhasil mengirim Sinyal NFC: UID ${clean}! Sistem merekam kartu secara otomatis.`);
      } else {
        setTestFeedback(`⚠️ Gagal: ${data.message}`);
      }
    } catch (err: any) {
      setTestFeedback(`❌ Error koneksi server: ${err.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900 shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                Integrasi Hardware ESP32 + RC522 NFC
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Panduan perkabelan & program Arduino untuk membaca Kartu NFC Santri/Warga
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab("pinout")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "pinout"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-850 shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Skema Pinout</span>
          </button>

          <button
            onClick={() => setActiveTab("wifi_code")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "wifi_code"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-850 shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span>Program WiFi (HTTP)</span>
          </button>

          <button
            onClick={() => setActiveTab("serial_code")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "serial_code"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-850 shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Usb className="w-4 h-4" />
            <span>Program USB Serial</span>
          </button>

          <button
            onClick={() => setActiveTab("test")}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "test"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-850 shadow-xs"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Tes Sinyal</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {/* TAB 1: PINOUT WIRING */}
          {activeTab === "pinout" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                  <strong>Penting:</strong> Modul RFID RC522 beroperasi pada tegangan <strong>3.3 Volt (3V3)</strong>. Hubungkan pin VCC RC522 ke pin <strong>3.3V</strong> pada ESP32, <em>jangan ke 5V</em> agar chip RC522 tidak terbakar!
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Pin RC522</th>
                      <th className="p-3">Fungsi SPI</th>
                      <th className="p-3">Hubungkan ke ESP32 Pin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">VCC</td>
                      <td className="p-3">Power Supply (3.3V)</td>
                      <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">ESP32 3V3</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">RST</td>
                      <td className="p-3">Reset Pin</td>
                      <td className="p-3 font-mono font-bold">GPIO 22</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">GND</td>
                      <td className="p-3">Ground</td>
                      <td className="p-3 font-mono font-bold text-slate-500">ESP32 GND</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">IRQ</td>
                      <td className="p-3">Interrupt</td>
                      <td className="p-3 italic text-slate-400">Tidak Perlu Dihubungkan (NC)</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">MISO</td>
                      <td className="p-3">SPI MISO</td>
                      <td className="p-3 font-mono font-bold">GPIO 19</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">MOSI</td>
                      <td className="p-3">SPI MOSI</td>
                      <td className="p-3 font-mono font-bold">GPIO 23</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">SCK</td>
                      <td className="p-3">SPI Clock</td>
                      <td className="p-3 font-mono font-bold">GPIO 18</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">SDA (SS)</td>
                      <td className="p-3">SPI Slave Select</td>
                      <td className="p-3 font-mono font-bold">GPIO 5</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-850 bg-indigo-50/20 dark:bg-indigo-950/10">
                      <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">Buzzer (Opsional)</td>
                      <td className="p-3">Indikator Suara Beep</td>
                      <td className="p-3 font-mono font-bold">GPIO 4 (+) & GND (-)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <h4 className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
                  💡 Cara Kerja Sistem:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <li><strong>Mode WiFi (Rekomendasi):</strong> ESP32 terhubung ke WiFi pondok dan mengirimkan ID kartu secara otomatis ke URL server web via HTTP POST (`/api/nfc/tap`).</li>
                  <li><strong>Mode USB Serial:</strong> ESP32 dihubungkan menggunakan kabel data USB ke Laptop/PC admin. Aplikasi membaca sinyal serial langsung via Web Serial API.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: ARDUINO WIFI CODE */}
          {activeTab === "wifi_code" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-500" />
                  <span>Pengaturan Koneksi WiFi ESP32</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-400 mb-1 block">Nama WiFi (SSID):</label>
                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-400 mb-1 block">Password WiFi:</label>
                    <input
                      type="text"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-indigo-500" />
                  <span>Script Arduino C++ (ESP32 WiFi)</span>
                </span>
                <button
                  onClick={() => handleCopy(arduinoWifiCode, "wifi")}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  {copiedCode === "wifi" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Berhasil Disalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Script WiFi</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 max-h-[350px] overflow-y-auto custom-scrollbar">
                <pre>{arduinoWifiCode}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: ARDUINO SERIAL CODE */}
          {activeTab === "serial_code" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-wider">
                    Script ESP32 USB Serial Mode
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Gunakan script ini jika ESP32 langsung dicolok via kabel USB ke Komputer/Laptop.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(arduinoSerialCode, "serial")}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  {copiedCode === "serial" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Berhasil Disalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Script Serial</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 max-h-[350px] overflow-y-auto custom-scrollbar">
                <pre>{arduinoSerialCode}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: TEST SIMULATION */}
          {activeTab === "test" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-2xl space-y-3">
                <h4 className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-300 tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-600" />
                  <span>Uji Sinyal Pembacaan NFC ESP32</span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Masukkan UID Kartu buatan di bawah ini untuk mensimulasikan tap kartu dari ESP32 tanpa perlu memprogram hardware terlebih dahulu.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testUid}
                    onChange={(e) => setTestUid(e.target.value.toUpperCase())}
                    placeholder="Contoh: 12A3B4C5"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-slate-800 dark:text-slate-100 uppercase"
                  />
                  <button
                    onClick={handleTestTap}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Kirim Sinyal Tap
                  </button>
                </div>

                {testFeedback && (
                  <p className="text-xs font-semibold p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
                    {testFeedback}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
