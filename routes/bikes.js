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

        const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const andConditions = [];

        // Brand filter with multiple values support
        if (brand) {
            const brands = String(brand)
                .split(",")
                .map((b) => b.trim())
                .filter(Boolean);
            if (brands.length === 1) {
                const rx = new RegExp(`^${escapeRegex(brands[0])}$`, "i");
                andConditions.push({ $or: [{ brand: { $regex: rx } }, { Brand: { $regex: rx } }] });
            } else if (brands.length > 1) {
                const brandPattern = brands.map(escapeRegex).join("|");
                const rx = new RegExp(`^(${brandPattern})$`, "i");
                andConditions.push({ $or: [{ brand: { $regex: rx } }, { Brand: { $regex: rx } }] });
            }
        }

        if (model) {
            const rx = new RegExp(escapeRegex(String(model).trim()), "i");
            andConditions.push({ $or: [{ model: { $regex: rx } }, { Model: { $regex: rx } }] });
        }

        // Category filter with multiple values support
        if (category) {
            const categories = String(category)
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean);
            if (categories.length === 1) {
                const rx = new RegExp(`^${escapeRegex(categories[0])}$`, "i");
                andConditions.push({ $or: [{ category: { $regex: rx } }, { Category: { $regex: rx } }] });
            } else if (categories.length > 1) {
                const categoryPattern = categories.map(escapeRegex).join("|");
                const rx = new RegExp(`^(${categoryPattern})$`, "i");
                andConditions.push({ $or: [{ category: { $regex: rx } }, { Category: { $regex: rx } }] });
            }
        }

        // Search support (brand OR model)
        if (search) {
            const term = String(search).trim();
            if (term) {
                const rx = new RegExp(escapeRegex(term), "i");
                andConditions.push({
                    $or: [
                        { brand: { $regex: rx } },
                        { Brand: { $regex: rx } },
                        { model: { $regex: rx } },
                        { Model: { $regex: rx } },
                    ],
                });
            }
        }

        const query = andConditions.length > 0 ? { $and: andConditions } : {};

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

        const parseNumberExpr = (input) => ({
            $toDouble: {
                $ifNull: [
                    {
                        $let: {
                            vars: {
                                match: {
                                    $regexFind: {
                                        input: {
                                            $convert: {
                                                input: { $ifNull: [input, ""] },
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

        const sortFields = {
            _sortBrand: { $ifNull: ["$brand", "$Brand"] },
            _sortModel: { $ifNull: ["$model", "$Model"] },
        };
        let sortSpec = { _sortBrand: 1, _sortModel: 1 };

        switch (sortKey) {
            case "year-asc":
                sortFields._sortYear = parseNumberExpr({ $ifNull: ["$year", "$Year"] });
                sortSpec = { _sortYear: 1, _sortBrand: 1, _sortModel: 1 };
                break;
            case "year-desc":
                sortFields._sortYear = parseNumberExpr({ $ifNull: ["$year", "$Year"] });
                sortSpec = { _sortYear: -1, _sortBrand: 1, _sortModel: 1 };
                break;
            case "cc-asc":
                sortFields._sortCc = parseNumberExpr({ $ifNull: ["$displacement", "$Displacement"] });
                sortSpec = { _sortCc: 1, _sortBrand: 1, _sortModel: 1 };
                break;
            case "cc-desc":
                sortFields._sortCc = parseNumberExpr({ $ifNull: ["$displacement", "$Displacement"] });
                sortSpec = { _sortCc: -1, _sortBrand: 1, _sortModel: 1 };
                break;
            case "hp-asc":
                sortFields._sortHp = parseNumberExpr({ $ifNull: ["$hp", "$Power"] });
                sortSpec = { _sortHp: 1, _sortBrand: 1, _sortModel: 1 };
                break;
            case "hp-desc":
                sortFields._sortHp = parseNumberExpr({ $ifNull: ["$hp", "$Power"] });
                sortSpec = { _sortHp: -1, _sortBrand: 1, _sortModel: 1 };
                break;
            case "name-asc":
                sortSpec = { _sortBrand: 1, _sortModel: 1 };
                break;
            case "name-desc":
                sortSpec = { _sortBrand: -1, _sortModel: -1 };
                break;
            default:
                sortSpec = { _sortBrand: 1, _sortModel: 1 };
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
