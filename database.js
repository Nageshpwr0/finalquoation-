const sqlite3 = require('sqlite3').verbose();
const { promisifyDb } = require('./db-utils');

let db = new sqlite3.Database('./quotations.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the quotations database.');
    }
});

db = promisifyDb(db);

db.on('error', (err) => {
    console.error('Database error:', err.message);
});

const initDb = async () => {
    await db.run(`CREATE TABLE IF NOT EXISTS quotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productType TEXT,
        serial INTEGER UNIQUE,
        data TEXT,
        customerName TEXT,
        usedForJobCard INTEGER DEFAULT 0,
        cancelled INTEGER DEFAULT 0
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        customerCompanyName TEXT,
        address TEXT,
        email TEXT,
        mobileNumber TEXT,
        margin REAL
    )`);

    // Add margin column to customers table if it doesn't exist
    try {
        await db.run('ALTER TABLE customers ADD COLUMN margin REAL');
    } catch (err) {
        if (!err.message.includes('duplicate column name')) {
            console.error("Error adding 'margin' column to customers table:", err.message);
        }
    }

    await db.run(`CREATE TABLE IF NOT EXISTS paper_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paperTypeName TEXT UNIQUE,
        ratePerKg REAL,
        minGsm INTEGER,
        maxGsm INTEGER
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS lamination_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        laminationName TEXT UNIQUE,
        rate REAL
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS job_cards (
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
        processDetails TEXT,

        coverPaperLength REAL,
        coverPaperWidth REAL,
        coverCutSize TEXT,
        coverUps INTEGER,
        coverQtyFullSheet INTEGER,
        coverQtyCutSheet INTEGER,
        coverPaperGsm INTEGER,
        coverPaperType TEXT,
        coverPaperBy TEXT,
        quotationDetails TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Add quotationDetails column to job_cards table if it doesn't exist, ignoring errors if it's already there.
    console.log("Checking for 'quotationDetails' column in job_cards table...");
    try {
        await db.run('ALTER TABLE job_cards ADD COLUMN quotationDetails TEXT');
        console.log("Successfully added 'quotationDetails' column to job_cards table.");
    } catch (err) {
        if (err.message.toLowerCase().includes('duplicate column name')) {
            console.log("'quotationDetails' column already exists.");
        } else {
            console.error("Error adding 'quotationDetails' column:", err.message);
        }
    }

    // Add cancelled column to quotations table if it doesn't exist
    console.log("Checking for 'cancelled' column in quotations table...");
    try {
        await db.run('ALTER TABLE quotations ADD COLUMN cancelled INTEGER DEFAULT 0');
        console.log("Successfully added 'cancelled' column to quotations table.");
    } catch (err) {
        if (err.message.toLowerCase().includes('duplicate column name')) {
            console.log("'cancelled' column already exists.");
        } else {
            console.error("Error adding 'cancelled' column:", err.message);
        }
    }
};

module.exports = { db, initDb };
