import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
