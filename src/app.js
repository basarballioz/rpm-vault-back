import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import bikesRouter from "../routes/bikes.js";
import bikeDetailsRouter from "../routes/bikeDetails.js";
import brandsRouter from "../routes/brands.js";
import categoriesRouter from "../routes/categories.js";
import usersRouter from "../routes/users.js";
import swaggerUi from "swagger-ui-express";
import hpp from "hpp";
import slowDown from "express-slow-down";
import { openapiSpec } from "./openapi.js";
import { initializeFirebase } from "./firebase.js";

export function createApp() {
    const app = express();
    
    // Initialize Firebase Admin
    initializeFirebase();

    app.set("trust proxy", 1);

    app.use(helmet());
    app.use(hpp());

    const allowedOrigins = (process.env.CORS_ORIGINS || "*")
        .split(",")
        .map((o) => o.trim());
    app.use(
        cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (mobile apps, curl, server-to-server)
                if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                return callback(null, true); // In production on Vercel, allow all origins (Vercel headers handle restriction)
            },
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-CSRF-Token"],
        })
    );

    app.use(compression());
    app.use(express.json({ limit: "1mb" }));
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
    const getMax = Number(process.env.RATE_LIMIT_GET_MAX || 2000);
    const writeMax = Number(process.env.RATE_LIMIT_WRITE_MAX || 300);

    const getLimiter = rateLimit({
        windowMs,
        max: getMax,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.ip,
        skip: (req) => req.path === "/health" || req.path === "/openapi.json" || req.path.startsWith("/docs")
    });

    const writeLimiter = rateLimit({
        windowMs,
        max: writeMax,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.ip,
        skip: (req) => req.path === "/health" || req.path === "/openapi.json" || req.path.startsWith("/docs"),
    });

    app.use((req, res, next) => {
        if (req.method === "GET") {
            return getLimiter(req, res, next);
        }
        return writeLimiter(req, res, next);
    });

    // Slow down suspected bots aggressively on write or high-traffic endpoints (here applies globally)
    const speedLimiterGet = slowDown({
        windowMs,
        delayAfter: Number(process.env.SLOWDOWN_GET_AFTER || 1000),
        delayMs: Number(process.env.SLOWDOWN_GET_DELAY_MS || 10),
        keyGenerator: (req) => req.ip,
        skip: (req) => req.path === "/health" || req.path === "/openapi.json" || req.path.startsWith("/docs"),
    });

    const speedLimiterWrite = slowDown({
        windowMs,
        delayAfter: Number(process.env.SLOWDOWN_WRITE_AFTER || 50),
        delayMs: Number(process.env.SLOWDOWN_WRITE_DELAY_MS || 250),
        keyGenerator: (req) => req.ip,
    });

    app.use((req, res, next) => {
        if (req.method === "GET") {
            return speedLimiterGet(req, res, next);
        }
        return speedLimiterWrite(req, res, next);
    });

    // Basic UA/IP denylist hooks (adjust via env)
    const blockedUserAgents = (process.env.BLOCKED_UA || "AhrefsBot,BadBot").split(",").map((s) => s.trim());
    const blockedIps = (process.env.BLOCKED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
    app.use((req, res, next) => {
        const ua = String(req.headers["user-agent"] || "");
        if (blockedUserAgents.some((sig) => sig && ua.includes(sig))) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const ip = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
        if (ip && blockedIps.includes(String(ip))) {
            return res.status(403).json({ error: "Forbidden" });
        }
        next();
    });

    app.get("/health", (req, res) => {
        res.json({ ok: true, uptime: process.uptime() });
    });

    app.use("/bikes", bikesRouter);
    app.use("/bikes", bikeDetailsRouter);
    app.use("/brands", brandsRouter);
    app.use("/categories", categoriesRouter);
    app.use("/api/users", usersRouter);

    app.get("/openapi.json", (req, res) => res.json(openapiSpec));
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

    app.use((req, res) => {
        res.status(404).json({ error: "Not Found" });
    });

    // Basic error handler (Express 5 async-friendly)
    app.use((err, req, res, next) => {
        const status = err.status || 500;
        res.status(status).json({ error: err.message || "Internal Server Error" });
    });

    return app;
}
