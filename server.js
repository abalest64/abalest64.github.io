const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || __dirname;

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DATA_FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    contacts: path.join(DATA_DIR, 'contacts.json'),
    availabilities: path.join(DATA_DIR, 'availability.json'),
    appointments: path.join(DATA_DIR, 'appointments.json'),
    arsenals: path.join(DATA_DIR, 'arsenals.json'),
    games: path.join(DATA_DIR, 'games.json'),
    playerStats: path.join(DATA_DIR, 'player_stats.json'),
    tournamentStats: path.join(DATA_DIR, 'tournament_stats.json')
};

const sessions = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
});
app.use(express.static(__dirname));

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function randomId(prefix = 'id') {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function seedData() {
    const defaults = {
        users: [
            {
                id: 'user_coach_olivia',
                name: 'Olivia Farwell',
                email: 'o.l.farwell@msmary.edu',
                role: 'coach',
                passwordHash: hashPassword('Coach123!'),
                createdAt: new Date().toISOString()
            },
            {
                id: 'user_player_alyssa',
                name: 'Alyssa Balest',
                email: 'a.r.balest@email.msmary.edu',
                role: 'player',
                passwordHash: hashPassword('Bowling123!'),
                createdAt: new Date().toISOString()
            }
        ],
        contacts: [
            {
                id: randomId('contact'),
                name: 'Alyssa Balest',
                role: 'Player',
                email: 'a.r.balest@email.msmary.edu',
                phone: '555-0123',
                emergencyContact: 'Parent - 555-0101'
            },
            {
                id: randomId('contact'),
                name: 'Olivia Farwell',
                role: 'Head Coach',
                email: 'o.l.farwell@msmary.edu',
                phone: '555-9876',
                emergencyContact: 'Athletics Office - 555-1000'
            },
            {
                id: randomId('contact'),
                name: 'Sierra Calo',
                role: 'Player',
                email: 's.calo@email.msmary.edu',
                phone: '555-4444',
                emergencyContact: 'Family - 555-0777'
            }
        ],
        availabilities: [
            {
                id: randomId('slot'),
                coachEmail: 'o.l.farwell@msmary.edu',
                title: 'Weekly Check-In',
                start: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
                durationMinutes: 30,
                notes: 'Open office hours for lineup, goals, and performance review.'
            }
        ],
        appointments: [],
        arsenals: [
            {
                id: randomId('ball'),
                ownerEmail: 'a.r.balest@email.msmary.edu',
                name: 'Storm IQ Tour',
                weight: '15lb',
                notes: 'Solid benchmark piece'
            }
        ],
        games: [],
        playerStats: [
            {
                player_email: 'a.r.balest@email.msmary.edu',
                season_avg: 193,
                strike_pct: 52,
                spare_pct: 71,
                single_pin_pct: 84,
                split_pct: 22,
                fill_pct: 79
            }
        ],
        tournamentStats: [
            {
                player_email: 'a.r.balest@email.msmary.edu',
                tournament_name: 'Kickoff Classic',
                avg_score: 186
            },
            {
                player_email: 'a.r.balest@email.msmary.edu',
                tournament_name: 'Midseason Open',
                avg_score: 194
            },
            {
                player_email: 'a.r.balest@email.msmary.edu',
                tournament_name: 'Conference Tune-Up',
                avg_score: 201
            },
            {
                player_email: 'a.r.balest@email.msmary.edu',
                tournament_name: 'Invitational',
                avg_score: 197
            }
        ]
    };

    Object.entries(DATA_FILES).forEach(([key, file]) => {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(defaults[key], null, 2), 'utf8');
        }
    });
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function csvValue(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function findUserByEmail(email) {
    return readJson(DATA_FILES.users).find((user) => user.email === email) || null;
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    return header.split(';').reduce((acc, item) => {
        const [rawKey, ...valueParts] = item.trim().split('=');
        if (!rawKey) return acc;
        acc[rawKey] = decodeURIComponent(valueParts.join('='));
        return acc;
    }, {});
}

function getUserFromSession(req) {
    const cookies = parseCookies(req);
    const sessionId = cookies.sessionId;
    if (!sessionId || !sessions.has(sessionId)) return null;
    return sessions.get(sessionId);
}

function requireAuth(req, res, next) {
    const user = getUserFromSession(req);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    req.user = user;
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'You do not have access to this action.' });
        }
        next();
    };
}

