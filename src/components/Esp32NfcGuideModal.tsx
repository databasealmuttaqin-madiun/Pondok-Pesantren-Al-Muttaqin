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
  const [wifiSsid, setWifiSsid] = useState<string>("KANTOR SMP L2");
  const [wifiPass, setWifiPass] = useState<string>("");
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

  [2] RFID RC522 (SPI Standard Hardware VSPI):
      GPIO5        -> SDA / SS (D10 di Wemos D1 R32)
      GPIO18       -> SCK (D13 di Wemos D1 R32)
      GPIO19       -> MISO (D12 di Wemos D1 R32)
      GPIO23       -> MOSI (D11 di Wemos D1 R32)
      GPIO13       -> RST (D9 di Wemos D1 R32)
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
#define SS_PIN     18  // SDA/SS RC522 (GPIO 18 / Pin D10 Wemos R32)
#define SCK_PIN    19  // SCK RC522 (GPIO 19 / Pin D13 Wemos R32)
#define MOSI_PIN   23  // MOSI RC522 (GPIO 23 / Pin D11 Wemos R32)
#define MISO_PIN   5   // MISO RC522 (GPIO 5 / Pin D12 Wemos R32)
#define RST_PIN    13  // RST RC522 (GPIO 13 / Pin D9 Wemos R32)

#define BUZZER_PIN 12  // Signal Buzzer (GPIO 12)
#define BUTTON_PIN 26  // Tombol Manual (GPIO 26, INPUT_PULLUP)

#define I2C_SDA    21  // SDA LCD I2C (GPIO 21)
#define I2C_SCL    22  // SCL LCD I2C (GPIO 22)

// Inisialisasi MFRC522 & LCD I2C (Alamat I2C umum 0x27 atau 0x3F)
MFRC522 mfrc522(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2); 

// --- KONFIGURASI WIFI & HOSTINGER / API ENDPOINT ---
const char* ssid         = "${wifiSsid}";
const char* password     = "${wifiPass}";

// Endpoint Hostinger API PHP & Supabase REST API Fallback
const char* hostingerApiUrl = "https://almuttaqin.online/api/tap.php";
const char* supabaseUrl  = "https://eflhcunxpckcynozywol.supabase.co";
const char* supabaseKey  = "sb_publishable_fqZTO3lL9cb88K61NXjKHw_zH8O3TuZ";
const char* deviceId     = "ESP32_GATE_01";

unsigned long lastScanTime = 0;
String lastCardUid = "";
bool lastBtnState = HIGH;
unsigned long lastDebounceBtn = 0;

// Helper ekstrak nilai JSON sederhana
String extractJsonVal(String json, String key) {
  int keyIdx = json.indexOf(key);
  if (keyIdx < 0) return "";
  int startVal = json.indexOf(":", keyIdx);
  if (startVal < 0) return "";
  startVal++;
  while (startVal < json.length() && (json[startVal] == ' ' || json[startVal] == '"')) startVal++;
  int endVal = startVal;
  while (endVal < json.length() && json[endVal] != '"' && json[endVal] != ',' && json[endVal] != '}' && json[endVal] != 13 && json[endVal] != 10) endVal++;
  if (endVal > startVal) return json.substring(startVal, endVal);
  return "";
}

bool extractJsonBool(String json, String key) {
  int keyIdx = json.indexOf(key);
  if (keyIdx < 0) return false;
  return json.substring(keyIdx, keyIdx + 20).indexOf("true") >= 0;
}

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

  // Inisialisasi SPI & MFRC522 RFID
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  mfrc522.PCD_Init();
  mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max); // Set kekuatan antena ke maksimal

  Serial.println("");
  Serial.println("===========================================");
  Serial.println(" WEMOS D1 R32 + RC522 + LCD I2C + BUZZER");
  Serial.println(" SIM Pondok Pesantren Al Muttaqin");
  Serial.println("===========================================");
  Serial.print("Cek Hardware RC522: ");
  mfrc522.PCD_DumpVersionToSerial(); // Cek chip RC522 terdeteksi (0x91 / 0x92 = OK)

  // Koneksi ke WiFi
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connect WiFi:");
  lcd.setCursor(0, 1);
  lcd.print(ssid);

  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);
  
  if (strlen(password) > 0) {
    WiFi.begin(ssid, password);
  } else {
    WiFi.begin(ssid); // WiFi tanpa password
  }

  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 30) {
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
    lcd.print(WiFi.localIP().toString());
    delay(1500);
  } else {
    Serial.println("");
    Serial.println("WiFi Disconnected (Mode Offline)");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Disconnect");
    lcd.setCursor(0, 1);
    lcd.print("Standby Mode...");
    delay(1500);
  }

  // Pastikan RFID MFRC522 siap setelah WiFi init
  mfrc522.PCD_Init();
  mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);

  updateLcdStandby();

  // Beep Ganda Tanda Siap
  digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW); delay(100);
  digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
}

