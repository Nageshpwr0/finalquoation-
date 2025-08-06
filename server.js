const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3002;

// #region Middleware Setup
app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        if (req.body && Object.keys(req.body).length > 0) {
            console.log('Request body:', JSON.stringify(req.body, null, 2));
        }
    }
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (req.path.startsWith('/api/')) {
        res.status(500).json({ error: 'Internal server error' });
    } else {
        next(err);
    }
});
// #endregion

// #region API Route Definitions
app.get('/api/quotations', (req, res) => {
    const includeUsed = req.query.includeUsed === 'true';
    const whereClause = includeUsed ? '' : 'WHERE usedForJobCard IS NULL OR usedForJobCard = 0';
    
    db.all(`SELECT * FROM quotations ${whereClause} ORDER BY serial DESC`, [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
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
                    };
                } catch (e) {
                    console.error(`Error parsing data for quotation ID ${row.id}:`, e);
                    return {
                        id: row.id,
                        productType: row.productType,
                        serial: row.serial,
                        customerName: row.customerName,
                        usedForJobCard: row.usedForJobCard || 0,
                        error: "Invalid data format"
                    };
                }
            })
        });
    });
});

app.post('/api/quotations', (req, res) => {
    const { productType, inputs, ...data } = req.body;
    const customerName = inputs ? inputs.customerName : 'N/A';
    const dataString = JSON.stringify({ inputs, ...data });

    db.get("SELECT MAX(serial) as maxSerial FROM quotations", [], (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        
        const nextSerial = (row.maxSerial || 0) + 1;
        
        db.run(`INSERT INTO quotations (productType, serial, customerName, data, usedForJobCard) VALUES (?, ?, ?, ?, ?)`, 
            [productType, nextSerial, customerName, dataString, 0], 
            function(err) {
                if (err) {
                    res.status(400).json({ "error": err.message });
                    return;
                }
                const savedData = { 
                    id: this.lastID, 
                    productType, 
                    serial: nextSerial, 
                    customerName, 
                    inputs, 
                    usedForJobCard: 0,
                    ...data 
                };
                res.json({
                    "message": "success",
                    "data": savedData
                });
            }
        );
    });
});

app.put('/api/quotations/:id', (req, res) => {
    const { productType, serial, inputs, ...data } = req.body;
    const customerName = inputs ? inputs.customerName : 'N/A';
    const dataString = JSON.stringify({ inputs, ...data });

    db.run(`UPDATE quotations SET productType = ?, serial = ?, customerName = ?, data = ? WHERE id = ?`,
        [productType, serial, customerName, dataString, req.params.id],
        function(err) {
            if (err) {
                res.status(400).json({ "error": err.message });
                return;
            }
            const updatedQuotation = {
                id: req.params.id,
                productType,
                serial,
                customerName,
                inputs,
                ...data
            };
            res.json({
                message: "success",
                data: updatedQuotation,
                changes: this.changes
            });
        }
    );
});

app.delete('/api/quotations/:id', (req, res) => {
    db.run(`DELETE FROM quotations WHERE id = ?`, req.params.id, function(err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({ message: "deleted", changes: this.changes });
    });
});

app.get('/api/customers', (req, res) => {
    db.all("SELECT * FROM customers", [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        const customers = rows.map(row => ({
            ...row,
            customerName: row.name
        }));
        res.json({
            "message": "success",
            "data": customers
        });
    });
});

app.post('/api/customers', (req, res) => {
    const { customerName } = req.body;
    db.run(`INSERT INTO customers (name) VALUES (?)`, 
        [customerName], 
        function(err) {
            if (err) {
                res.status(400).json({ "error": err.message });
                return;
            }
            res.json({ "message": "success", "id": this.lastID });
        }
    );
});

app.put('/api/customers/:id', (req, res) => {
    const { customerName } = req.body;
    db.run(`UPDATE customers SET name = ? WHERE id = ?`,
        [customerName, req.params.id],
        function(err) {
            if (err) {
                res.status(400).json({ "error": err.message });
                return;
            }
            res.json({
                message: "success",
                changes: this.changes
            });
        }
    );
});

