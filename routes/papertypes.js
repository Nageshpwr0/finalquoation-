const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM paper_types");
        res.json({
            "message": "success",
            "data": rows
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.post('/', async (req, res) => {
    const { paperTypeName, ratePerKg, minGsm, maxGsm } = req.body;
    
    if (!paperTypeName) {
        return res.status(400).json({ "error": "Paper type name is required" });
    }
    
    try {
        const result = await db.run(`INSERT INTO paper_types (paperTypeName, ratePerKg, minGsm, maxGsm) VALUES (?, ?, ?, ?)`, 
            [paperTypeName, ratePerKg || null, minGsm || null, maxGsm || null]);
        res.json({ "message": "success", "id": result.lastID });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

module.exports = router;
