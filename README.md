# Ça reste ouvert - Back-end

## Install

Requires :

* NodeJS >= 9
* PostgreSQL

Then run these commands :

```bash
cd caresteouvert_backend/
npm install
psql -d mydb -f src/init.sql
npm run start
```

## Environment variables

* `DATABASE_URL` : connection string for PostgreSQL database
* `DELAY_OSM` : optional, delay between two calls to either notes or features updates (in milliseconds)
* `OSM_API_URL` : OSM API endpoint to use (for example https://master.apis.dev.openstreetmap.org)
* `OSM_API_KEY` : OSM API key
* `OSM_API_SECRET` : OSM API secret key
* `OSM_USER` : OSM user name
* `OSM_PASS` : OSM user password
