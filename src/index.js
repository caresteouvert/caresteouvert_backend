/**
 * API main code
 */

const express = require('express');
const cors = require('cors');
const compression = require("compression");
const db = require('./db');
const apiRoutes = require('./directory/api-routes');
const OpeningHoursBuilder = require("transport-hours/src/OpeningHoursBuilder");

const RGX_COORDS = /^-?\d+(\.\d+)?$/;

// Init API
const app = express();

app.use('/directory', apiRoutes);

const port = process.env.PORT || 3000;
app.use(cors());
app.options('*', cors());
app.use(compression());
app.use(express.json());

/*
 * List of routes
 */

app.get('/', (req, res) => res.json({ "status": "OK" }));

app.get('/country', (req, res) => {
	if(!RGX_COORDS.test(req.query.lat)) {
		return res.status(400).send("Invalid lat : "+req.query.lat);
	}

	if(!RGX_COORDS.test(req.query.lon)) {
		return res.status(400).send("Invalid lon : "+req.query.lon);
	}

	return db.getCountry(req.query.lon, req.query.lat)
	.then(result => res.send(result))
	.catch(e => {
		console.error(e);
		res.status(500).send("An error happened when searching country");
	});
});

app.post("/contribute/:type/:id", (req, res) => {
	// Check OSM ID
	if(!["node", "way", "relation"].includes(req.params.type)) {
		return res.status(400).send("Invalid type : "+req.params.type);
	}

	if(!/^\d+$/.test(req.params.id)) {
		return res.status(400).send("Invalid ID : "+req.params.id);
	}

	const osmid = req.params.type + "/" + req.params.id;

	// Check state
	if(!["open", "closed"].includes(req.body.state)) {
		return res.status(400).send("Invalid status : "+req.body.state);
	}

	// Check details
	if(!(req.body.details === null || req.body.details === undefined || typeof req.body.details === "string")) {
		return res.status(400).send("Invalid details : "+req.body.details);
	}

	let details = (req.body.details || "").trim();
	if(details.length === 0) { details = null; }

	// Check name
	if(!(req.body.name === null || req.body.name === undefined || typeof req.body.name === "string")) {
		return res.status(400).send("Invalid name : "+req.body.name);
	}

	let name = (req.body.name || "").trim();
	if(name.length === 0) { name = null; }

	// Check lat
	if(!RGX_COORDS.test(req.body.lat)) {
		return res.status(400).send("Invalid lat : "+req.body.lat);
	}

	// Check lon
	if(!RGX_COORDS.test(req.body.lon)) {
		return res.status(400).send("Invalid lon : "+req.body.lon);
	}

	// Check and parse hours
	let opening_hours = null;

	if(!(req.body.opening_hours === null || req.body.opening_hours === undefined || Array.isArray(req.body.opening_hours))) {
		return res.status(400).send("Invalid opening_hours : "+req.body.details);
	}

	if(req.body.opening_hours) {
		try {
			opening_hours = (new OpeningHoursBuilder(req.body.opening_hours)).getValue();
		}
		catch(e) {
			return res.status(400).send("Invalid opening_hours : "+e);
		}
	}

	const language = req.body.lang || 'en';

	// Check other tags
	let otherTags = null;
	let croTags = null;

	if(req.body.tags) {
		if(
			typeof req.body.tags !== "object"
			|| Object.entries(req.body.tags).find(e => (
				typeof e[0] !== "string"
				|| typeof e[1] !== "string"
				|| e[0].trim().length === 0
				|| e[1].trim().length === 0
			))
		) {
			return res.status(400).send("Invalid tags : "+req.body.tags);
		}
		else {
			otherTags = req.body.tags;
			delete otherTags["opening_hours:covid19"];
			delete otherTags["description:covid19"];

			if(otherTags.opening_hours === "same" && opening_hours) {
				otherTags.opening_hours = opening_hours;
			}
			else {
				delete otherTags.opening_hours;
			}

			// Find "Ça reste ouvert" custom tags
			Object.keys(otherTags)
			.filter(k => k.startsWith("cro:"))
			.forEach(k => {
				if(!croTags) {
					croTags = {};
				}
				croTags[k.substring(4)] = otherTags[k];
				delete otherTags[k];
			});

			// Clean-up otherTags if empty
			if(Object.keys(otherTags).length === 0) {
				otherTags = null;
			}
		}
	}

	// Save in database
	const promises = [ db.addContribution(osmid, name, req.body.state, opening_hours, details, req.body.lon, req.body.lat, otherTags, croTags, req.body.lang) ];
	if(croTags) {
		promises.push(db.saveCroPoi(osmid, croTags));
	}

	return Promise.all(promises)
	.then(() => res.send("OK"))
	.catch(e => {
		console.error(e);
		res.status(500).send("An error happened when saving contribution");
	});
});

app.post("/contribute/:type/:id/custom", (req, res) => {
	// Check OSM ID
	if(!["node", "way", "relation"].includes(req.params.type)) {
		return res.status(400).send("Invalid type : "+req.params.type);
	}

	if(!/^\d+$/.test(req.params.id)) {
		return res.status(400).send("Invalid ID : "+req.params.id);
	}

	const osmid = req.params.type + "/" + req.params.id;

	// Check details
	if(!(req.body.details === null || req.body.details === undefined || typeof req.body.details === "string")) {
		return res.status(400).send("Invalid details : "+req.body.details);
	}

	let details = (req.body.details || "").trim();
	if(details.length === 0) { details = null; }

	// Check name
	if(!(req.body.name === null || req.body.name === undefined || typeof req.body.name === "string")) {
		return res.status(400).send("Invalid name : "+req.body.name);
	}

	let name = (req.body.name || "").trim();
	if(name.length === 0) { name = null; }

	// Check lat
	if(!RGX_COORDS.test(req.body.lat)) {
		return res.status(400).send("Invalid lat : "+req.body.lat);
	}

	// Check lon
	if(!RGX_COORDS.test(req.body.lon)) {
		return res.status(400).send("Invalid lon : "+req.body.lon);
	}

	const language = req.body.lang || 'en';

	// Check other tags
	let croTags = null;

	if(
		typeof req.body.tags !== "object"
		|| Object.entries(req.body.tags).length === 0
		|| Object.entries(req.body.tags).find(e => (
			typeof e[0] !== "string"
			|| typeof e[1] !== "string"
			|| e[0].trim().length === 0
			|| e[1].trim().length === 0
		))
	) {
		return res.status(400).send("Invalid tags : "+req.body.tags);
	}
	else {
		croTags = req.body.tags;
	}

	// Save in database
	return Promise.all([
		db.addContributionCro(osmid, name, details, req.body.lon, req.body.lat, croTags, req.body.lang),
		db.saveCroPoi(osmid, croTags)
	])
	.then(() => res.send("OK"))
	.catch(e => {
		console.error(e);
		res.status(500).send("An error happened when saving contribution");
	});
});

// 404
app.use((req, res) => {
	res.status(404).send(req.originalUrl + ' not found')
});

// Start
app.listen(port, () => {
	console.log('API started on port: ' + port);
});