app.delete('/api/customers/:id', (req, res) => {
    db.run(`DELETE FROM customers WHERE id = ?`, req.params.id, function(err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({ message: "deleted", changes: this.changes });
    });
});

app.get('/api/papertypes', (req, res) => {
    db.all("SELECT * FROM paper_types", [], (err, rows) => {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        const paperTypesWithUsage = rows.map(paperType => ({
            ...paperType,
            usedInQuotations: 0,
            canEdit: true,
            canDelete: true
        }));
        res.json({
            "message": "success",
            "data": paperTypesWithUsage
        });
    });
});

app.post('/api/papertypes', (req, res) => {
    const { paperTypeName, ratePerKg, minGsm, maxGsm } = req.body;
    
    if (!paperTypeName) {
        return res.status(400).json({ "error": "Paper type name is required" });
    }
    
    db.run(`INSERT INTO paper_types (paperTypeName, ratePerKg, minGsm, maxGsm) VALUES (?, ?, ?, ?)`, 
        [paperTypeName, ratePerKg || null, minGsm || null, maxGsm || null], 
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(400).json({ "error": err.message });
            }
            
            console.log('Paper type created successfully, ID:', this.lastID);
            res.json({ "message": "success", "id": this.lastID });
        }
    );
});

app.put('/api/papertypes/:id', (req, res) => {
    const { paperTypeName, ratePerKg, minGsm, maxGsm } = req.body;
    
    if (!paperTypeName) {
        return res.status(400).json({ "error": "Paper type name is required" });
    }
    
    db.run(`UPDATE paper_types SET paperTypeName = ?, ratePerKg = ?, minGsm = ?, maxGsm = ? WHERE id = ?`,
        [paperTypeName, ratePerKg || null, minGsm || null, maxGsm || null, req.params.id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(400).json({ "error": err.message });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ "error": "Paper type not found" });
            }
            
            console.log('Paper type updated successfully, changes:', this.changes);
            res.json({
                message: "success",
                changes: this.changes
            });
        }
    );
});

app.delete('/api/papertypes/:id', (req, res) => {
    db.run(`DELETE FROM paper_types WHERE id = ?`, req.params.id, function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(400).json({ "error": err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ "error": "Paper type not found" });
        }
        
        console.log('Paper type deleted successfully, changes:', this.changes);
        res.json({ message: "deleted", changes: this.changes });
    });
});

app.get('/api/jobcards', (req, res) => {
    db.all("SELECT * FROM job_cards ORDER BY createdAt DESC", [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        const jobCards = rows.map(card => {
            try {
                return {
                    ...card,
                    processDetails: JSON.parse(card.processDetails || '[]')
                };
            } catch (e) {
                console.error(`Error parsing processDetails for job card ID ${card.id}:`, e);
                return {
                    ...card,
                    processDetails: [] // Default to empty array on error
                };
            }
        });
        res.json({
            "message": "success",
            "data": jobCards
        });
    });
});