function getUsers() {
    return readJson(DATA_FILES.users);
}

function sanitizeUser(user) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
}

function calculateGameSummary(rolls = []) {
    let strikes = 0;
    let spares = 0;
    let opens = 0;
    let firstBallTotal = 0;
    let firstBallCount = 0;
    let index = 0;

    for (let frame = 1; frame <= 10; frame++) {
        const first = rolls[index] || 0;
        const second = rolls[index + 1] || 0;
        firstBallTotal += first;
        firstBallCount += 1;

        if (frame < 10) {
            if (first === 10) {
                strikes += 1;
                index += 1;
                continue;
            }
            if (first + second === 10) spares += 1;
            else opens += 1;
            index += 2;
        } else {
            if (first === 10) strikes += 1;
            else if (first + second === 10) spares += 1;
            else opens += 1;
        }
    }

    return {
        strikes,
        spares,
        opens,
        strikeRate: Math.round((strikes / 10) * 100),
        spareRate: Math.round((spares / Math.max(spares + opens, 1)) * 100),
        firstBallAverage: Number((firstBallTotal / Math.max(firstBallCount, 1)).toFixed(1))
    };
}

function getPlayerGames(email) {
    return readJson(DATA_FILES.games).filter((game) => game.ownerEmail === email);
}

function deriveStatsFromGames(email) {
    const games = getPlayerGames(email);
    if (!games.length) {
        return {
            season_avg: 193,
            strike_pct: 52,
            spare_pct: 71,
            single_pin_pct: 84,
            split_pct: 22,
            fill_pct: 79,
            opens: 3,
            series_total: 579
        };
    }

    const totalScore = games.reduce((sum, game) => sum + Number(game.score || 0), 0);
    const totalSummaries = games.map((game) => game.summary || calculateGameSummary(game.rolls || []));
    const strikes = totalSummaries.reduce((sum, item) => sum + item.strikes, 0);
    const spares = totalSummaries.reduce((sum, item) => sum + item.spares, 0);
    const opens = totalSummaries.reduce((sum, item) => sum + item.opens, 0);
    const gamesCount = games.length;

    return {
        season_avg: Math.round(totalScore / gamesCount),
        strike_pct: Math.round((strikes / Math.max(gamesCount * 10, 1)) * 100),
        spare_pct: Math.round((spares / Math.max(spares + opens, 1)) * 100),
        single_pin_pct: Math.min(95, 68 + gamesCount * 3),
        split_pct: Math.max(10, 28 - gamesCount),
        fill_pct: Math.round(((strikes + spares) / Math.max(gamesCount * 10, 1)) * 100),
        opens,
        series_total: totalScore
    };
}

function deriveTrendFromGames(email) {
    const games = getPlayerGames(email);
    if (!games.length) {
        return [
            { tournament_name: 'Kickoff Classic', avg_score: 186 },
            { tournament_name: 'Midseason Open', avg_score: 194 },
            { tournament_name: 'Conference Tune-Up', avg_score: 201 },
            { tournament_name: 'Invitational', avg_score: 197 }
        ];
    }

    return games.slice(-5).map((game, index) => ({
        tournament_name: game.label || `Game ${index + 1}`,
        avg_score: Number(game.score || 0)
    }));
}

seedData();

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/user-profile', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/statistics', (req, res) => res.sendFile(path.join(__dirname, 'stats.html')));
app.get('/scheduling', (req, res) => res.sendFile(path.join(__dirname, 'scheduling.html')));
app.get('/arsenal', (req, res) => res.sendFile(path.join(__dirname, 'arsenal.html')));
app.get('/contacts', (req, res) => res.sendFile(path.join(__dirname, 'contacts.html')));
app.get('/logging', (req, res) => res.sendFile(path.join(__dirname, 'logging.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin_dashboard.html')));

