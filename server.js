const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Live event feed: the page reads this to show what is happening right now
let events = [];
let nextId = 1;

function emit(user, step, text, extra = {}) {
  events.push({ id: nextId++, user, step, text, ...extra });
  const time = new Date().toISOString().slice(11, 23);
  console.log(`[${time}] ${user}: ${text}`);
}

app.get('/events', (req, res) => {
  const after = Number(req.query.after || 0);
  res.json(events.filter((e) => e.id > after));
});

app.get('/seat', async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM seats WHERE seat_number = 'A10'"
  );
  res.json(rows[0]);
});

app.post('/reset', async (req, res) => {
  await pool.query(
    "UPDATE seats SET status='AVAILABLE', booked_by=NULL WHERE seat_number='A10'"
  );
  events = [];
  console.log('--- seat reset to AVAILABLE ---');
  res.json({ ok: true });
});

// ❌ WITHOUT PROTECTION: check, wait, then update (two separate steps)
app.post('/book-buggy', async (req, res) => {
  const { user } = req.body;

  emit(user, 'checking', 'Looking at the seat');
  const { rows } = await pool.query(
    "SELECT status FROM seats WHERE seat_number='A10'"
  );
  const seen = rows[0].status;
  emit(user, 'sees', `Sees the seat as ${seen}`, { seen });

  if (seen !== 'AVAILABLE') {
    emit(user, 'failed', 'Seat already taken');
    return res.json({ user, success: false });
  }

  emit(user, 'paying', 'Paying (2 seconds)');
  await sleep(2000); // the gap where the race happens

  await pool.query(
    "UPDATE seats SET status='BOOKED', booked_by=$1 WHERE seat_number='A10'",
    [user]
  );
  emit(user, 'booked', 'Booked seat A10');
  res.json({ user, success: true });
});

// ✅ WITH PROTECTION: transaction + row lock (FOR UPDATE)
app.post('/book-fixed', async (req, res) => {
  const { user } = req.body;
  const client = await pool.connect();

  try {
    emit(user, 'checking', 'Looking at the seat');
    await client.query('BEGIN');
    emit(user, 'locking', 'Asking the database for the seat lock');

    const { rows } = await client.query(
      "SELECT status FROM seats WHERE seat_number='A10' FOR UPDATE"
    );
    const seen = rows[0].status;
    emit(user, 'sees', `Got the lock, sees the seat as ${seen}`, { seen });

    if (seen !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      emit(user, 'failed', 'Seat already taken');
      return res.json({ user, success: false });
    }

    emit(user, 'paying', 'Paying (2 seconds), lock held');
    await sleep(2000);

    await client.query(
      "UPDATE seats SET status='BOOKED', booked_by=$1 WHERE seat_number='A10'",
      [user]
    );
    await client.query('COMMIT');
    emit(user, 'booked', 'Booked seat A10');
    res.json({ user, success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));