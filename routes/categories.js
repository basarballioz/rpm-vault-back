import express from "express";
import { getDb } from "./db.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const db = await getDb();
        const categories = await db.collection("categories").find({}).toArray();

        // Extract category names from "category" field and filter out "Category" (header)
        const categoryNames = categories
            .map(item => item.category)
            .filter(name => name && typeof name === 'string' && name !== 'Category')
            .sort();

        // Remove duplicates
        const uniqueCategories = [...new Set(categoryNames)];

        res.json(uniqueCategories);
    } catch (err) {
        next(err);
    }
});

export default router;
