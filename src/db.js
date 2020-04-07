/**
 * This file manages communication with PostgreSQL database
 */

const { Pool } = require('pg');

// Create pool of connections
let pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: (process.env.NOSSL == 1 ? undefined : { rejectUnauthorized: false }) });

// Events
pool.on('error', (err, client) => {
	console.error("Database unavailable", err);
});

exports.getCountry = (lon, lat) => {
	return pool.query("WITH u AS (SELECT ST_Transform(ST_SetSRID(ST_Point($1, $2), 4326), 3857) AS geom) SELECT COALESCE(c.sub_country, c.country_iso2) AS country FROM u JOIN countries_subcountries c ON u.geom && c.wkb_geometry AND ST_Intersects(u.geom, c.wkb_geometry)", [ lon, lat ])
	.then(result => {
		if(result.rows.length > 0) {
			return result.rows[0].country;
		}
		else {
			return null;
		}
	});
};

exports.addContribution = (osmid, name, status, opening_hours, details, lon, lat, tags, language) => {
	return pool.query(
		"INSERT INTO contributions (osmid, name, status, opening_hours, details, geom, tags, language) VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_Point($6, $7), 4326), $8, $9)",
		[ osmid, name, status, opening_hours, details, lon, lat, tags, language]
	);
};

exports.getContributionsForUpload = () => {
	return pool.query("SELECT id, osmid, status, opening_hours, tags, language FROM contributions WHERE NOT sent_to_osm AND details IS NULL AND status IN ('open', 'closed') LIMIT 100")
	.then(result => (result && result.rows && result.rows.length > 0) ? result.rows : []);
};

exports.getContributionsForNotes = () => {
	return pool.query("SELECT id, osmid, name, status, opening_hours, details, tags, ST_X(geom) AS lon, ST_Y(geom) AS lat, language FROM contributions WHERE NOT sent_to_osm AND details IS NOT NULL AND status IN ('open', 'closed') LIMIT 100")
	.then(result => (result && result.rows && result.rows.length > 0) ? result.rows : []);
};

exports.setContributionsSent = (contribIds) => {
	return pool.query("UPDATE contributions SET sent_to_osm = true WHERE id = ANY($1)", [ contribIds ]);
};
