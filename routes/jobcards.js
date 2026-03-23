const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM job_cards ORDER BY createdAt DESC");
        const jobCards = rows.map(card => {
            try {
                return {
                    ...card,
                    processDetails: JSON.parse(card.processDetails || '[]'),
                    quotationDetails: card.quotationDetails ? JSON.parse(card.quotationDetails) : null
                };
            } catch (e) {
                return {
                    ...card,
                    processDetails: [],
                    quotationDetails: null
                };
            }
        });
        res.json({
            "message": "success",
            "data": jobCards
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.post('/', async (req, res) => {
    const {
        customerName, quotationNumber, productName, jobName, poNumber,
        imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
        cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
        paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
        processDetails, quotationDetails,
        coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
        coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy
    } = req.body;

    try {
        // Log the incoming request data for debugging
        console.log('Creating job card with data:', {
            customerName,
            quotationNumber,
            productName,
            jobName,
            processDetailsLength: processDetails ? processDetails.length : 0
        });
        
        const row = await db.get("SELECT MAX(id) as maxId FROM job_cards");
        const nextId = (row.maxId || 0) + 1;
        const jobCardNum = `JC${String(nextId).padStart(4, '0')}`;
        
        const result = await db.run(`INSERT INTO job_cards (
            jobCardNum, customerName, quotationNumber, productName, jobName, poNumber,
            imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
            cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
            paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
            processDetails, quotationDetails,
            coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
            coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [jobCardNum, customerName, quotationNumber, productName, jobName, poNumber,
             imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
             cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
             paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
             JSON.stringify(processDetails || []), quotationDetails,
             coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
             coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy]);
        
        // Log the result for debugging
        console.log('Database insertion result:', result);
        
        // Validate that the insertion was successful
        if (!result || result.lastID === undefined) {
            throw new Error('Database insertion failed - no lastID returned');
        }
        
        if (quotationNumber) {
            await db.run(`UPDATE quotations SET usedForJobCard = 1 WHERE serial = ?`, [quotationNumber]);
        }
        
        res.json({
            "message": "success",
            "data": { id: result.lastID, jobCardNum }
        });
    } catch (err) {
        res.status(400).json({ "error": err.message });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        jobCardNum,
        customerName, quotationNumber, productName, jobName, poNumber,
        imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
        cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
        paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
        processDetails, quotationDetails,
        coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
        coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy
    } = req.body;

    try {
        const existing = await db.get(`SELECT * FROM job_cards WHERE id = ?`, [id]);
        if (!existing) {
            res.status(404).json({ error: 'Job card not found' });
            return;
        }

        await db.run(`UPDATE job_cards SET
            jobCardNum = ?, customerName = ?, quotationNumber = ?, productName = ?, jobName = ?, poNumber = ?,
            imageAttached = ?, imageData = ?, billingType = ?, sampleAttached = ?, paperLength = ?, paperWidth = ?,
            cutSize = ?, ups = ?, qtyFullSheet = ?, qtyCutSheet = ?, paperGsm = ?, paperType = ?,
            paperBy = ?, jobColor = ?, plateBy = ?, jobType = ?, priority = ?, repeatNo = ?, requestPlate = ?,
            processDetails = ?, quotationDetails = ?,
            coverPaperLength = ?, coverPaperWidth = ?, coverCutSize = ?, coverUps = ?,
            coverQtyFullSheet = ?, coverQtyCutSheet = ?, coverPaperGsm = ?, coverPaperType = ?, coverPaperBy = ?
            WHERE id = ?`,
            [
                jobCardNum || existing.jobCardNum, customerName, quotationNumber, productName, jobName, poNumber,
                imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
                cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
                paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
                JSON.stringify(processDetails || []), quotationDetails,
                coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
                coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy,
                id
            ]);

        const oldSerial = existing.quotationNumber;
        const newSerial = quotationNumber;
        if (oldSerial && oldSerial !== newSerial) {
            await db.run(`UPDATE quotations SET usedForJobCard = 0 WHERE serial = ?`, [oldSerial]);
        }
        if (newSerial) {
            await db.run(`UPDATE quotations SET usedForJobCard = 1 WHERE serial = ?`, [newSerial]);
        }

        res.json({ 
            message: 'success', 
            data: { 
                id,
                jobCardNum: jobCardNum || existing.jobCardNum,
                customerName,
                quotationNumber,
                productName,
                jobName
            } 
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
