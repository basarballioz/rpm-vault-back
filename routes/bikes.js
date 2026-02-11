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
        query("sort").optional().isString().trim().isLength({ max: 64 }),
    ],
    async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const db = await getDb();
        const { brand, model, category, search, page = 1, limit = 50, sort } = req.query;

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

        const allowedSorts = new Set([
            "year-asc",
            "year-desc",
            "cc-asc",
            "cc-desc",
            "hp-asc",
            "hp-desc",
            "name-asc",
            "name-desc",
        ]);
        const sortKey = allowedSorts.has(String(sort || "")) ? String(sort) : null;

        const parseNumberExpr = (field) => ({
            $toDouble: {
                $ifNull: [
                    {
                        $let: {
                            vars: {
                                match: {
                                    $regexFind: {
                                        input: {
                                            $convert: {
                                                input: { $ifNull: [field, ""] },
                                                to: "string",
                                                onError: "",
                                                onNull: "",
                                            },
                                        },
                                        regex: "[\\d.]+",
                                    },
                                },
                            },
                            in: {
                                $cond: {
                                    if: { $ne: ["$$match", null] },
                                    then: "$$match.match",
                                    else: "0",
                                },
                            },
                        },
                    },
                    "0",
                ],
            },
        });

        const sortFields = {};
        let sortSpec = { Brand: 1, Model: 1 };

        switch (sortKey) {
            case "year-asc":
                sortFields._sortYear = parseNumberExpr("$Year");
                sortSpec = { _sortYear: 1, Brand: 1, Model: 1 };
                break;
            case "year-desc":
                sortFields._sortYear = parseNumberExpr("$Year");
                sortSpec = { _sortYear: -1, Brand: 1, Model: 1 };
                break;
            case "cc-asc":
                sortFields._sortCc = parseNumberExpr("$Displacement");
                sortSpec = { _sortCc: 1, Brand: 1, Model: 1 };
                break;
            case "cc-desc":
                sortFields._sortCc = parseNumberExpr("$Displacement");
                sortSpec = { _sortCc: -1, Brand: 1, Model: 1 };
                break;
            case "hp-asc":
                sortFields._sortHp = parseNumberExpr("$Power");
                sortSpec = { _sortHp: 1, Brand: 1, Model: 1 };
                break;
            case "hp-desc":
                sortFields._sortHp = parseNumberExpr("$Power");
                sortSpec = { _sortHp: -1, Brand: 1, Model: 1 };
                break;
            case "name-asc":
                sortSpec = { Brand: 1, Model: 1 };
                break;
            case "name-desc":
                sortSpec = { Brand: -1, Model: -1 };
                break;
            default:
                sortSpec = { Brand: 1, Model: 1 };
                break;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitValue = parseInt(limit);
        const shouldAggregate = Object.keys(sortFields).length > 0;

        let bikes = [];
        if (shouldAggregate) {
            const pipeline = [
                { $match: query },
                { $addFields: sortFields },
                { $sort: sortSpec },
                { $skip: skip },
                { $limit: limitValue },
                { $unset: Object.keys(sortFields) },
            ];
            bikes = await collection.aggregate(pipeline).toArray();
        } else {
            bikes = await collection
                .find(query)
                .sort(sortSpec)
                .skip(skip)
                .limit(limitValue)
                .toArray();
        }

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

// POST /bikes/by-ids - Get bikes by array of IDs
router.post("/by-ids", async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Valid IDs array required" });
        }

        const db = await getDb();
        const { ObjectId } = await import("mongodb");
        
        // Convert string IDs to ObjectId
        const objectIds = ids.map(id => {
            try {
                return new ObjectId(id);
            } catch (error) {
                return null;
            }
        }).filter(Boolean);

        const bikes = await db
            .collection("allbikes")
            .find({ _id: { $in: objectIds } })
            .toArray();

        res.json(bikes.map(b => ({ ...b, _id: b._id.toString() })));
    } catch (err) {
        console.error('Error fetching bikes by IDs:', err);
        res.status(500).json({ error: "Motorları getirirken bir hata oluştu" });
    }
});

export default router;
