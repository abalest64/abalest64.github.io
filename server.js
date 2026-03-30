const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({ 
    host: 'localhost', user: 'root', password: 'Bowling300!', database: 'bowling_db' 
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/user-profile', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/statistics', (req, res) => res.sendFile(path.join(__dirname, 'stats.html')));
app.get('/scheduling', (req, res) => res.sendFile(path.join(__dirname, 'scheduling.html')));
app.get('/arsenal', (req, res) => res.sendFile(path.join(__dirname, 'arsenal.html')));
app.get('/contacts', (req, res) => res.sendFile(path.join(__dirname, 'contacts.html')));
app.get('/logging', (req, res) => res.sendFile(path.join(__dirname, 'logging.html')));

app.post('/login', (req, res) => res.json({ success: true, email: req.body.email }));

app.get('/get-stats', (req, res) => {
    db.query("SELECT * FROM player_stats WHERE player_email = ? LIMIT 1", [req.query.email], (err, r) => {
        res.json(r ? r[0] : {});
    });
});

app.get('/api/trend', (req, res) => {
    db.query("SELECT tournament_name, avg_score FROM tournament_stats WHERE player_email = ?", [req.query.email], (err, r) => {
        res.json(r || []);
    });
});

app.listen(3000, () => console.log('SERVER READY - http://localhost:3000'));
