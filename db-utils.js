const util = require('util');

function promisifyDb(db) {
    db.all = util.promisify(db.all);
    db.get = util.promisify(db.get);
    
    // Custom promisify for db.run to preserve the result object
    const originalRun = db.run;
    db.run = function(sql, params) {
        return new Promise((resolve, reject) => {
            const callback = function(err) {
                if (err) {
                    reject(err);
                } else {
                    // 'this' contains the result object with lastID, changes, etc.
                    resolve(this);
                }
            };
            
            if (params) {
                originalRun.call(db, sql, params, callback);
            } else {
                originalRun.call(db, sql, callback);
            }
        });
    };
    
    return db;
}

module.exports = { promisifyDb };