app.post('/register', (req, res) => {
    const users = getUsers();
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const studentId = String(req.body.studentId || '').trim();
    const usbcId = String(req.body.usbcId || '').trim();
    const password = String(req.body.password || '');

    if (!name || !email || !studentId || !usbcId || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, student ID, USBC ID, and password are required.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (users.some((user) => user.email === email)) {
        return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    }

    const user = {
        id: randomId('user'),
        name,
        email,
        studentId,
        usbcId,
        role: 'player',
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
    };
    users.push(user);
    writeJson(DATA_FILES.users, users);
    return res.json({ success: true, user: sanitizeUser(user) });
});

app.post('/login', (req, res) => {
    const users = getUsers();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = users.find((entry) => entry.email === email);

    if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const sessionId = randomId('session');
    sessions.set(sessionId, sanitizeUser(user));
    res.setHeader('Set-Cookie', `sessionId=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax`);
    return res.json({ success: true, user: sanitizeUser(user) });
});

app.post('/demo-coach-login', (req, res) => {
    const users = getUsers();
    const user = users.find((entry) => entry.email === 'o.l.farwell@msmary.edu');
    if (!user) {
        return res.status(404).json({ success: false, message: 'Coach account not found.' });
    }

    const sessionId = randomId('session');
    sessions.set(sessionId, sanitizeUser(user));
    res.setHeader('Set-Cookie', `sessionId=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax`);
    return res.json({ success: true, user: sanitizeUser(user) });
});

app.post('/logout', (req, res) => {
    const cookies = parseCookies(req);
    if (cookies.sessionId) sessions.delete(cookies.sessionId);
    res.setHeader('Set-Cookie', 'sessionId=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
    res.json({ success: true, user: req.user });
});

app.get('/api/users', requireAuth, requireRole('coach'), (req, res) => {
    res.json({ success: true, users: getUsers().map(sanitizeUser) });
});

app.post('/api/users', requireAuth, requireRole('coach'), (req, res) => {
    const users = getUsers();
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const studentId = String(req.body.studentId || '').trim();
    const usbcId = String(req.body.usbcId || '').trim();
    const password = String(req.body.password || '');
    const role = req.body.role === 'coach' ? 'coach' : 'player';

    if (!name || !email || !studentId || !usbcId || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, student ID, USBC ID, and password are required.' });
    }
    if (users.some((user) => user.email === email)) {
        return res.status(409).json({ success: false, message: 'That email is already in use.' });
    }

    const user = {
        id: randomId('user'),
        name,
        email,
        studentId,
        usbcId,
        role,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
    };
    users.push(user);
    writeJson(DATA_FILES.users, users);
    res.json({ success: true, user: sanitizeUser(user) });
});

app.patch('/api/users/:id', requireAuth, requireRole('coach'), (req, res) => {
    const users = getUsers();
    const index = users.findIndex((user) => user.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: 'User not found.' });

    if (req.body.role) users[index].role = req.body.role === 'coach' ? 'coach' : 'player';
    if (req.body.password) users[index].passwordHash = hashPassword(String(req.body.password));
    writeJson(DATA_FILES.users, users);
    res.json({ success: true, user: sanitizeUser(users[index]) });
});

app.delete('/api/users/:id', requireAuth, requireRole('coach'), (req, res) => {
    const users = getUsers();
    const user = users.find((entry) => entry.id === req.params.id);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.role === 'coach') {
        return res.status(403).json({ success: false, message: 'Coach accounts cannot be removed here.' });
    }

    writeJson(DATA_FILES.users, users.filter((entry) => entry.id !== req.params.id));
    writeJson(DATA_FILES.contacts, readJson(DATA_FILES.contacts).filter((entry) => entry.email !== user.email));
    writeJson(DATA_FILES.arsenals, readJson(DATA_FILES.arsenals).filter((entry) => entry.ownerEmail !== user.email));
    writeJson(DATA_FILES.games, readJson(DATA_FILES.games).filter((entry) => entry.ownerEmail !== user.email));
    writeJson(DATA_FILES.playerStats, readJson(DATA_FILES.playerStats).filter((entry) => entry.player_email !== user.email));
    writeJson(DATA_FILES.tournamentStats, readJson(DATA_FILES.tournamentStats).filter((entry) => entry.player_email !== user.email));
    writeJson(DATA_FILES.appointments, readJson(DATA_FILES.appointments).filter((entry) => entry.playerEmail !== user.email));

    res.json({ success: true });
});

