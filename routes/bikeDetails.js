import express from "express";
import { getDb } from "./db.js";
import { ObjectId } from "mongodb";
import { param, validationResult } from "express-validator";

const router = express.Router();

// GET /bikes/:id (id ile motor sorgulama)
router.get(
    "/:id",
    [param("id").custom((v) => ObjectId.isValid(v)).withMessage("Geçersiz motor ID'si")],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const db = await getDb();
            const { id } = req.params;

            const bike = await db.collection("allbikes").findOne({ _id: new ObjectId(id) });

            if (!bike) {
                return res.status(404).json({ error: "Motor bulunamadı" });
            }

            res.json({ ...bike, _id: bike._id.toString() });
        } catch (err) {
            console.error("Error fetching bike details:", err);
            res.status(500).json({ error: "Motor detayları getirilirken bir hata oluştu" });
        }
    }
);

export default router;