app.post('/api/jobcards', (req, res) => {
    const {
        customerName, quotationNumber, productName, jobName, poNumber,
        imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
        cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
        paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
        processDetails,
        coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
        coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy
    } = req.body;

    db.get("SELECT MAX(id) as maxId FROM job_cards", [], (err, row) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        
        const nextId = (row.maxId || 0) + 1;
        const jobCardNum = `JC${String(nextId).padStart(4, '0')}`;
        
        const columns = [
            'jobCardNum', 'customerName', 'quotationNumber', 'productName', 'jobName', 'poNumber',
            'imageAttached', 'imageData', 'billingType', 'sampleAttached', 'paperLength', 'paperWidth',
            'cutSize', 'ups', 'qtyFullSheet', 'qtyCutSheet', 'paperGsm', 'paperType',
            'paperBy', 'jobColor', 'plateBy', 'jobType', 'priority', 'repeatNo', 'requestPlate',
            'processDetails', 'coverPaperLength', 'coverPaperWidth', 'coverCutSize', 'coverUps',
            'coverQtyFullSheet', 'coverQtyCutSheet', 'coverPaperGsm', 'coverPaperType', 'coverPaperBy'
        ];
        
        const values = [
            jobCardNum, customerName, quotationNumber, productName, jobName, poNumber,
            imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
            cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
            paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
            JSON.stringify(processDetails || []),
            coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
            coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy
        ];

        const placeholders = columns.map(() => '?').join(', ');

        db.run(`INSERT INTO job_cards (${columns.join(', ')}) VALUES (${placeholders})`,
            values,
            function(err) {
                if (err) {
                    res.status(400).json({ "error": err.message });
                    return;
                }
                
                // Mark quotation as used if quotationNumber is provided
                if (quotationNumber) {
                    db.run(`UPDATE quotations SET usedForJobCard = 1 WHERE serial = ?`, 
                        [quotationNumber], 
                        function(updateErr) {
                            if (updateErr) {
                                console.error('Error marking quotation as used:', updateErr.message);
                            } else {
                                console.log(`Quotation #${quotationNumber} marked as used for job card`);
                            }
                        }
                    );
                }
                
                res.json({
                    "message": "success",
                    "data": { id: this.lastID, jobCardNum, ...req.body }
                });
            }
        );
    });
});

app.put('/api/jobcards/:id', (req, res) => {
    const { id } = req.params;
    const {
        customerName, quotationNumber, productName, jobName, poNumber,
        imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
        cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
        paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
        processDetails,
        coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
        coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy
    } = req.body;

    const fields = {
        customerName, quotationNumber, productName, jobName, poNumber,
        imageAttached, imageData, billingType, sampleAttached, paperLength, paperWidth,
        cutSize, ups, qtyFullSheet, qtyCutSheet, paperGsm, paperType,
        paperBy, jobColor, plateBy, jobType, priority, repeatNo, requestPlate,
        processDetails: JSON.stringify(processDetails || []),
        coverPaperLength, coverPaperWidth, coverCutSize, coverUps,
        coverQtyFullSheet, coverQtyCutSheet, coverPaperGsm, coverPaperType, coverPaperBy
    };

    const setClauses = Object.keys(fields).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(fields), id];

    db.run(`UPDATE job_cards SET ${setClauses} WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                res.status(400).json({ "error": err.message });
                return;
            }
            if (this.changes === 0) {
                return res.status(404).json({ "error": `Job card with ID ${id} not found` });
            }
            res.json({
                "message": "success",
                "data": { id, ...req.body },
                "changes": this.changes
            });
        }
    );
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'frontend/build')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});
// #endregion


// #region Database Initialization and Server Start
const db = new sqlite3.Database('./quotations.db', (err) => {
    if (err) {
        console.error('FATAL: Database connection error:', err.message);
        process.exit(1);
    }
    console.log('Connected to the quotations database.');
    initializeDatabaseAndStartServer();
});

function initializeDatabaseAndStartServer() {
    db.serialize(() => {
        // Queue all table creation commands. They will run in order.
        db.run(`CREATE TABLE IF NOT EXISTS quotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productType TEXT,
            serial INTEGER UNIQUE,
            data TEXT,
            customerName TEXT,
            usedForJobCard INTEGER DEFAULT 0
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            customerCompanyName TEXT,
            address TEXT,
            email TEXT,
            mobileNumber TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS paper_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paperTypeName TEXT UNIQUE,
            ratePerKg REAL,
            minGsm INTEGER,
            maxGsm INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS job_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jobCardNum TEXT UNIQUE,
            customerName TEXT,
            quotationNumber TEXT,
            productName TEXT,
            jobName TEXT,
            poNumber TEXT,
            imageAttached TEXT,
            imageData TEXT,
            billingType TEXT,
            sampleAttached TEXT,
            paperLength REAL,
            paperWidth REAL,
            cutSize TEXT,
            ups INTEGER,
            qtyFullSheet INTEGER,
            qtyCutSheet INTEGER,
            paperGsm INTEGER,
            paperType TEXT,
            paperBy TEXT,
            jobColor TEXT,
            plateBy TEXT,
            jobType TEXT,
            priority TEXT,
            repeatNo INTEGER,
            requestPlate TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // After the CREATE TABLE commands are queued, run the schema migration.
        runMigrations(() => {
            // This callback is executed only after all migrations are complete.
            // Now it's safe to start the server.
            app.listen(port, '0.0.0.0', () => {
                console.log(`Server running on http://0.0.0.0:${port}`);
            });
        });
    });
}

