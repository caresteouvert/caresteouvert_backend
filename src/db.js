/**
 * This file manages communication with PostgreSQL database
 */

const { Pool } = require('pg');

// Create pool of connections
let pool = new Pool({ connectionString: process.env.DATABASE_URL });

exports.addContribution = (osmid, name, status, opening_hours, details, lon, lat) => {
	return pool.query(
		"INSERT INTO contributions (osmid, name, status, opening_hours, details, geom) VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_Point($6, $7), 4326))",
		[ osmid, name, status, opening_hours, details, lon, lat ]
	);
};

exports.getContributionsForUpload = () => {
	return pool.query("SELECT id, osmid, status, opening_hours, details FROM contributions WHERE NOT sent_to_osm AND details IS NULL AND status IN ('open', 'closed') LIMIT 100")
	.then(result => (result && result.rows && result.rows.length > 0) ? result.rows : []);
};

exports.getContributionsForNotes = () => {
	return pool.query("SELECT id, osmid, name, status, details, ST_X(geom) AS lon, ST_Y(geom) AS lat FROM contributions WHERE NOT sent_to_osm AND details IS NOT NULL AND status IN ('open', 'closed') LIMIT 100")
	.then(result => (result && result.rows && result.rows.length > 0) ? result.rows : []);
};

exports.setContributionsSent = (contribIds) => {
	return pool.query("UPDATE contributions SET sent_to_osm = true WHERE id = ANY($1)", [ contribIds ]);
};
