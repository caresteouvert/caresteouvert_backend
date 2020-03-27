/**
 * API main code
 */

const express = require('express');
const cors = require('cors');
const compression = require("compression");
const fs = require('fs');
const db = require('./db');
const osm = require('./osm');

// Init API
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.options('*', cors());
app.use(compression());
app.use(express.json());


/*
 * List of routes
 */

app.get('/', (req, res) => res.json({ "status": "OK" }));

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
	if(!/^-?\d+(\.\d+)?$/.test(req.body.lat)) {
		return res.status(400).send("Invalid lat : "+req.body.lat);
	}

	// Check lon
	if(!/^-?\d+(\.\d+)?$/.test(req.body.lon)) {
		return res.status(400).send("Invalid lon : "+req.body.lon);
	}

	// TODO Check and parse hours
	const opening_hours = null;

	// Save in database
	return db.addContribution(osmid, name, req.body.state, opening_hours, req.body.details, req.body.lon, req.body.lat)
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
	osm.start();
});
