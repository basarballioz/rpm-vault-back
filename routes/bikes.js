import express from "express";
import { getDb } from "./db.js";
import { query, validationResult } from "express-validator";

const router = express.Router();

// GET /bikes?brand=Bajaj&model=Dominar&page=1&limit=50
router.get(
    "/",
    [
        query("brand").optional().isString().trim().isLength({ max: 512 }),
        query("model").optional().isString().trim().isLength({ max: 128 }),
        query("category").optional().isString().trim().isLength({ max: 512 }),
        query("search").optional().isString().trim().isLength({ max: 256 }),
        query("page").optional().isInt({ min: 1, max: 1000000 }).toInt(),
        query("limit").optional().isInt({ min: 1, max: 1000 }).toInt(),
    ],
    async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const db = await getDb();
        const { brand, model, category, search, page = 1, limit = 50 } = req.query;

        const collection = db.collection("allbikes");

        // Query oluştur
            const query = {};
            // Brand filter with multiple values support
            if (brand) {
                const brands = String(brand)
                    .split(",")
                    .map((b) => b.trim())
                    .filter(Boolean);
                if (brands.length === 1) {
                    query.Brand = { $regex: new RegExp(`^${brands[0]}$`, "i") };
                } else if (brands.length > 1) {
                    // Multiple brands - use regex alternation
                    const brandPattern = brands.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
                    query.Brand = { $regex: new RegExp(`^(${brandPattern})$`, "i") };
                }
            }
            if (model) query.Model = { $regex: new RegExp(model.trim(), "i") };
            // Category filter with multiple values support
            if (category) {
                const categories = String(category)
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean);
                if (categories.length === 1) {
                    query.Category = { $regex: new RegExp(`^${categories[0]}$`, "i") };
                } else if (categories.length > 1) {
                    // Multiple categories - use regex alternation
                    const categoryPattern = categories.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
                    query.Category = { $regex: new RegExp(`^(${categoryPattern})$`, "i") };
                }
            }
            // Search support (brand OR model)
            if (search) {
                const term = String(search).trim();
                if (term) {
                    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
                    const searchConditions = [
                        { Brand: { $regex: rx } },
                        { Model: { $regex: rx } },
                    ];
                    // If we already have filters, we need to AND them with the search
                    if (Object.keys(query).length > 0) {
                        const existingQuery = { ...query };
                        query.$and = [
                            existingQuery,
                            { $or: searchConditions }
                        ];
                        Object.keys(existingQuery).forEach(key => {
                            if (key !== '$and') delete query[key];
                        });
                    } else {
                        query.$or = searchConditions;
                    }
                }
            }

        const bikes = await collection
            .find(query)
            .sort({ Brand: 1, Model: 1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .toArray();

        const total = await collection.countDocuments(query);

        res.json({
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            bikes: bikes.map(b => ({ ...b, _id: b._id.toString() }))
        });
    } catch (err) {
        console.error('Error fetching bikes:', err);
        res.status(500).json({ error: "Motorları getirirken bir hata oluştu" });
    }
}
);

export default router;
