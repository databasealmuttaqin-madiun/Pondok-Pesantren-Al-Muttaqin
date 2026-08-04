import { useState, useEffect, useRef } from "react";

interface Esp32NfcEvent {
  uid: string;
  device_id: string;
  timestamp: number;
}

interface UseEsp32NfcOptions {
  onCardTapped: (uid: string, source: "esp32_wifi" | "esp32_serial") => void;
  enabled?: boolean;
}

export function useEsp32NfcListener({ onCardTapped, enabled = true }: UseEsp32NfcOptions) {
  const [wifiStatus, setWifiStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("connecting");
  const [lastTap, setLastTap] = useState<Esp32NfcEvent | null>(null);
  const [isSerialConnected, setIsSerialConnected] = useState<boolean>(false);
  const [serialError, setSerialError] = useState<string | null>(null);

  const lastProcessedTimeRef = useRef<number>(0);
  const lastProcessedTimestampRef = useRef<number>(0);
  const lastProcessedUidRef = useRef<string>("");
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);

  // 1. Listen for Real-Time WiFi HTTP taps via SSE (/api/nfc/stream)
  useEffect(() => {
    if (!enabled) {
      setWifiStatus("disconnected");
      return;
    }

    setWifiStatus("connecting");
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    try {
      // Always start polling /api/nfc/latest every 1000ms for solid Vercel compatibility
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/nfc/latest");
          if (res.ok) {
            const json = await res.json();
            if (json && json.latestTap && json.latestTap.uid) {
              const tap: Esp32NfcEvent = json.latestTap;
              handleIncomingTap(tap.uid, "esp32_wifi", tap.timestamp);
              setLastTap(tap);
              setWifiStatus("connected");
            }
          }
        } catch (pollErr) {
          // silent catch
        }
      }, 1000);

      // Try SSE connection first
      eventSource = new EventSource("/api/nfc/stream");

      eventSource.onopen = () => {
        setWifiStatus("connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const data: Esp32NfcEvent = JSON.parse(event.data);
          if (data && data.uid) {
            handleIncomingTap(data.uid, "esp32_wifi", data.timestamp);
            setLastTap(data);
            setWifiStatus("connected");
          }
        } catch (err) {
          console.warn("Error parsing SSE NFC data:", err);
        }
      };

      eventSource.onerror = () => {
        // SSE error is expected on Vercel serverless environment, falling back smoothly to polling
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    } catch (err) {
      console.warn("SSE EventSource initialization error:", err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [enabled]);

  // Debounce duplicate taps
  const handleIncomingTap = (rawUid: string, source: "esp32_wifi" | "esp32_serial", timestamp?: number) => {
    const cleanUid = String(rawUid).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!cleanUid) return;

    const tapTimestamp = timestamp || Date.now();

    // Skip if this exact tap timestamp has already been processed or if duplicate within 1.2s
    if (
      tapTimestamp === lastProcessedTimestampRef.current ||
      (cleanUid === lastProcessedUidRef.current && Math.abs(Date.now() - lastProcessedTimeRef.current) < 1200)
    ) {
      return;
    }

    lastProcessedUidRef.current = cleanUid;
    lastProcessedTimeRef.current = Date.now();
    lastProcessedTimestampRef.current = tapTimestamp;

    onCardTapped(cleanUid, source);
  };

  // 2. Web Serial Connection (Direct USB Cable to PC/Laptop)
  const isWebSerialSupported = typeof navigator !== "undefined" && "serial" in navigator;

  const connectWebSerial = async () => {
    if (!isWebSerialSupported) {
      setSerialError("Browser Anda belum mendukung Web Serial API. Gunakan Chrome, Edge, atau Opera di Laptop/Desktop.");
      return;
    }

    try {
      setSerialError(null);
      const navSerial = (navigator as any).serial;
      const port = await navSerial.requestPort();
      await port.open({ baudRate: 115200 });

      serialPortRef.current = port;
      setIsSerialConnected(true);

      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReaderRef.current = reader;

      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          // Keep incomplete last line in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Extract UID from logs like "UID: 12 A3 B4 C5" or "CARD_UID: 12345678" or "12A3B4C5"
            let extractedUid = trimmed;
            if (trimmed.toUpperCase().includes("UID:")) {
              extractedUid = trimmed.substring(trimmed.toUpperCase().indexOf("UID:") + 4);
            } else if (trimmed.toUpperCase().includes("CARD:")) {
              extractedUid = trimmed.substring(trimmed.toUpperCase().indexOf("CARD:") + 5);
            }

            extractedUid = extractedUid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

            if (extractedUid.length >= 4) {
              handleIncomingTap(extractedUid, "esp32_serial");
              setLastTap({
                uid: extractedUid,
                device_id: "ESP32_USB_SERIAL",
                timestamp: Date.now()
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("Web Serial Connection Error:", err);
      setIsSerialConnected(false);
      if (err.name !== "NotFoundError") {
        setSerialError(`Gagal menghubungkan ke Serial ESP32: ${err.message || err}`);
      }
    }
  };

  const disconnectWebSerial = async () => {
    try {
      if (serialReaderRef.current) {
        await serialReaderRef.current.cancel();
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close();
      }
    } catch (e) {
      console.warn("Error closing serial port:", e);
    } finally {
      setIsSerialConnected(false);
      serialPortRef.current = null;
      serialReaderRef.current = null;
    }
  };

  // Helper to trigger a test HTTP tap
  const triggerSimulatedTap = async (uid: string) => {
    try {
      const res = await fetch("/api/nfc/tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_uid: uid, device_id: "SIMULATOR_TEST" })
      });
      return await res.json();
    } catch (err) {
      console.error("Simulation failed:", err);
      return null;
    }
  };

  return {
    wifiStatus,
    lastTap,
    isWebSerialSupported,
    isSerialConnected,
    serialError,
    connectWebSerial,
    disconnectWebSerial,
    triggerSimulatedTap
  };
}
