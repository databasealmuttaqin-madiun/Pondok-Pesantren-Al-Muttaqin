import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // In-memory store for ESP32 + RC522 NFC events
  let latestNfcTap: { uid: string; device_id: string; timestamp: number } | null = null;
  const sseClients: Response[] = [];

  // 1. Endpoint for ESP32 RC522 HTTP Tap (Accepts POST / GET query or body)
  const handleNfcTap = async (req: Request, res: Response) => {
    const cardUid = req.body?.card_uid || req.body?.uid || req.query?.card_uid || req.query?.uid;
    const deviceId = req.body?.device_id || req.query?.device_id || "ESP32_RC522";

    if (!cardUid) {
      res.status(400).json({ success: false, message: "card_uid or uid parameter required" });
      return;
    }

    const cleanUid = String(cardUid).trim().toUpperCase();
    latestNfcTap = {
      uid: cleanUid,
      device_id: String(deviceId),
      timestamp: Date.now()
    };

    // Store in Supabase rest/v1/nfc_taps to persist across Vercel serverless instances
    try {
      const supabaseUrl = process.env.SUPABASE_URL || "https://eflhcunxpckcynozywol.supabase.co";
      const supabaseKey = process.env.SUPABASE_ANON_KEY || "sb_publishable_fqZTO3lL9cb88K61NXjKHw_zH8O3TuZ";

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
          created_at: new Date().toISOString()
        })
      });
    } catch (err) {
      // Ignore if database sync fails, fallback to memory
    }

    // Broadcast to all SSE connected browsers instantly
    const sseData = `data: ${JSON.stringify(latestNfcTap)}\n\n`;
    for (let i = sseClients.length - 1; i >= 0; i--) {
      try {
        sseClients[i].write(sseData);
      } catch (err) {
        sseClients.splice(i, 1);
      }
    }

    console.log(`[ESP32 NFC] Card Tapped: ${cleanUid} from ${deviceId}`);
    res.json({
      success: true,
      status: true,
      message: "Berhasil Membaca Kartu",
      card_uid: cleanUid,
      uid: cleanUid,
      device_id: deviceId,
      timestamp: latestNfcTap.timestamp
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
    const { username, password } = req.body;
    if (username === "angie.seprisa" && password === "pssleman") {
      res.json({
        success: true,
        message: "Login berhasil",
        token: "session_token_admin_pp_almuttaqin_2026",
        user: {
          username: "angie.seprisa",
          role: "admin",
          name: "Angie Seprisa"
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: "ID Pengguna atau Password salah!"
      });
    }
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
