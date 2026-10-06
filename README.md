# Two people, one movie seat: a race condition demo

My friend and I tried to book the last movie seat at almost the same time. I got it, he didn't. I built this small demo to understand what happens behind the screen.

**Stack:** Node.js, Express, PostgreSQL, plain HTML/CSS/JS

## What the demo shows

Seat A10 is the last seat. "You" tap Book first, and your "friend" taps 0.7 seconds later. The page shows each person's journey step by step: tap, database check, pay and reserve, result.

### Scenario 1: what happens without a lock
The server checks the seat, waits, then books it. These are two separate steps, so both requests see the seat as free. Both people get a ticket for one seat, and the second booking overwrites the first.

### Scenario 2: why it happens due to the lock
The booking runs inside a transaction with `SELECT ... FOR UPDATE`, which locks the seat row. The first request goes ahead and the second waits. When it finally checks, the seat is already taken, so only one ticket is sold.

> A 2-second delay is added on purpose to make the gap visible. Real systems are much faster, but the gap still exists.

## What I learned

- Checking a seat and booking it are two separate steps. In the gap between them, two users can both pass the check.
- An `if` in the code can't fix this, because it can't see the other request.
- Only the database sees every request, so it has to decide who goes first.
- The same problem appears with stock, tickets, wallet balances and coupon codes.

## Run it locally

1. Install Node.js 18 or newer and PostgreSQL.
2. Install the packages:
```
   npm install
```
3. Copy `.env.example` to `.env` and put your PostgreSQL password in it.
4. Create the database and the table:
```
   psql -U postgres -c "CREATE DATABASE seatdemo;"
   psql -U postgres -d seatdemo -f schema.sql
```
5. Start the server:
```
   node server.js
```
6. Open http://localhost:3000 and press **Start**. Switch between Scenario 1 and Scenario 2 at the top.

## Files

| File | Purpose |
|---|---|
| `schema.sql` | Creates the `seats` table with one seat, A10 |
| `db.js` | PostgreSQL connection |
| `server.js` | Express routes: `/seat`, `/reset`, `/book-buggy`, `/book-fixed`, `/events` |
| `public/index.html` | The demo page |
| `race-test.js` | Optional terminal version: `node race-test.js buggy` or `node race-test.js fixed` |

## Other ways to solve the same problem

Row locking is the easiest one to see in a demo, but not the only one: an atomic `UPDATE ... WHERE status = 'AVAILABLE'`, a unique constraint, or optimistic locking with a version number.
