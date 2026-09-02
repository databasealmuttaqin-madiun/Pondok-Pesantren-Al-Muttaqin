import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS Middleware for external ESP32, ngrok, local network, and cross-origin requests
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, x-requested-with");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // In-memory store for ESP32 + RC522 NFC events
  let latestNfcTap: { uid: string; device_id: string; timestamp: number } | null = null;
  const sseClients: Response[] = [];

  // 1. Endpoint for ESP32 RC522 HTTP Tap (Accepts POST / GET query or body)
  const handleNfcTap = async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");

    const cardUid = req.body?.card_uid || req.body?.uid || req.query?.card_uid || req.query?.uid;
    const deviceId = req.body?.device_id || req.query?.device_id || "ESP32_GATE_01";

    if (!cardUid) {
      res.status(400).json({
        success: false,
        status: "NOT_REGISTERED",
        message: "Kartu Tak Dikenal",
        nama: "Tidak Dikenal"
      });
      return;
    }

    const cleanUid = String(cardUid).trim().toUpperCase();
    const rawNoColons = cleanUid.replace(/[^A-F0-9]/gi, "");

    latestNfcTap = {
      uid: cleanUid,
      device_id: String(deviceId),
      timestamp: Date.now()
    };

    const supabaseUrl = process.env.SUPABASE_URL || "https://eflhcunxpckcynozywol.supabase.co";
    const supabaseKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_fqZTO3lL9cb88K61NXjKHw_zH8O3TuZ";

    let studentName: string | null = null;

    // 1. Search 'santri' table
    try {
      const santriRes = await fetch(
        `${supabaseUrl}/rest/v1/santri?select=nama,nama_lengkap,nama_panggilan,nfc_id,card_uid,rfid`,
        {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`
          }
        }
      );
      if (santriRes.ok) {
        const rows = await santriRes.json();
        if (Array.isArray(rows)) {
          const match = rows.find((r: any) => {
            const keys = [r.nfc_id, r.card_uid, r.rfid].filter(Boolean);
            return keys.some((k) => {
              const norm = String(k).replace(/[^A-F0-9]/gi, "").toUpperCase();
              return norm === rawNoColons || String(k).trim().toUpperCase() === cleanUid;
            });
          });
          if (match) {
            studentName = match.nama || match.nama_lengkap || match.nama_panggilan || null;
          }
        }
      }
    } catch (err) {
      console.warn("Supabase santri table query error:", err);
    }

    // 2. Search 'nfc' table if not found in 'santri'
    if (!studentName) {
      try {
        const nfcRes = await fetch(
          `${supabaseUrl}/rest/v1/nfc?select=nama,serial_number`,
          {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`
            }
          }
        );
        if (nfcRes.ok) {
          const rows = await nfcRes.json();
          if (Array.isArray(rows)) {
            const match = rows.find((r: any) => {
              if (!r.serial_number) return false;
              const snNorm = String(r.serial_number).replace(/[^A-F0-9]/gi, "").toUpperCase();
              return snNorm === rawNoColons || String(r.serial_number).trim().toUpperCase() === cleanUid;
            });
            if (match && match.nama) {
              studentName = match.nama;
            }
          }
        }
      } catch (err) {
        console.warn("Supabase NFC table query error:", err);
      }
    }

    // 3. Determine Attendance Status & Save Record
    let tapStatus: "SUCCESS" | "ALREADY_ATTENDED" | "NOT_REGISTERED" = "NOT_REGISTERED";
    let responseMessage = "Kartu Tak Dikenal";

    if (studentName) {
      // Get today's local date in YYYY-MM-DD
      const now = new Date();
      const jakartaOffset = 7 * 60; // UTC+7 WIB
      const localDate = new Date(now.getTime() + (now.getTimezoneOffset() + jakartaOffset) * 60000);
      const dateStr = localDate.toISOString().slice(0, 10);
      const timeStr = localDate.toTimeString().slice(0, 8);

      try {
        // Check if student has already taken attendance today
        const checkRes = await fetch(
          `${supabaseUrl}/rest/v1/absensi?select=id,status,waktu&nama=eq.${encodeURIComponent(studentName)}&tanggal=eq.${dateStr}`,
          {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`
            }
          }
        );

        if (checkRes.ok) {
          const rows = await checkRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            tapStatus = "ALREADY_ATTENDED";
            responseMessage = "Sudah Absen";
          } else {
            tapStatus = "SUCCESS";
            responseMessage = "Presensi Berhasil";

            await fetch(`${supabaseUrl}/rest/v1/absensi`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": supabaseKey,
                "Authorization": `Bearer ${supabaseKey}`,
                "Prefer": "return=minimal"
              },
              body: JSON.stringify({
                nama: studentName,
                kamar: "Santri",
                presensi: "sholat",
                status: "hadir",
                tanggal: dateStr,
                sesi: "Harian",
                waktu: timeStr
              })
            });
          }
        } else {
          tapStatus = "SUCCESS";
          responseMessage = "Presensi Berhasil";
        }
      } catch (e) {
        tapStatus = "SUCCESS";
        responseMessage = "Presensi Berhasil";
      }
    }

    // 4. Save event into Supabase 'nfc_taps' table
    try {
      await fetch(`${supabaseUrl}/rest/v1/nfc_taps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          uid: cleanUid,
          device_id: String(deviceId),
          nama: studentName || "Tidak Dikenal",
          status: tapStatus,
          created_at: new Date().toISOString()
        })
      });
    } catch (err) {
      // Ignore sync error
    }

    // Broadcast to SSE clients
    const ssePayload = {
      ...latestNfcTap,
      nama: studentName || "Tidak Dikenal",
      status: tapStatus,
      message: responseMessage
    };
    const sseData = `data: ${JSON.stringify(ssePayload)}\n\n`;
    for (let i = sseClients.length - 1; i >= 0; i--) {
      try {
        sseClients[i].write(sseData);
      } catch (err) {
        sseClients.splice(i, 1);
      }
    }

    console.log(`[ESP32 NFC Tap] UID: ${cleanUid} | Student: ${studentName || "Tidak Dikenal"} | Status: ${tapStatus}`);

    res.json({
      success: tapStatus === "SUCCESS",
      status: tapStatus,
      message: responseMessage,
      nama: studentName || "Tidak Dikenal",
      card_uid: cleanUid,
      device_id: String(deviceId)
    });
  };

  app.post("/api/nfc/tap", handleNfcTap);
  app.get("/api/nfc/tap", handleNfcTap);

  // 2. Endpoint to fetch latest tapped NFC
  app.get("/api/nfc/latest", async (req, res) => {
    let tapResult = latestNfcTap;

    // Check Supabase for latest tap across Vercel serverless functions
    try {
      const supabaseUrl = process.env.SUPABASE_URL || "https://eflhcunxpckcynozywol.supabase.co";
      const supabaseKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_fqZTO3lL9cb88K61NXjKHw_zH8O3TuZ";

      const sbRes = await fetch(`${supabaseUrl}/rest/v1/nfc_taps?select=*&order=created_at.desc&limit=1`, {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        }
      });

      if (sbRes.ok) {
        const rows = await sbRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          const rowTime = new Date(row.created_at).getTime();
          if (!tapResult || rowTime > tapResult.timestamp) {
            tapResult = {
              uid: row.uid,
              device_id: row.device_id || "ESP32_RC522",
              timestamp: rowTime
            };
          }
        }
      }
    } catch (e) {
      // Ignore error and return memory tapResult
    }

    res.json({
      success: true,
      latestTap: tapResult
    });
  });

  // 3. SSE Stream endpoint for real-time live push to browser
  app.get("/api/nfc/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    if (latestNfcTap) {
      res.write(`data: ${JSON.stringify(latestNfcTap)}\n\n`);
    }

    sseClients.push(res);

    req.on("close", () => {
      const index = sseClients.indexOf(res);
      if (index !== -1) sseClients.splice(index, 1);
    });
  });

  // API Route for Admin Login
  app.post("/api/login", (req, res) => {
    res.status(401).json({
      success: false,
      message: "Silakan gunakan login langsung melalui database."
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
