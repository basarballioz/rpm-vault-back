import dotenv from "dotenv";
import { createApp } from "../src/app.js";

dotenv.config();

const app = createApp();

export default function handler(req, res) {
  // CORS headers for Vercel serverless
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  return app(req, res);
}


