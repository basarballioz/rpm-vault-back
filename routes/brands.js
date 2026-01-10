import express from "express";
import { getDb } from "./db.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const db = await getDb();
        const brands = await db.collection("brands").find({}).toArray();
        res.json(brands);
    } catch (err) {
        next(err);
    }
});

export default router;