function runMigrations(finalCallback) {
    // First, check and migrate job_cards table
    db.all("PRAGMA table_info(job_cards)", (err, columns) => {
        if (err) {
            console.error("MIGRATION ERROR: Could not read job_cards table info:", err.message);
            return;
        }
        
        const existingColumns = columns.map(col => col.name);
        const requiredColumns = {
            'processDetails': 'TEXT',
            'imageData': 'TEXT',
            'coverPaperLength': 'REAL',
            'coverPaperWidth': 'REAL',
            'coverCutSize': 'TEXT',
            'coverUps': 'INTEGER',
            'coverQtyFullSheet': 'INTEGER',
            'coverQtyCutSheet': 'INTEGER',
            'coverPaperGsm': 'INTEGER',
            'coverPaperType': 'TEXT',
            'coverPaperBy': 'TEXT'
        };

        const columnsToAdd = Object.entries(requiredColumns).filter(
            ([name]) => !existingColumns.includes(name)
        );

        let jobCardMigrationsCompleted = 0;
        const totalJobCardMigrations = columnsToAdd.length;
        
        const checkQuotationsMigration = () => {
            // Now check and migrate quotations table
            db.all("PRAGMA table_info(quotations)", (quotErr, quotColumns) => {
                if (quotErr) {
                    console.error("MIGRATION ERROR: Could not read quotations table info:", quotErr.message);
                    return finalCallback();
                }
                
                const quotExistingColumns = quotColumns.map(col => col.name);
                const needsUsedForJobCard = !quotExistingColumns.includes('usedForJobCard');
                
                if (needsUsedForJobCard) {
                    console.log("Adding usedForJobCard column to quotations table...");
                    db.run(`ALTER TABLE quotations ADD COLUMN usedForJobCard INTEGER DEFAULT 0`, (quotAlterErr) => {
                        if (quotAlterErr) {
                            console.error('Error adding usedForJobCard column:', quotAlterErr.message);
                        } else {
                            console.log('Successfully added usedForJobCard column to quotations table.');
                        }
                        finalCallback();
                    });
                } else {
                    console.log("Quotations table schema is up to date.");
                    finalCallback();
                }
            });
        };
        
        if (totalJobCardMigrations === 0) {
            console.log("Job cards table schema is up to date.");
            checkQuotationsMigration();
            return;
        }

        console.log("Job cards table schema is outdated. Applying migrations...");
        
        // Use a new serialize block to ensure ALTER commands run one after another.
        db.serialize(() => {
            columnsToAdd.forEach(([colName, colType]) => {
                const sql = `ALTER TABLE job_cards ADD COLUMN ${colName} ${colType}`;
                db.run(sql, (alterErr) => {
                    if (alterErr) {
                        // Log the error but don't stop the whole process
                        console.error(`Error adding column '${colName}':`, alterErr.message);
                    } else {
                        console.log(`Successfully added column '${colName}'.`);
                    }
                    
                    jobCardMigrationsCompleted++;
                    if (jobCardMigrationsCompleted === totalJobCardMigrations) {
                        console.log("All job cards schema migrations applied.");
                        checkQuotationsMigration();
                    }
                });
            });
        });
    });
}
// #endregion