# Ça reste ouvert - Back-end

## Install

Requires :

* NodeJS >= 9
* PostgreSQL >= 10
* PostGIS >= 2.5

Then run these commands :

```bash
cd caresteouvert_backend/
npm install
psql -d mydb -f src/init.sql
npm run start:api # Launch API listening process
npm run start:osm # Launch OSM data sending process
```


## Environment variables

* `DATABASE_URL` : connection string for PostgreSQL database
* `DELAY_OSM` : optional, delay between two calls to either notes or features updates (in milliseconds)
* `OSM_API_URL` : OSM API endpoint to use (for example https://master.apis.dev.openstreetmap.org)
* `OSM_API_KEY` : OSM API key
* `OSM_API_SECRET` : OSM API secret key
* `OSM_USER` : OSM user name
* `OSM_PASS` : OSM user password
* `OSM_LANG` : language used for OpenStreetMap notes and changesets (code used in `src/locales.json`)


## Docker

The back-end can be deployed using Docker. It consists of three containers:

* `db` – a PostgreSQL database to hold contributions ([docker/db/Dockerfile](./docker/db/Dockerfile)),
* `web` – a web server to accept contributions and insert them into the database ([docker/web/Dockerfile](./docker/web/Dockerfile)),
* `worker` – a worker to relay contributions to OSM as changesets and notes ([docker/worker/Dockerfile](./docker/worker/Dockerfile)).

To deploy using Docker Compose:

1. Copy `env.example` to `.env` and set environment variables.
2. Run `docker-compose up` to build and run the containers.
3. Open http://localhost:8080/ to check that it returns `{"status":"OK"}`.

Notes:

* On the first run, the database will be created automatically. It is a known issue that the worker fails in this case, because it tries to access the database before it exists.
* To reset the database, run `docker-compose down --volumes`.


## License

Copyright (c) "Ça reste ouvert" 2020

Released under the AGPL v3 terms, see the [LICENSE](LICENSE.txt) file to read the full text.
