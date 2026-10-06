DROP TABLE IF EXISTS seats;

CREATE TABLE seats(

    id        SERIAL PRIMARY KEY,
    seat_number TEXT NOT NULL UNIQUE,
    status      TEXT NOT NULL DEFAULT 'AVAILABLE',
    booked_by   TEXT

);


INSERT INTO seats (seat_number,status) VALUES('A10','AVAILABLE')