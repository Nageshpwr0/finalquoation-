const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database');

const quotationsRouter = require('./routes/quotations');
const customersRouter = require('./routes/customers');
const papertypesRouter = require('./routes/papertypes');
const laminationsRouter = require('./routes/laminations');
const jobcardsRouter = require('./routes/jobcards');

const app = express();
const port = process.env.PORT || 4001;
const host = 'localhost';

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Middleware to allow PUT method
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Serve the static files from the React app
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Initialize the database
initDb();

// API routes
app.use('/api/quotations', quotationsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/papertypes', papertypesRouter);
app.use('/api/laminations', laminationsRouter);
app.use('/api/jobcards', jobcardsRouter);

// All other GET requests not handled before will return our React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
});
