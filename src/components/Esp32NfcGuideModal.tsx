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
  PROGRAM WEMOS D1 R32 (ESP32) + RC522 RFID + LCD I2C + BUZZER + TOMBOL
  Aplikasi: SIM Pondok Pesantren Al Muttaqin
  =============================================================
  Library Wajib Dihubungkan di Arduino IDE (Library Manager):
  1. MFRC522 (oleh Miguel Balboa)
  2. LiquidCrystal_I2C (oleh Frank de Brabander / Marco Schwartz)
     * Catatan: Abaikan WARNING "library claims to run on avr architecture", 
       LiquidCrystal_I2C tetap berjalan normal di ESP32 dengan Wire.h.
  3. WiFi & HTTPClient (Bawaan ESP32 Board Manager)

  =============================================================
  SKEMA PIN WEMOS D1 R32 (ESP32):
  
  [1] LCD I2C (PCF8574 / 1602):
      GPIO21 (SDA) -> SDA LCD
      GPIO22 (SCL) -> SCL LCD
      5V / 3V3     -> VCC LCD
      GND          -> GND LCD

  [2] RFID RC522 (SPI):
      GPIO18       -> SDA / SS (Chip Select)
      GPIO19       -> SCK (Clock)
      GPIO23       -> MOSI
      GPIO5        -> MISO
      GPIO13       -> RST (Reset)
      3V3          -> VCC (Wajib 3.3V, Jangan 5V!)
      GND          -> GND
      IRQ          -> (Tidak Dipakai)

  [3] BUZZER AKTIF (2 Pin):
      GPIO12       -> Signal / I-O
      GND          -> GND Modul

  [4] TOMBOL (Aktif LOW, Internal Pull-Up):
      GPIO26       -> Kaki 1 Tombol, Kaki 2 -> GND
  =============================================================
*/

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// --- KONFIGURASI PIN WEMOS D1 R32 ---
#define SS_PIN     18  // SDA/SS RC522
#define SCK_PIN    19  // SCK RC522
#define MOSI_PIN   23  // MOSI RC522
#define MISO_PIN   5   // MISO RC522
#define RST_PIN    13  // RST RC522

#define BUZZER_PIN 12  // Signal Buzzer
#define BUTTON_PIN 26  // Tombol (INPUT_PULLUP, Aktif LOW)

#define I2C_SDA    21  // SDA LCD I2C
#define I2C_SCL    22  // SCL LCD I2C

// Inisialisasi MFRC522 & LCD I2C (Alamat I2C umum 0x27 atau 0x3F)
MFRC522 mfrc522(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2); 

// --- KONFIGURASI WIFI & SERVER API ---
const char* ssid         = "${wifiSsid}";
const char* password     = "${wifiPass}";

// Endpoint API Express / Cloud Run
const char* serverApiUrl = "https://ais-dev-7iq2pu7x3nfewkb6nyaboc-253474951008.asia-east1.run.app/api/nfc/tap";
const char* deviceId     = "WEMOS_GATE_01";

unsigned long lastScanTime = 0;
String lastCardUid = "";
bool lastBtnState = HIGH;
unsigned long lastDebounceBtn = 0;

void updateLcdStandby() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("AL MUTTAQIN GATE");
  lcd.setCursor(0, 1);
  lcd.print("Tempelkan Kartu");
}

void setup() {
  Serial.begin(115200);

  // Set Mode Pin
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  pinMode(BUTTON_PIN, INPUT_PULLUP); // Tombol aktif LOW

  // Inisialisasi I2C untuk LCD (GPIO 21 & GPIO 22)
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SIM AL MUTTAQIN");
  lcd.setCursor(0, 1);
  lcd.print("Memuat System...");

  // Inisialisasi SPI Khusus Wemos D1 R32
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  mfrc522.PCD_Init();

  Serial.println("");
  Serial.println("===========================================");
  Serial.println(" WEMOS D1 R32 + RC522 + LCD I2C + BUZZER");
  Serial.println(" SIM Pondok Pesantren Al Muttaqin");
  Serial.println("===========================================");

  // Koneksi ke WiFi
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connect WiFi:");
  lcd.setCursor(0, 1);
  lcd.print(ssid);

  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 15) {
    delay(500);
    Serial.print(".");
    attempt++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi Terhubung!");
    Serial.print("IP ESP32: ");
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(1500);
  } else {
    Serial.println("");
    Serial.println("WiFi Disconnected (Mode Lokal/Serial)");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Disconnected");
    lcd.setCursor(0, 1);
    lcd.print("Standby Mode...");
    delay(1500);
  }

  updateLcdStandby();

  // Beep Ganda Tanda Siap
  digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW); delay(100);
  digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
}

