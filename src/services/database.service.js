const MockDatabaseService = require("./class.mock.database.service");
const MySqlDatabaseService = require("./class.mysql.database.service");
let db;

if(!!process.env.TESTING) {
    db = new MockDatabaseService();
} else {
    const dbType = !!process.env.DB ? process.env.DB : 'MySql';
    if(dbType === 'MySql') {
        db = new MySqlDatabaseService();
    } else {
        db = new MockDatabaseService();
    }
}


module.exports = db;
