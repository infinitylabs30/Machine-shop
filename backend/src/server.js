const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const pool = require("./config/database");
const attendanceRoutes = require("./routes/attendanceRoutes");
const faceRoutes = require("./routes/faceRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const productionRoutes = require("./routes/productionRoutes");
const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.use("/api/attendance", attendanceRoutes);
app.use("/api/face", faceRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            success: true,
            database: "connected",
            time: result.rows[0].now,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            database: "disconnected",
        });
    }
});

// Serve the React production build when it exists.
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));

    // React client-side routing fallback (Express 5 syntax).
    app.get("/{*splat}", (req, res) => {
        res.sendFile(path.join(frontendDist, "index.html"));
    });
}

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Foundry Management System API is running",
    });
});

const PORT = process.env.PORT || 5000;

// Keep the face service warm while this backend process is running.
const faceServiceUrl = (process.env.FACE_SERVICE_URL || "").replace(/\/+$/, "");
const faceServicePingIntervalMs = 5 * 60 * 1000;

async function pingFaceService() {
    if (!faceServiceUrl) {
        console.warn("FACE_SERVICE_URL is not configured; keep-alive ping is disabled.");
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(`${faceServiceUrl}/health`, {
            method: "GET",
            signal: controller.signal,
        });

        if (response.ok) {
            console.log(`Face service keep-alive: healthy (HTTP ${response.status})`);
        } else {
            console.warn(`Face service keep-alive: HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn(`Face service keep-alive failed: ${error.message}`);
    } finally {
        clearTimeout(timeout);
    }
}

function scheduleFaceServicePing() {
    setTimeout(async () => {
        await pingFaceService();
        scheduleFaceServicePing();
    }, faceServicePingIntervalMs);
}

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Foundry server listening on port ${PORT}`);

    // Ping once on startup, then every five minutes.
    pingFaceService();
    scheduleFaceServicePing();
});