void loop() {
  // Reset MFRC522 jika mengalami freeze
  static unsigned long lastRfcCheck = 0;
  if (millis() - lastRfcCheck > 10000) {
    lastRfcCheck = millis();
    mfrc522.PCD_Init();
    mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
  }

  // --- CEK TOMBOL MANUAL (GPIO 26) ---
  int btnVal = digitalRead(BUTTON_PIN);
  if (btnVal == LOW && lastBtnState == HIGH && (millis() - lastDebounceBtn > 300)) {
    lastDebounceBtn = millis();
    Serial.println("\n[TOMBOL TEKAN]: Trigger Manual Ditekan");
    
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
    if (millis() - lastScanTime > 2000) {
      lastCardUid = "";
    }
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Format UID ke String Hex (Contoh: 511913A8)
  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();

  // Halt card & stop crypto
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  // Debounce: Abaikan jika kartu sama ditap ulang dalam 2 detik
  if (cardUid == lastCardUid && (millis() - lastScanTime < 2000)) {
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

  // Beep 1x indikasi kartu terbaca
  digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);

  // Kirim POST Request ke Backend API (Ngrok / Server)
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // Bypass SSL Certificate Check
    HTTPClient http;

    http.begin(client, hostingerApiUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("User-Agent", "ESP32-Gate");

    String jsonBody = "{\"card_uid\":\"" + cardUid + "\",\"device_id\":\"" + String(deviceId) + "\"}";
    
    Serial.println("Sending POST Request to: " + String(hostingerApiUrl));
    Serial.println("Body: " + jsonBody);

    int httpCode = http.POST(jsonBody);
    String responseString = "";
    
    if (httpCode > 0) {
      responseString = http.getString();
      Serial.println("HTTP Code: " + String(httpCode));
      Serial.println("Response: " + responseString);
    } else {
      Serial.println("HTTP POST Error: " + http.errorToString(httpCode));
    }
    http.end();

    // Parse Hasil Respon
    bool success = extractJsonBool(responseString, "success");
    String namaSiswa = extractJsonVal(responseString, "nama");
    String msg = extractJsonVal(responseString, "message");

    lcd.clear();

    if (success && namaSiswa.length() > 0 && namaSiswa != "Tidak Dikenal") {
      // --- KARTU TERDAFTAR & PRESENSI BERHASIL ---
      lcd.setCursor(0, 0);
      if (msg.length() > 0) lcd.print(msg.substring(0, 16));
      else lcd.print("PRESENSI SUKSES");
      
      lcd.setCursor(0, 1);
      lcd.print(namaSiswa.substring(0, 16));

      // Beep 2x Cepat
      digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW); delay(80);
      digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW);

    } else {
      // --- FALLBACK SUPABASE DIRECT JIKA HOSTINGER API FAIL ATAU KARTU BELUM MATCH ---
      if (!success) {
        // Cek 1: Ke Supabase tabel 'santri' (kolom 'nfc_id')
        HTTPClient httpSupa1;
        String supaUrl1 = String(supabaseUrl) + "/rest/v1/santri?nfc_id=eq." + cardUid + "&select=nama,nama_lengkap";
        httpSupa1.begin(client, supaUrl1);
        httpSupa1.addHeader("apikey", supabaseKey);
        httpSupa1.addHeader("Authorization", String("Bearer ") + supabaseKey);
        
        int sCode1 = httpSupa1.GET();
        if (sCode1 == 200) {
          String sResp1 = httpSupa1.getString();
          String sNama1 = extractJsonVal(sResp1, "nama");
          if (sNama1.length() == 0) sNama1 = extractJsonVal(sResp1, "nama_lengkap");
          if (sNama1.length() > 0) {
            namaSiswa = sNama1;
            success = true;
          }
        }
        httpSupa1.end();

        // Cek 2: Ke Supabase tabel 'nfc' (kolom 'serial_number') jika belum ketemu
        if (!success) {
          HTTPClient httpSupa2;
          String supaUrl2 = String(supabaseUrl) + "/rest/v1/nfc?serial_number=eq." + cardUid + "&select=nama";
          httpSupa2.begin(client, supaUrl2);
          httpSupa2.addHeader("apikey", supabaseKey);
          httpSupa2.addHeader("Authorization", String("Bearer ") + supabaseKey);
          
          int sCode2 = httpSupa2.GET();
          if (sCode2 == 200) {
            String sResp2 = httpSupa2.getString();
            String sNama2 = extractJsonVal(sResp2, "nama");
            if (sNama2.length() > 0) {
              namaSiswa = sNama2;
              success = true;
            }
          }
          httpSupa2.end();
        }

        // Cek 3: Ke Supabase tabel 'nfc_cards' (kolom 'card_uid') jika belum ketemu
        if (!success) {
          HTTPClient httpSupa3;
          String supaUrl3 = String(supabaseUrl) + "/rest/v1/nfc_cards?card_uid=eq." + cardUid + "&select=nama";
          httpSupa3.begin(client, supaUrl3);
          httpSupa3.addHeader("apikey", supabaseKey);
          httpSupa3.addHeader("Authorization", String("Bearer ") + supabaseKey);
          
          int sCode3 = httpSupa3.GET();
          if (sCode3 == 200) {
            String sResp3 = httpSupa3.getString();
            String sNama3 = extractJsonVal(sResp3, "nama");
            if (sNama3.length() > 0) {
              namaSiswa = sNama3;
              success = true;
            }
          }
          httpSupa3.end();
        }
      }

      if (success && namaSiswa.length() > 0 && namaSiswa != "Tidak Dikenal") {
        lcd.setCursor(0, 0);
        lcd.print("PRESENSI SUKSES");
        lcd.setCursor(0, 1);
        lcd.print(namaSiswa.substring(0, 16));

        // Beep 2x Cepat
        digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW); delay(80);
        digitalWrite(BUZZER_PIN, HIGH); delay(80); digitalWrite(BUZZER_PIN, LOW);
      } else {
        // Kartu Belum Terdaftar ke Nama Siswa Mana Pun
        lcd.setCursor(0, 0);
        lcd.print("KARTU TDK DIKENAL");
        lcd.setCursor(0, 1);
        lcd.print("UID: " + cardUid.substring(0, 11));

        // Beep 1x Panjang
        digitalWrite(BUZZER_PIN, HIGH); delay(450); digitalWrite(BUZZER_PIN, LOW);
      }
    }

    // --- SANGAT PENTING: Record log tap ke Supabase nfc_taps ---
    // Ini memastikan Menu Registrasi NFC di Web App selalu bisa membaca UID kartu baru!
    HTTPClient httpTap;
    httpTap.begin(client, String(supabaseUrl) + "/rest/v1/nfc_taps");
    httpTap.addHeader("Content-Type", "application/json");
    httpTap.addHeader("apikey", supabaseKey);
    httpTap.addHeader("Authorization", String("Bearer ") + supabaseKey);
    httpTap.addHeader("Prefer", "return=minimal");
    
    String bodyTap = "{\"uid\":\"" + cardUid + "\",\"device_id\":\"" + String(deviceId) + "\",\"nama\":\"" + (namaSiswa.length() > 0 ? namaSiswa : "Tidak Dikenal") + "\"}";
    int tapRes = httpTap.POST(bodyTap);
    Serial.println("[Supabase nfc_taps] Status Code: " + String(tapRes));
    if (tapRes == 400 || tapRes == 404) {
      Serial.println("  -> CATATAN: Jika status 400, jalankan SQL tabel 'nfc_taps' dari tombol di Menu Registrasi NFC Web App.");
    } else if (tapRes == 201 || tapRes == 200 || tapRes == 204) {
      Serial.println("  -> BERHASIL dikirim ke Supabase! Web App kini siap membaca UID ini.");
    }
    httpTap.end();

  } else {
    Serial.println("WiFi Terputus! Mencoba reconnect...");
    WiFi.reconnect();
  }

  // Re-init MFRC522 agar tidak freeze setelah WiFi SSL request
  mfrc522.PCD_Init();
  mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);

  delay(1200);
  updateLcdStandby();
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

