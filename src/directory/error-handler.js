module.exports = {
    defaultErrorHandler: (err, res) => {
        console.warn(err);
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(err));
    },
};
