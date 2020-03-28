global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.btoa = str => Buffer.from(str, 'binary').toString('base64');

const OsmRequest = require("osm-request");
const db = require('./db');

const delay = parseInt(process.env.DELAY_OSM) || 300000;

// Create OSM Request
const osmApi = new OsmRequest({
	endpoint: process.env.OSM_API_URL,
	oauthConsumerKey: process.env.OSM_API_KEY,
	oauthSecret: process.env.OSM_API_SECRET,
	basicauth: { user: process.env.OSM_USER, pass: process.env.OSM_PASS }
});

const STATUS_TO_TXT = { "open": "ouvert pendant le confinement", "closed": "fermé pendant le confinement" };

// Automatic check for notes
function sendNotesToOSM() {
	const afterAll = () => {
		setTimeout(sendNotesToOSM, delay);
	};

	db.getContributionsForNotes()
	.then(notes => {
		if(notes.length > 0) {
			const sentNotesIds = [];

			const processNext = () => {
				if(notes.length === 0) { return Promise.resolve(); }

				const note = notes.pop();

				const text =
`Signalement #covid19 #caresteouvert

Nom : ${note.name}
URL : https://www.openstreetmap.org/${note.osmid}

État : ${STATUS_TO_TXT[note.status]}
Détails :
${note.details}

Pour corriger cette note, utilisez les tags opening_hours:covid19 et description:covid19 : https://wiki.openstreetmap.org/wiki/FR:Key:opening_hours:covid19`;

				return osmApi.createNote(note.lat, note.lon, text)
				.then(() => {
					sentNotesIds.push(note.id);
					return processNext();
				})
				.catch(e => {
					console.error(e);
					return processNext();
				});
			}

			processNext()
			.then(() => {
				// Send back edited features into DB
				if(sentNotesIds.length > 0) {
					db.setContributionsSent(sentNotesIds)
					.then(() => {
						console.log(`Created ${sentNotesIds.length} notes on OSM`);
						afterAll();
					})
					.catch(e => {
						console.error(e);
						afterAll();
					});
				}
				else {
// 					console.log("No notes has been created");
					afterAll();
				}
			});
		}
		else {
// 			console.log("No notes to send to OSM");
			afterAll();
		}
	})
	.catch(e => {
		console.error(e);
		afterAll();
	});
}

// Automatic check for sending updates
function sendDataToOSM() {
	const afterAll = () => {
		setTimeout(sendDataToOSM, delay);
	};

	db.getContributionsForUpload()
	.then(async contribs => {
		if(contribs.length > 0) {
			// Create changeset
			const changesetId = await osmApi.createChangeset('caresteouvert.fr', 'Ajout informations liées aux confinement #covid19 #caresteouvert');

			if(changesetId) {
				// Go through all edited features
				const editedElemIds = [];
				for(let contrib of contribs) {
					let elem = await osmApi.fetchElement(contrib.osmid);

					if(elem) {
						// Define tags
						const tags = {};

						if(contrib.details && contrib.details.trim().length > 0) {
							tags["description:covid19"] = contrib.details.trim();
						}

						if(contrib.status === "open") {
							tags["opening_hours:covid19"] = contrib.opening_hours || "same";
						}
						else if(contrib.status === "closed") {
							tags["opening_hours:covid19"] = "off";
						}

						// Send to API
						elem = osmApi.setTags(elem, tags);
						elem = osmApi.setTimestampToNow(elem);
						const result = await osmApi.sendElement(elem, changesetId);

						if(result) {
							editedElemIds.push(contrib.id);
						}
						else {
							console.error("Failed to update OSM element", contrib.osmid);
						}
					}
				}

				osmApi.closeChangeset(changesetId);

				// Send back edited features into DB
				if(editedElemIds.length > 0) {
					db.setContributionsSent(editedElemIds)
					.then(() => {
						console.log(`Updated ${editedElemIds.length} elements on OSM`);
						afterAll();
					})
					.catch(e => {
						console.error(e);
						afterAll();
					});
				}
				else {
// 					console.log("Nothing has been edited");
					afterAll();
				}
			}
			else {
				console.error("Can't create changeset");
				afterAll();
			}
		}
		else {
// 			console.log("Nothing to send to OSM");
			afterAll();
		}
	})
	.catch(e => {
		console.error(e);
		afterAll();
	});
}

function start() {
	console.log("OSM data sending process started");
	sendDataToOSM();
	setTimeout(() => sendNotesToOSM(), delay / 2);
};

// Start process
start();
