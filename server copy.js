const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const mysql = require('mysql2');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Bowling300!',
    database: 'bowling_db'
});

// --- NAVIGATION ROUTES ---

// Home/Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Dashboard
app.get('/user-profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Statistics Page
app.get('/statistics', (req, res) => {
    res.sendFile(path.join(__dirname, 'stats.html'));
});

// Scheduling Page
app.get('/scheduling', (req, res) => {
    res.sendFile(path.join(__dirname, 'scheduling.html'));
});

// NEW: Arsenal Management Page
app.get('/arsenal', (req, res) => {
    res.sendFile(path.join(__dirname, 'arsenal.html'));
});

// NEW: Contact Directory Page
app.get('/contacts', (req, res) => {
    res.sendFile(path.join(__dirname, 'contacts.html'));
});


// --- API & LOGIC ROUTES ---

// Login logic
app.post('/login', (req, res) => {
    const { email } = req.body;
    res.json({ success: true, email: email });
});

// Scraper trigger
app.get('/run-scrape', (req, res) => {
    const email = req.query.email;
    exec(`Rscript scraper.R ${email}`, (err) => {
        res.redirect(`/statistics?email=${email}`);
    });
});

// Fetching player stats for charts/text
app.get('/get-stats', (req, res) => {
    const email = req.query.email;
    const sql = "SELECT * FROM player_stats WHERE player_email = ? LIMIT 1";
    db.query(sql, [email], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: "No stats found" });
        res.json(results[0]);
    });
});

// Fetching trend data for line chart
app.get('/api/trend', (req, res) => {
    const email = req.query.email;
    const sql = "SELECT tournament_name, avg_score FROM tournament_stats WHERE player_email = ?";
    db.query(sql, [email], (err, results) => {
        if (err) return res.json([]);
        res.json(results);
    });
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});