app.get('/api/contacts', requireAuth, (req, res) => {
    res.json({ success: true, contacts: readJson(DATA_FILES.contacts) });
});

app.post('/api/contacts', requireAuth, requireRole('coach'), (req, res) => {
    const contacts = readJson(DATA_FILES.contacts);
    const contact = {
        id: randomId('contact'),
        name: String(req.body.name || '').trim(),
        role: String(req.body.role || '').trim(),
        email: String(req.body.email || '').trim(),
        phone: String(req.body.phone || '').trim(),
        studentId: String(req.body.studentId || '').trim(),
        usbcId: String(req.body.usbcId || '').trim(),
        emergencyContact: String(req.body.emergencyContact || '').trim()
    };
    contacts.push(contact);
    writeJson(DATA_FILES.contacts, contacts);
    res.json({ success: true, contact });
});

app.delete('/api/contacts/:id', requireAuth, requireRole('coach'), (req, res) => {
    const contacts = readJson(DATA_FILES.contacts);
    const contact = contacts.find((entry) => entry.id === req.params.id);
    if (!contact) {
        return res.status(404).json({ success: false, message: 'Contact not found.' });
    }
    if (String(contact.role || '').toLowerCase().includes('coach')) {
        return res.status(403).json({ success: false, message: 'Coach entries cannot be removed here.' });
    }
    writeJson(DATA_FILES.contacts, contacts.filter((entry) => entry.id !== req.params.id));
    res.json({ success: true });
});

app.get('/api/arsenal', requireAuth, (req, res) => {
    const requestedEmail = String(req.query.email || req.user.email).trim().toLowerCase();
    const ownerEmail = req.user.role === 'coach' ? requestedEmail : req.user.email;
    const arsenal = readJson(DATA_FILES.arsenals).filter((item) => item.ownerEmail === ownerEmail);
    res.json({ success: true, arsenal, ownerEmail });
});

app.post('/api/arsenal', requireAuth, (req, res) => {
    const arsenals = readJson(DATA_FILES.arsenals);
    const ownerEmail = req.user.role === 'coach' && req.body.ownerEmail ? String(req.body.ownerEmail).trim().toLowerCase() : req.user.email;
    const item = {
        id: randomId('ball'),
        ownerEmail,
        name: String(req.body.name || '').trim(),
        serialNumber: String(req.body.serialNumber || '').trim(),
        weight: String(req.body.weight || '').trim(),
        notes: String(req.body.notes || '').trim()
    };
    arsenals.push(item);
    writeJson(DATA_FILES.arsenals, arsenals);
    res.json({ success: true, item });
});

app.delete('/api/arsenal/:id', requireAuth, (req, res) => {
    const arsenals = readJson(DATA_FILES.arsenals);
    const item = arsenals.find((entry) => entry.id === req.params.id);
    if (!item) {
        return res.status(404).json({ success: false, message: 'Arsenal item not found.' });
    }
    if (req.user.role !== 'coach' && item.ownerEmail !== req.user.email) {
        return res.status(403).json({ success: false, message: 'Not allowed to remove this item.' });
    }
    const remaining = arsenals.filter((entry) => entry.id !== req.params.id);
    writeJson(DATA_FILES.arsenals, remaining);
    res.json({ success: true });
});

app.get('/api/availability', requireAuth, (req, res) => {
    res.json({ success: true, slots: readJson(DATA_FILES.availabilities) });
});

app.post('/api/availability', requireAuth, requireRole('coach'), (req, res) => {
    const slots = readJson(DATA_FILES.availabilities);
    const slot = {
        id: randomId('slot'),
        coachEmail: req.user.email,
        title: String(req.body.title || '').trim(),
        start: new Date(req.body.start).toISOString(),
        durationMinutes: Number(req.body.durationMinutes || 30),
        notes: String(req.body.notes || '').trim()
    };
    slots.push(slot);
    writeJson(DATA_FILES.availabilities, slots);
    res.json({ success: true, slot });
});

