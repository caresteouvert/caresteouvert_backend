const express = require('express'),
    router = express.Router(),
    db = require('./db'),
    errorHandler = require('./error-handler').defaultErrorHandler;

const elementPerPage = 100;

const link = (href, title, rel = 'self', type = 'application/json') => {
    return {
        href,
        rel,
        type,
        title
    };
};

/**
 * Route to Regions list
 */
router.get(`/`, function (req, res) {
    db.listRegs()
        .then(regs => {
            res.json({
                links: [
                    link(req.originalUrl, 'directory.regions.title'),
                ],
                regions: regs.map(reg => {
                    return {
                        type: 'directory.regions.type',
                        id: reg.reg,
                        properties: reg,
                        links: link(`${req.baseUrl}/${reg.libelle}`, 'directory.regions.link.departements'),
                    };
                })
            })
        }).catch(err => errorHandler(err, res));
});

/**
 * route to region's departements list
 */
router.get(`/:reg`, function (req, res) {
    db.listDeps(req.params['reg'])
        .then(deps => res.json({
            links: [
                link(req.originalUrl, 'directory.departements.title'),
            ],
            departements: deps.map(dep => {
                return {
                    type: 'directory.departements.type',
                    id: dep.dep,
                    properties: dep,
                    links: link(`${req.originalUrl}/${dep.libelle}`, 'directory.departements.link.communes'),
                };
            })
        })).catch(err => errorHandler(err, res));
});

/**
 * route to department's communes list
 */
router.get(`/:reg/:dep`, function (req, res) {
    db.listComs(req.params['dep'])
        .then(coms => res.json({
            links: [
                link(req.originalUrl, 'directory.communes.title'),
            ],
            communes: coms.map(com => {
                return {
                    type: 'directory.communes.type',
                    id: com.com,
                    properties: com,
                    links: link(`${req.originalUrl}/${com.libelle}`, 'directory.communes.link.categories'),
                };
            })
        })).catch(err => errorHandler(err, res));
});

/**
 * route to categories
 */
router.get(`/:reg/:dep/:com`, function (req, res) {
    const com = req.params['com'];
    db.listNormalizedCat()
        .then(cats => res.json({
            links: [
                link(req.originalUrl, 'directory.categories.title'),
            ],
            categories: cats.map(cat => {
                return {
                    type: 'directory.categories.type',
                    id: cat,
                    properties: cat,
                    links: link(`${req.originalUrl}/${cat}`, 'directory.categories.link.pois'),
                };
            })
        })).catch(err => errorHandler(err, res));
});

/**
 * route to category page: POIs list
 */
router.get(`/:reg/:dep/:com/:category`, function (req, res) {
    const cat = req.params['category'];
    const com = req.params['com'];
    const page = req.query['page'] ? parseInt(req.query['page']) : 0;
    const pageQueryParam = '?page=';
    const urlWithoutPage = (url) => {
        const index = url.indexOf(pageQueryParam);
        return index > 0 ? url.substring(0, index) : url;
    };
    const urlAtPage = (url, targetPage) => {
        return urlWithoutPage(url) + pageQueryParam + targetPage;
    };

    const navigationForPage = (url, page, elements) => {
        const previous = page > 0 ? link(urlAtPage(url, page - 1), 'directory.pois.link.previous', 'prev') : [],
            next = elements >= elementPerPage ? link(urlAtPage(url, page + 1), 'directory.pois.link.next', 'next') : [];
        return [].concat(previous, next);
    }

    db.listPoisByCatAndCom(cat, com, elementPerPage, page)
        .then(pois => {
            res.json({
                links: [].concat(
                    link(req.originalUrl, 'directory.pois.title'),
                    navigationForPage(req.originalUrl, page, pois.length)
                ),
                pois: pois.map(poi => {
                    return {
                        type: 'directory.pois.type',
                        id: poi.fid,
                        properties: poi,
                        links: link(`${urlWithoutPage(req.originalUrl)}/${poi.name},${poi.fid}`, 'directory.pois.link.poi'),
                    };
                }),
            });
        }).catch(err => errorHandler(err, res));
});

/**
 * route to poi
 */
router.get(`/:reg/:dep/:com/:category/:nom,:fid`, function (req, res) {
    const fid = req.params['fid'];
    db.readPoi(fid)
        .then(poi => res.json({
            links: [
                link(req.originalUrl, 'directory.poi.title'),
            ],
            type: 'directory.pois.type',
            id: poi.fid,
            properties: poi,
        })).catch(err => errorHandler(err, res));
});

module.exports = router;
