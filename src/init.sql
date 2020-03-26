CREATE TABLE contributions(
	id SERIAL PRIMARY KEY,
	ts TIMESTAMP NOT NULL DEFAULT current_timestamp,
	sent_to_osm BOOLEAN NOT NULL DEFAULT false,
	osmid VARCHAR NOT NULL,
	status VARCHAR NOT NULL,
	opening_hours VARCHAR,
	details VARCHAR
);
