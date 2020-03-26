# Ça reste ouvert - Back-end

## Install

Requires :

* NodeJS >= 9
* PostgreSQL

Edit `config.json` file to change settings according to your setup.

Then run these commands :

```bash
cd caresteouvert_backend/
npm install
psql -d mydb -f src/init.sql
npm run start
```
