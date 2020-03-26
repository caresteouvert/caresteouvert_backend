global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.btoa = str => Buffer.from(str, 'binary').toString('base64');

const OsmRequest = require("osm-request");
const CONFIG = require('../config.json');
const db = require('./db');

// Create OSM Request
const osmApi = new OsmRequest({
	endpoint: CONFIG.OSM_API_URL,
	oauthConsumerKey: CONFIG.OSM_API_KEY,
	oauthSecret: CONFIG.OSM_API_SECRET,
	basicauth: { user: CONFIG.OSM_USER, pass: CONFIG.OSM_PASS }
});

// Automatic check for sending updates
function sendDataToOSM() {
	const afterAll = () => {
		setTimeout(sendDataToOSM, CONFIG.DELAY_OSM);
	};

	db.getContributionsForUpload()
	.then(async contribs => {
		if(contribs.length > 0) {
			// Create changeset
			const changesetId = await osmApi.createChangeset('Ça reste ouvert (caresteouvert.fr)', 'Ajout informations liées aux confinement #covid19 #caresteouvert');

			if(changesetId) {
				// Go through all edited features
				const editedElemIds = [];
				for(let contrib of contribs) {
					let elem = await osmApi.fetchElement(contrib.osmid);

					if(elem) {
						// Define tags
						const tags = {};

						if(contrib.details && contrib.details.trim().length > 0) {
							tags["note:covid19"] = contrib.details.trim();
						}

						if(contrib.status === "open") {
							tags["opening_hours:covid19"] = contrib.opening_hours || "same";
						}
						else if(contrib.status === "closed") {
							tags["opening_hours:covid19"] = "off";
						}

						elem = osmApi.setTags(elem, {
							"opening_hours:covid19": contrib.opening_hours,
							"note:covid19": contrib.details
						});

						// Send to API
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
					console.log("Nothing has been edited");
					afterAll();
				}
			}
			else {
				console.error("Can't create changeset");
				afterAll();
			}
		}
		else {
			console.log("Nothing to send to OSM");
			afterAll();
		}
	})
	.catch(e => {
		console.error(e);
		afterAll();
	});
}

exports.sendData = sendDataToOSM;
