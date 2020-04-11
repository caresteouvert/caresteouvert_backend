FROM postgis/postgis:12-3.0-alpine

ADD src/init.sql /docker-entrypoint-initdb.d/

RUN chmod a+r /docker-entrypoint-initdb.d/*