void loop() {
  // --- CEK TOMBOL MANUAL (GPIO 26) ---
  int btnVal = digitalRead(BUTTON_PIN);
  if (btnVal == LOW && lastBtnState == HIGH && (millis() - lastDebounceBtn > 300)) {
    lastDebounceBtn = millis();
    Serial.println("");
    Serial.println("[TOMBOL TEKAN]: Trigger Manual Ditekan");
    
    digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW);
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Tombol Ditekan!");
    lcd.setCursor(0, 1);
    lcd.print("Status: Manual");
    delay(1000);
    updateLcdStandby();
  }
  lastBtnState = btnVal;

  // --- CEK TAP KARTU RFID RC522 ---
  if (!mfrc522.PICC_IsNewCardPresent()) {
    // Reset cache kartu terakhir jika tidak ada kartu selama > 2.5 detik
    if (millis() - lastScanTime > 2500) {
      lastCardUid = "";
    }
    return;
  }

  // Bersihkan buffer memori UID sebelum membaca
  memset(mfrc522.uid.uidByte, 0, sizeof(mfrc522.uid.uidByte));
  mfrc522.uid.size = 0;

  if (!mfrc522.PICC_ReadCardSerial() || mfrc522.uid.size == 0) {
    mfrc522.PICC_HaltA();
    return;
  }

  // Format UID ke String Hex (Contoh: 12A3B4C5)
  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();

  // Debounce: Jika KARTU SAMA ditap berturut-turut dalam 2 detik, abaikan
  if (cardUid == lastCardUid && (millis() - lastScanTime < 2000)) {
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }

  lastCardUid = cardUid;
  lastScanTime = millis();

  Serial.println("");
  Serial.print("[KARTU DITAP]: ");
  Serial.println(cardUid);

  // Tampilkan di LCD I2C
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("KARTU DITAP:");
  lcd.setCursor(0, 1);
  lcd.print("UID: " + cardUid);

  // Beep 1x
  digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW);

  // Kirim data ke API backend (/api/nfc/tap)
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure(); // SSL Insecure bypass jika menggunakan HTTPS

    http.begin(client, serverApiUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonBody = "{\\\"card_uid\\\":\\\"" + cardUid + "\\\",\\\"device_id\\\":\\\"" + String(deviceId) + "\\\"}";
    int httpResponseCode = http.POST(jsonBody);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("[HTTP CODE]: " + String(httpResponseCode));
      Serial.println("[RESPONSE]: " + response);

      lcd.clear();
      if (response.indexOf("\\\"success\\\":true") >= 0) {
        // Ekstrak Nama Siswa dari Response JSON
        int namaIdx = response.indexOf("\\\"nama\\\":\\\"");
        String namaSiswa = "Siswa Ditemukan";
        if (namaIdx >= 0) {
          int startName = namaIdx + 8;
          int endName = response.indexOf("\\\"", startName);
          if (endName > startName) {
            namaSiswa = response.substring(startName, endName);
          }
        }

        lcd.setCursor(0, 0);
        lcd.print("Presensi Berhasil!");
        lcd.setCursor(0, 1);
        lcd.print(namaSiswa.substring(0, 16));

        // Beep Berhasil (2x Beep Pendek)
        digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW); delay(80);
        digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW);
      } else {
        lcd.setCursor(0, 0);
        lcd.print("Kartu Tak Dikenal");
        lcd.setCursor(0, 1);
        lcd.print("Register Dulu!");

        // Beep Gagal (1x Beep Panjang)
        digitalWrite(BUZZER_PIN, HIGH); delay(400); digitalWrite(BUZZER_PIN, LOW);
      }
    } else {
      Serial.println("Error HTTP POST: " + String(httpResponseCode));
      lcd.setCursor(0, 0);
      lcd.print("HTTP Error!");
      lcd.setCursor(0, 1);
      lcd.print("Code: " + String(httpResponseCode));
    }
    http.end();
  } else {
    Serial.println("WiFi Terputus! Mencoba reconnect...");
    WiFi.reconnect();
  }

  delay(1200);
  updateLcdStandby();

  // Reset RC522 State & Re-Init agar siap membaca tap berikutnya
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(100);
  mfrc522.PCD_Init(); // Re-Init hardware RC522
}
`;

  const arduinoSerialCode = `/*
  =============================================================
  PROGRAM WEMOS D1 R32 (ESP32) VIA KABEL USB SERIAL + LCD I2C
  Aplikasi: SIM Pondok Pesantren Al Muttaqin
  =============================================================
*/

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#define SS_PIN     18  // SDA/SS RC522
#define SCK_PIN    19  // SCK RC522
#define MOSI_PIN   23  // MOSI RC522
#define MISO_PIN   5   // MISO RC522
#define RST_PIN    13  // RST RC522

#define BUZZER_PIN 12  // Signal Buzzer
#define BUTTON_PIN 26  // Tombol Manual (INPUT_PULLUP)

