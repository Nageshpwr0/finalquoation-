const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM customers");
        res.json({
            "message": "success",
            "data": rows.map(row => ({
                ...row,
                customerName: row.name
            }))
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.post('/', async (req, res) => {
    const { customerName, margin } = req.body;
    try {
        const result = await db.run(`INSERT INTO customers (name, margin) VALUES (?, ?)`, [customerName, margin]);
        res.json({ "message": "success", "id": result.lastID });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { customerName, margin } = req.body;
    try {
        const result = await db.run(`UPDATE customers SET name = ?, margin = ? WHERE id = ?`,
            [customerName, margin, id]);
        if (result.changes === 0) {
            res.status(404).json({ "error": "Customer not found" });
            return;
        }
        res.json({ "message": "success" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

module.exports = router;
