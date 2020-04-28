const { Pool } = require('pg'),
    _ = require('lodash');

const connectionString = process.env.DATABASE_URL;

const pgPool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const poiOsmTable = 'poi_osm';
const normalizedCatColumn = 'normalized_cat';
const fidColumn = 'fid';

const columns = {
    poi:
        ['fid', 'name', 'cat', 'normalized_cat', 'brand', 'status', 'opening_hours']
            .map(col => 'poi.' + col),
    poiExtended:
        ['brand_wikidata', 'brand_hours', 'brand_infos', 'delivery', 'tags']
            .map(col => 'poi.' + col),
    poiLocation:
        ['ST_X(ST_Transform(poi.geom, 4326)) AS lon', 'ST_Y(ST_Transform(poi.geom, 4326)) AS lat'],
    com: ['com', 'libelle']
        .map(col => `com.${col} AS com_${col}`),
    dep: ['dep', 'libelle']
        .map(col => `dep.${col} AS dep_${col}`),
    reg: ['reg', 'libelle']
        .map(col => `reg.${col} AS reg_${col}`),
    join: (...cols) => _.join(_.concat(cols), ',')
}

const queries = {
    categories: {
        name: 'categories',
        text: 'SELECT DISTINCT(normalized_cat) FROM poi_osm'
    },
    pois_by_com_and_cat: (category, com, count, offset) => {
        return {
            name: 'pois_by_category_and_com',
            text: 'SELECT ' + columns.join(columns.poi, columns.com, columns.dep, columns.reg) +
                '  FROM cog_commune com' +
                '  JOIN cog_departement dep ON com.dep=dep.dep' +
                '  JOIN cog_region reg ON reg.reg=com.reg' +
                '  JOIN polygones_insee polygon ON polygon.insee_com=com.com' +
                '  JOIN poi_osm poi ON ST_CONTAINS(polygon.geometrie, poi.geom) ' +
                '  WHERE poi.normalized_cat=$1 ' +
                '  AND com.libelle=$2' +
                '  ORDER BY poi.fid LIMIT $3 OFFSET $4;',
            values: [category, com, count, offset],
        }
    },
    pois_by_cat: (category, count, offset) => {
        return {
            name: 'pois_by_category',
            text: 'SELECT ' + columns.join(columns.poi, columns.com, columns.dep, columns.reg) +
                '  FROM cog_commune com' +
                '  JOIN cog_departement dep ON com.dep=dep.dep' +
                '  JOIN cog_region reg ON reg.reg=com.reg' +
                '  JOIN polygones_insee polygon ON polygon.insee_com=com.com' +
                '  JOIN poi_osm poi ON ST_CONTAINS(polygon.geometrie, poi.geom) ' +
                '  WHERE poi.normalized_cat=$1 ' +
                '  ORDER BY poi.fid LIMIT $2 OFFSET $3;',
            values: [category, count, offset],
        }
    },
    poi_by_fid: (fid) => {
        return {
            name: 'poi_by_fid',
            text: 'SELECT ' + columns.join(columns.poi, columns.poiExtended, columns.poiLocation, columns.com, columns.dep, columns.reg) +
                '  FROM cog_commune com' +
                '  JOIN cog_departement dep ON com.dep=dep.dep' +
                '  JOIN cog_region reg ON reg.reg=com.reg' +
                '  JOIN polygones_insee polygon ON polygon.insee_com=com.com' +
                '  JOIN poi_osm poi ON ST_CONTAINS(polygon.geometrie, poi.geom) ' +
                '  WHERE poi.fid=$1;',
            values: [fid],
        }
    },
    regs: {
        name: 'regs',
        text: `select * from COG_REGION`,
    },
    deps_by_reg: (reg) => {
        return {
            name: 'deps_by_reg',
            text: `select dep.* from COG_DEPARTEMENT dep JOIN COG_REGION reg ON reg.reg=dep.reg where reg.libelle=$1;`,
            values: [reg],
        }
    },
    coms_by_dep: (dep) => {
        return {
            name: 'coms_by_dep',
            text: `select com.* from COG_COMMUNE com JOIN COG_DEPARTEMENT dep ON dep.dep=com.dep where dep.libelle=$1`,
            values: [dep],
        }
    },
}

module.exports = {
    listNormalizedCat: () => {
        const query = queries.categories;
        return pgPool.query(query)
            .then(res => res.rows.map((row => row[normalizedCatColumn])));
    },
    listPoisByCat: (cat, count, page) => {
        const offset = count * page;
        const query = queries.pois_by_cat(cat, count, offset);
        return pgPool.query(query)
            .then(res => res.rows);
    },
    listPoisByCatAndCom: (cat, com, count, page) => {
        const offset = count * page;
        const query = queries.pois_by_com_and_cat(cat, com, count, offset);
        return pgPool.query(query)
            .then(res => res.rows);
    },
    readPoi: (fid) => {
        const query = queries.poi_by_fid(fid);
        return pgPool.query(query)
            .then(res => {
                return res.rows.shift()
            });
    },
    listRegs: () => {
        return pgPool.query(queries.regs)
            .then(res => res.rows);
    },
    listDeps: (reg) => {
        return pgPool.query(queries.deps_by_reg(reg))
            .then(res => res.rows);
    },
    listComs: (dep) => {
        return pgPool.query(queries.coms_by_dep(dep))
            .then(res => res.rows);
    },
    close: () => {
        pgPool.end();
    },
}