#define I2C_SDA    21  // SDA LCD I2C
#define I2C_SCL    22  // SCL LCD I2C

MFRC522 mfrc522(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);

unsigned long lastScanTime = 0;
String lastCardUid = "";
bool lastBtnState = HIGH;

void updateLcdStandby() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SERIAL NFC GATE");
  lcd.setCursor(0, 1);
  lcd.print("Ready to Scan...");
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();

  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  mfrc522.PCD_Init();

  updateLcdStandby();
  Serial.println("ESP32_RC522_READY");
}

void loop() {
  // Cek tombol manual
  int btnVal = digitalRead(BUTTON_PIN);
  if (btnVal == LOW && lastBtnState == HIGH) {
    digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW);
    Serial.println("CARD_UID:BUTTON_TRIGGER");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("BUTTON PRESSED");
    delay(800);
    updateLcdStandby();
  }
  lastBtnState = btnVal;

  if (!mfrc522.PICC_IsNewCardPresent()) {
    if (millis() - lastScanTime > 2500) {
      lastCardUid = "";
    }
    return;
  }

  memset(mfrc522.uid.uidByte, 0, sizeof(mfrc522.uid.uidByte));
  mfrc522.uid.size = 0;

  if (!mfrc522.PICC_ReadCardSerial() || mfrc522.uid.size == 0) {
    mfrc522.PICC_HaltA();
    return;
  }

  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();

  if (cardUid == lastCardUid && (millis() - lastScanTime < 1500)) {
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }

  lastCardUid = cardUid;
  lastScanTime = millis();

  // Format "CARD_UID:12A3B4C5" dibaca otomatis oleh Web Serial API
  Serial.print("CARD_UID:");
  Serial.println(cardUid);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SERIAL SCANNED:");
  lcd.setCursor(0, 1);
  lcd.print(cardUid);

  digitalWrite(BUZZER_PIN, HIGH); delay(120); digitalWrite(BUZZER_PIN, LOW);

  delay(1000);
  updateLcdStandby();

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(50);
  mfrc522.PCD_Init();
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
                      <th className="p-3">Komponen</th>
                      <th className="p-3">Pin Modul</th>
                      <th className="p-3">Pin Wemos D1 R32 (ESP32)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                    {/* RFID RC522 */}
                    <tr className="bg-slate-50/50 dark:bg-slate-850/50">
                      <td className="p-3 font-extrabold text-indigo-600 dark:text-indigo-400" rowSpan={7}>RFID RC522 (SPI)</td>
                      <td className="p-3 font-mono">SDA / SS</td>
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">GPIO 18</td>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-slate-850/50">
                      <td className="p-3 font-mono">SCK</td>
                      <td className="p-3 font-mono font-bold">GPIO 19</td>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-slate-850/50">
                      <td className="p-3 font-mono">MOSI</td>
                      <td className="p-3 font-mono font-bold">GPIO 23</td>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-slate-850/50">
                      <td className="p-3 font-mono">MISO</td>
                      <td className="p-3 font-mono font-bold">GPIO 5</td>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-slate-850/50">
                      <td className="p-3 font-mono">RST</td>
                      <td className="p-3 font-mono font-bold">GPIO 13</td>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-slate-850/50">
                      <td className="p-3 font-mono">3V3 (VCC)</td>
                      <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">3.3V (Wajib 3.3V!)</td>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-slate-850/50">
                      <td className="p-3 font-mono">GND</td>
                      <td className="p-3 font-mono font-bold text-slate-500">GND</td>
                    </tr>

                    {/* LCD I2C */}
                    <tr>
                      <td className="p-3 font-extrabold text-amber-600 dark:text-amber-400" rowSpan={3}>LCD I2C (1602)</td>
                      <td className="p-3 font-mono">SDA</td>
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">GPIO 21</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono">SCL</td>
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">GPIO 22</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono">VCC & GND</td>
                      <td className="p-3 font-mono font-bold">5V / 3V3 & GND</td>
                    </tr>

                    {/* BUZZER */}
                    <tr className="bg-slate-50/50 dark:bg-slate-850/50">
                      <td className="p-3 font-extrabold text-rose-600 dark:text-rose-400">Buzzer Aktif</td>
                      <td className="p-3 font-mono">Signal (I-O) & GND</td>
                      <td className="p-3 font-mono font-bold">GPIO 12 (+) & GND (-)</td>
                    </tr>

                    {/* TOMBOL */}
                    <tr>
                      <td className="p-3 font-extrabold text-emerald-600 dark:text-emerald-400">Tombol / Push Button</td>
                      <td className="p-3 font-mono">2 Pin (Aktif LOW)</td>
                      <td className="p-3 font-mono font-bold">GPIO 26 & GND</td>
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