app.delete('/api/availability/:id', requireAuth, requireRole('coach'), (req, res) => {
    const slots = readJson(DATA_FILES.availabilities);
    const slot = slots.find((entry) => entry.id === req.params.id);
    if (!slot) {
        return res.status(404).json({ success: false, message: 'Meeting time not found.' });
    }
    if (slot.coachEmail !== req.user.email) {
        return res.status(403).json({ success: false, message: 'You can only remove your own meeting times.' });
    }

    writeJson(DATA_FILES.availabilities, slots.filter((entry) => entry.id !== req.params.id));
    writeJson(DATA_FILES.appointments, readJson(DATA_FILES.appointments).filter((entry) => entry.slotId !== req.params.id));
    res.json({ success: true });
});

app.get('/api/appointments', requireAuth, (req, res) => {
    const appointments = readJson(DATA_FILES.appointments).filter((appointment) => req.user.role === 'coach'
        ? appointment.coachEmail === req.user.email || appointment.playerEmail === req.user.email
        : appointment.playerEmail === req.user.email);
    res.json({ success: true, appointments });
});

app.post('/api/appointments', requireAuth, (req, res) => {
    const slots = readJson(DATA_FILES.availabilities);
    const appointments = readJson(DATA_FILES.appointments);
    const slot = slots.find((item) => item.id === req.body.slotId);
    if (!slot) return res.status(404).json({ success: false, message: 'Time slot not found.' });

    const appointment = {
        id: randomId('appt'),
        slotId: slot.id,
        title: slot.title,
        coachEmail: slot.coachEmail,
        playerEmail: req.user.email,
        start: slot.start,
        durationMinutes: slot.durationMinutes,
        notes: String(req.body.notes || '').trim(),
        status: 'Requested'
    };
    appointments.push(appointment);
    writeJson(DATA_FILES.appointments, appointments);
    res.json({ success: true, appointment });
});