#define SS_PIN     5   // SDA/SS RC522 (GPIO 5 / D10 Wemos)
#define SCK_PIN    18  // SCK RC522 (GPIO 18 / D13 Wemos)
#define MOSI_PIN   23  // MOSI RC522 (GPIO 23 / D11 Wemos)
#define MISO_PIN   19  // MISO RC522 (GPIO 19 / D12 Wemos)
#define RST_PIN    13  // RST RC522 (GPIO 13 / D9 Wemos)

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
    if (millis() - lastScanTime > 2000) {
      lastCardUid = "";
    }
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  if (cardUid == lastCardUid && (millis() - lastScanTime < 1500)) {
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
                      <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">GPIO 19</td>
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

              <div className="bg-rose-50 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-200 dark:border-rose-800/60 text-xs space-y-2">
                <h4 className="font-extrabold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Solusi Jika Pembaca RFID Belum Bisa Membaca Kartu:</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-rose-900 dark:text-rose-200 leading-relaxed">
                  <li><strong>Periksa Kabel SPI SCK & SDA:</strong> Pastikan pin <strong>SDA/SS</strong> terhubung ke <strong>GPIO 5 (Pin D10)</strong> dan pin <strong>SCK</strong> terhubung ke <strong>GPIO 18 (Pin D13)</strong>. (Sebelumnya terbalik antara SCK dan SDA).</li>
                  <li><strong>Power 3.3V Cukup:</strong> Pastikan VCC RC522 ke pin <strong>3.3V</strong> (Bukan 5V). Bila daya drop saat WiFi nyala, hubungkan ke USB adaptor daya min 1A-2A.</li>
                  <li><strong>Cek Serial Monitor (115200 baud):</strong> Saat booting, lihat tulisan <em>"Firmware Version: 0x91"</em>. Jika muncul <em>"0x0"</em> atau <em>"0xFF"</em>, artinya perkabelan jumper atau solderan pin RC522 kendor.</li>
                  <li><strong>Jenis Kartu:</strong> Pastikan kartu berfrekuensi <strong>13.56 MHz (Mifare 1k / e-KTP / Tag Biru RFID)</strong>, bukan kartu 125 KHz (EM4100).</li>
                </ol>
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
