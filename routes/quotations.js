const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
    const includeUsed = req.query.includeUsed === 'true';
    const includeCancelled = req.query.includeCancelled === 'true';
    
    let whereClause = '';
    const conditions = [];
    
    if (!includeUsed) {
        conditions.push('(usedForJobCard IS NULL OR usedForJobCard = 0)');
    }
    
    if (!includeCancelled) {
        conditions.push('(cancelled IS NULL OR cancelled = 0)');
    }
    
    if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    try {
        const rows = await db.all(`SELECT * FROM quotations ${whereClause} ORDER BY serial DESC`);
        res.json({
            "message": "success",
            "data": rows.map(row => {
                try {
                    const parsedData = JSON.parse(row.data);
                    return {
                        ...parsedData,
                        id: row.id,
                        productType: row.productType,
                        serial: row.serial,
                        customerName: row.customerName || parsedData.inputs?.customerName,
                        usedForJobCard: row.usedForJobCard || 0,
                        cancelled: row.cancelled || 0,
                    };
                } catch (e) {
                    return {
                        id: row.id,
                        productType: row.productType,
                        serial: row.serial,
                        customerName: row.customerName,
                        usedForJobCard: row.usedForJobCard || 0,
                        cancelled: row.cancelled || 0,
                        error: "Invalid data format"
                    };
                }
            })
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.post('/', async (req, res) => {
    const { productType, inputs, ...data } = req.body;
    const customerName = inputs ? inputs.customerName : 'N/A';
    const dataString = JSON.stringify({ inputs, ...data });

    try {
        const row = await db.get("SELECT MAX(serial) as maxSerial FROM quotations");
        const nextSerial = (row.maxSerial || 0) + 1;
        
        const result = await db.run(`INSERT INTO quotations (productType, serial, customerName, data, usedForJobCard) VALUES (?, ?, ?, ?, ?)`, 
            [productType, nextSerial, customerName, dataString, 0]);
        
        res.json({
            "message": "success",
            "data": { 
                id: result.lastID, 
                productType, 
                serial: nextSerial, 
                customerName, 
                inputs, 
                usedForJobCard: 0,
                ...data 
            }
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { productType, inputs, ...data } = req.body;
    const customerName = inputs ? inputs.customerName : 'N/A';
    const dataString = JSON.stringify({ inputs, ...data });

    try {
        const result = await db.run(`UPDATE quotations SET productType = ?, customerName = ?, data = ? WHERE id = ?`,
            [productType, customerName, dataString, id]);

        if (result.changes === 0) {
            res.status(404).json({ "error": "Quotation not found" });
            return;
        }
        res.json({
            "message": "success",
            "data": {
                id: id,
                productType,
                customerName,
                inputs,
                ...data
            }
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.get('/:serial', async (req, res) => {
    const { serial } = req.params;
    try {
        const row = await db.get(`SELECT * FROM quotations WHERE serial = ?`, [serial]);
        if (!row) {
            res.status(404).json({ "error": "Quotation not found" });
            return;
        }
        try {
            const parsedData = JSON.parse(row.data);
            res.json({
                "message": "success",
                "data": {
                    ...parsedData,
                    id: row.id,
                    productType: row.productType,
                    serial: row.serial,
                    customerName: row.customerName || parsedData.inputs?.customerName,
                    usedForJobCard: row.usedForJobCard || 0,
                    cancelled: row.cancelled || 0
                }
            });
        } catch (e) {
            res.json({
                "message": "success",
                "data": {
                    id: row.id,
                    productType: row.productType,
                    serial: row.serial,
                    customerName: row.customerName,
                    usedForJobCard: row.usedForJobCard || 0,
                    error: "Invalid data format"
                }
            });
        }
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Cancel quotation endpoint
router.patch('/:id/cancel', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.run(`UPDATE quotations SET cancelled = 1 WHERE id = ?`, [id]);
        
        if (result.changes === 0) {
            res.status(404).json({ "error": "Quotation not found" });
            return;
        }
        
        res.json({
            "message": "Quotation cancelled successfully",
            "data": { id: id, cancelled: 1 }
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

// Uncancel quotation endpoint
router.patch('/:id/uncancel', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.run(`UPDATE quotations SET cancelled = 0 WHERE id = ?`, [id]);
        
        if (result.changes === 0) {
            res.status(404).json({ "error": "Quotation not found" });
            return;
        }
        
        res.json({
            "message": "Quotation uncancelled successfully",
            "data": { id: id, cancelled: 0 }
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

module.exports = router;
