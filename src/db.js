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

exports.addContribution = (osmid, name, status, opening_hours, details, lon, lat, tags, croTags, language) => {
	return pool.query(
		"INSERT INTO contributions (osmid, name, status, opening_hours, details, geom, tags, cro_tags, language) VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_Point($6, $7), 4326), $8, $9, $10)",
		[ osmid, name, status, opening_hours, details, lon, lat, tags, croTags, language]
	);
};

exports.addContributionCro = (osmid, name, details, lon, lat, croTags, language) => {
	return pool.query(
		`INSERT INTO contributions (sent_to_osm, osmid, name, status, details, geom, cro_tags, language)
		VALUES (TRUE, $1, $2, 'same', $3, ST_SetSRID(ST_Point($4, $5), 4326), $6, $7)`,
		[ osmid, name, details, lon, lat, croTags, language]
	);
};

exports.saveCroPoi = (osmid, tags) => {
	const fid = osmid.split("/").map((p,i) => i === 0 ? p.substring(0, 1) : p).join("");
	return pool.query(
		"INSERT INTO poi_cro (osmid, tags) VALUES ($1, $2) ON CONFLICT (osmid) DO UPDATE SET tags = poi_cro.tags || EXCLUDED.tags, lastupdate = current_timestamp WHERE poi_cro.osmid = EXCLUDED.osmid",
		[ fid, tags ]
	);
};

exports.getContributionsForUpload = () => {
	return pool.query("SELECT id, osmid, status, opening_hours, details, tags, language, ST_ClusterDBSCAN(geom, eps := 2, minpoints := 1) OVER () AS cluster FROM contributions WHERE NOT sent_to_osm AND status IN ('open', 'closed') LIMIT 1000")
	.then(result => {
		if(!result || !result.rows || result.rows.length === 0) { return []; }
		else {
			const clustered = {};
			result.rows.forEach(row => {
				if(!clustered[row.cluster]) { clustered[row.cluster] = []; }
				clustered[row.cluster].push(row);
			});
			return Object.values(clustered);
		}
	});
};

exports.getContributionsForNotes = () => {
	return pool.query(
`SELECT
	c.id, c.osmid, c.name, c.status, c.opening_hours,
	c.details, c.tags, ST_X(c.geom) AS lon, ST_Y(c.geom) AS lat,
	c.language, sc.country_iso2 AS country
FROM (
	SELECT *, ST_Transform(geom, 3857) AS geom3857
	FROM contributions
	WHERE NOT sent_to_osm AND details IS NOT NULL AND status IN ('open', 'closed')
	LIMIT 100
) c
LEFT JOIN countries_subcountries sc ON sc.wkb_geometry && c.geom3857 AND ST_Intersects(sc.wkb_geometry, c.geom3857)`
	)
	.then(result => (result && result.rows && result.rows.length > 0) ? result.rows : []);
};

exports.setContributionsSent = (contribIds) => {
	return pool.query("UPDATE contributions SET sent_to_osm = true WHERE id = ANY($1)", [ contribIds ]);
};
