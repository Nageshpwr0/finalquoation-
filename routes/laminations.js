const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM lamination_types");
        res.json({
            "message": "success",
            "data": rows
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.post('/', async (req, res) => {
    const { laminationName, rate } = req.body;
    
    if (!laminationName) {
        return res.status(400).json({ "error": "Lamination name is required" });
    }
    
    try {
        const result = await db.run(`INSERT INTO lamination_types (laminationName, rate) VALUES (?, ?)`, 
            [laminationName, rate || null]);
        res.json({ "message": "success", "id": result.lastID });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.put('/:id', async (req, res) => {
    const { laminationName, rate } = req.body;
    const { id } = req.params;
    
    if (!laminationName) {
        return res.status(400).json({ "error": "Lamination name is required" });
    }
    
    try {
        const result = await db.run(`UPDATE lamination_types SET laminationName = ?, rate = ? WHERE id = ?`, 
            [laminationName, rate || null, id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ "error": "Lamination type not found" });
        }
        
        res.json({ "message": "success" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.run(`DELETE FROM lamination_types WHERE id = ?`, [id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ "error": "Lamination type not found" });
        }
        
        res.json({ "message": "success" });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

module.exports = router;