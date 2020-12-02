global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.btoa = str => Buffer.from(str, 'binary').toString('base64');

const OsmRequest = require("osm-request");
const db = require('./db');

const REMOVE_COVID19_TAGS = ["delivery", "drive_through", "takeaway"];
const languageFallback = process.env.OSM_LANG || "fr";
const delay = parseInt(process.env.DELAY_OSM) || 300000;
let delayedContributionsSent = [];

function getBestI18nAvailable(language) {
	try {
		return require(`../locales/${language}.json`);
	} catch (e) {
		return require(`../locales/${languageFallback}.json`);
	}
}

// Create OSM Request
const osmApi = new OsmRequest({
	endpoint: process.env.OSM_API_URL,
	oauthConsumerKey: process.env.OSM_API_KEY,
	oauthSecret: process.env.OSM_API_SECRET,
	basicauth: { user: process.env.OSM_USER, pass: process.env.OSM_PASS }
});

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

				const i18n = getBestI18nAvailable(note.language);

				let ohtext = null;
				if(note.opening_hours) {
					ohtext = "opening_hours:covid19=" + note.opening_hours;
				}
				else if(note.status === "open") {
					ohtext = "opening_hours:covid19=open";
				}
				else {
					ohtext = "opening_hours:covid19=off";
				}

				const text = `${i18n.note.header.replace(/{HASHTAG_COUNTRY}/g, note.country ? "#caresteouvert"+note.country : "").trim()}

${i18n.note.name} ${note.name || i18n.note.unknown}
${i18n.note.url} ${process.env.OSM_API_URL}/${note.osmid}

${i18n.note.status} ${i18n.status[note.status]}
${note.details ? (i18n.note.details + " " + note.details + "\n") : ""}
${ohtext}
${note.tags ? (Object.entries(note.tags).map(e => e.join("=")).join("\n")+"\n") : ""}
${i18n.note.footer}`;

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
					afterAll();
				}
			});
		}
		else {
			afterAll();
		}
	})
	.catch(e => {
		console.error(e);
		afterAll();
	});
}

/**
 * Handles a single changeset (used for cluster separating)
 */
function prepareSendChangeset(contribs) {
	return new Promise(async resolve => {
		const i18n = getBestI18nAvailable("en");

		// Create changeset
		const changesetId = await osmApi.createChangeset(i18n.changeset.editor, i18n.changeset.comment);

		if(changesetId) {
			// Go through all edited features
			const editedElemIds = [];
			for(let contrib of contribs) {
				try {
					let elem = await osmApi.fetchElement(contrib.osmid);

					if(elem) {
						// Define tags
						const tags = contrib.tags ? contrib.tags : {};

						if(contrib.details && contrib.details.trim().length > 0) {
							tags["description:covid19"] = contrib.details.trim();
						}

						if(contrib.status === "open") {
							tags["opening_hours:covid19"] = contrib.opening_hours || "open";
						}
						else if(contrib.status === "closed") {
							tags["opening_hours:covid19"] = "off";
						}

						// Remove suffixed covid19 tags if we have default tag in contribution
						REMOVE_COVID19_TAGS.filter(cvt => tags[cvt]).forEach(cvt => {
							elem = osmApi.removeTag(elem, cvt+":covid19");
						});

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
				catch(e) {
					// Check error code from OSM API
					try {
						const errorJson = JSON.parse(e.message);

						// If element doesn't exist or has been deleted, marked as edited
						if([404, 410].includes(errorJson.status)) {
							editedElemIds.push(contrib.id);
						}
					}
					catch(e2) {
						console.error("Error with", contrib.osmid, ":", e);
					}
				}
			}

			osmApi.closeChangeset(changesetId);

			// Send back edited features into DB
			if(editedElemIds.length > 0) {
				db.setContributionsSent(editedElemIds)
				.then(() => {
					console.log(`Updated ${editedElemIds.length} elements on OSM`);
					resolve();
				})
				.catch(e => {
					delayedContributionsSent = delayedContributionsSent.concat(editedElemIds);
					console.error(e);
					resolve();
				});
			}
			else {
				resolve();
			}
		}
		else {
			console.error("Can't create changeset");
			resolve();
		}
	});
}

// Automatic check for sending updates
function sendDataToOSM() {
	const afterAll = () => {
		setTimeout(sendDataToOSM, delay);
	};

	if(delayedContributionsSent.length > 0) {
		db.setContributionsSent(delayedContributionsSent)
		.then(() => {
			console.log("Delayed data sent to DB");
			delayedContributionsSent = [];
			sendDataToOSM();
		})
		.catch(e => {
			console.error("Can't send data to DB", e);
			afterAll();
		});
	}
	else {
		db.getContributionsForUpload()
		.then(async contribs => {
			if(contribs.length > 0) {
				console.log("Will send", contribs.length, "changesets");
				const handleNext = () => {
					if(contribs.length > 0) {
						prepareSendChangeset(contribs.pop())
						.then(() => handleNext());
					}
					else {
						afterAll();
					}
				};
				handleNext();
			}
			else {
				afterAll();
			}
		})
		.catch(e => {
			console.error(e);
			afterAll();
		});
	}
}

function start() {
	console.log("OSM data sending process started");
	sendDataToOSM();
	// Disable notes
	// setTimeout(() => sendNotesToOSM(), delay / 2);
};

// Start process
start();