app.patch('/api/appointments/:id', requireAuth, requireRole('coach'), (req, res) => {
    const appointments = readJson(DATA_FILES.appointments);
    const index = appointments.findIndex((appointment) => appointment.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    appointments[index].status = String(req.body.status || 'Confirmed');
    writeJson(DATA_FILES.appointments, appointments);
    res.json({ success: true, appointment: appointments[index] });
});

app.delete('/api/appointments/:id', requireAuth, (req, res) => {
    const appointments = readJson(DATA_FILES.appointments);
    const appointment = appointments.find((entry) => entry.id === req.params.id);
    if (!appointment) {
        return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    const canCancel = req.user.role === 'coach'
        ? appointment.coachEmail === req.user.email
        : appointment.playerEmail === req.user.email;
    if (!canCancel) {
        return res.status(403).json({ success: false, message: 'You cannot cancel this appointment.' });
    }
    writeJson(DATA_FILES.appointments, appointments.filter((entry) => entry.id !== req.params.id));
    res.json({ success: true });
});

app.get('/get-stats', requireAuth, (req, res) => {
    const email = String(req.query.email || req.user.email).trim().toLowerCase();
    const tableStats = readJson(DATA_FILES.playerStats).find((row) => row.player_email === email);
    if (!tableStats) {
        return res.json(deriveStatsFromGames(email));
    }
    const derived = deriveStatsFromGames(email);
    return res.json({
        season_avg: tableStats.season_avg || derived.season_avg,
        strike_pct: tableStats.strike_pct || derived.strike_pct,
        spare_pct: tableStats.spare_pct || derived.spare_pct,
        single_pin_pct: tableStats.single_pin_pct || derived.single_pin_pct,
        split_pct: tableStats.split_pct || derived.split_pct,
        fill_pct: tableStats.fill_pct || derived.fill_pct,
        opens: derived.opens,
        series_total: derived.series_total
    });
});

app.get('/api/trend', requireAuth, (req, res) => {
    const email = String(req.query.email || req.user.email).trim().toLowerCase();
    const trendRows = readJson(DATA_FILES.tournamentStats).filter((row) => row.player_email === email);
    if (!trendRows.length) {
        return res.json(deriveTrendFromGames(email));
    }
    return res.json(trendRows);
});

app.get('/api/stats/export', requireAuth, (req, res) => {
    const email = String(req.query.email || req.user.email).trim().toLowerCase();
    const user = findUserByEmail(email);
    const stats = { ...deriveStatsFromGames(email), ...readJson(DATA_FILES.playerStats).find((row) => row.player_email === email) };
    const trends = readJson(DATA_FILES.tournamentStats).filter((row) => row.player_email === email);
    const reportDate = new Date().toLocaleString();
    const csv = [
        [csvValue('PinPoint Bowling Statistics Report')],
        [csvValue('Player'), csvValue(user?.name || email)],
        [csvValue('Email'), csvValue(email)],
        [csvValue('Generated'), csvValue(reportDate)],
        [],
        [csvValue('Summary Metrics')],
        [csvValue('Metric'), csvValue('Value')],
        [csvValue('Season Average'), csvValue(stats.season_avg)],
        [csvValue('Strike Percentage'), csvValue(`${stats.strike_pct}%`)],
        [csvValue('Spare Percentage'), csvValue(`${stats.spare_pct}%`)],
        [csvValue('Single-Pin Percentage'), csvValue(`${stats.single_pin_pct}%`)],
        [csvValue('Split Conversion Percentage'), csvValue(`${stats.split_pct}%`)],
        [csvValue('Fill Percentage'), csvValue(`${stats.fill_pct}%`)],
        [csvValue('Opens'), csvValue(stats.opens)],
        [csvValue('Series Total'), csvValue(stats.series_total)],
        [],
        [csvValue('Tournament Trend')],
        [csvValue('Tournament'), csvValue('Average Score')]
    ]
        .concat(trends.map((row) => [csvValue(row.tournament_name), csvValue(row.avg_score)]))
        .map((row) => row.join(','))
        .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="stats-report-${email}.csv"`);
    res.send(csv);
});

app.get('/run-scrape', requireAuth, (req, res) => {
    const email = String(req.query.email || req.user.email).trim().toLowerCase();
    try {
        const raw = execFileSync('Rscript', [path.join(__dirname, 'scraper.R'), email], {
            cwd: __dirname,
            encoding: 'utf8'
        });
        const imported = JSON.parse(raw);
        if (!imported.success) {
            return res.status(400).json({ success: false, message: imported.message || 'Import failed.' });
        }

        const statsRows = readJson(DATA_FILES.playerStats).filter((row) => row.player_email !== email);
        const trendRows = readJson(DATA_FILES.tournamentStats).filter((row) => row.player_email !== email);
        statsRows.push(imported.stats);
        writeJson(DATA_FILES.playerStats, statsRows);
        writeJson(DATA_FILES.tournamentStats, [...trendRows, ...imported.trends]);
        return res.json({ success: true, message: 'Official stats imported successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'The R scraper could not import official stats.' });
    }
});

app.get('/api/games', requireAuth, (req, res) => {
    const email = String(req.query.email || req.user.email).trim().toLowerCase();
    const ownerEmail = req.user.role === 'coach' ? email : req.user.email;
    res.json({ success: true, games: getPlayerGames(ownerEmail) });
});

app.post('/api/games', requireAuth, (req, res) => {
    const games = readJson(DATA_FILES.games);
    const score = Number(req.body.score || 0);
    const rolls = Array.isArray(req.body.rolls) ? req.body.rolls : [];
    const summary = calculateGameSummary(rolls);
    const game = {
        id: randomId('game'),
        ownerEmail: req.user.email,
        label: req.body.label || `Game ${getPlayerGames(req.user.email).length + 1}`,
        date: req.body.date || new Date().toLocaleDateString(),
        score,
        clean: Number(req.body.clean || 0),
        rolls,
        summary,
        createdAt: new Date().toISOString()
    };
    games.push(game);
    writeJson(DATA_FILES.games, games);
    res.json({ success: true, game });
});

app.delete('/api/games', requireAuth, (req, res) => {
    const remaining = readJson(DATA_FILES.games).filter((game) => game.ownerEmail !== req.user.email);
    writeJson(DATA_FILES.games, remaining);
    res.json({ success: true });
});

app.get('/health', (req, res) => {
    res.json({ success: true, status: 'ok' });
});

app.listen(PORT, HOST, () => console.log(`SERVER READY - http://${HOST}:${PORT}`));
