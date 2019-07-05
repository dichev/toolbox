'use strict';

const MySQLClient = require('../tools/MySQL');
const SSHClient = require('../tools/SSHClient')

// this._config = {
//     "logging": {
//         "mysql": {
//             "host": "127.0.0.1",
//             "user": "root",
//             "password": "",
//             "database": "envs",
//             "ssh": false
//         }
//     }
// };
class Logger {
    /**
     * @param config
     */
    constructor(config){
        this._config = config;
        this.hasMySQLLog = !!this._config.logging.mysql;
        this._db = null;
        this._ssh = null
        this._dbRecordId = null;
    }

    async start(info){
        console.log('#Deployer start at:', new Date());

        await this._prepare()

        await this._log(info);
    }

    /**
     * @param {int} exitCode
     * @param {string} [msg]
     * @returns {*}
     */
    async end(exitCode, msg){
        console.log('#Deployer end at:', new Date());

        let status = ['SUCCESS', 'ERROR', 'ABORT'][exitCode];
        let info = {
            status: status,
            message: msg,
            endAt: this._getDateTime()
        };

        await this._log(info);
        await this._destroy();
    }

    /**
     * @param {object} info
     * @private
     */
    async _log(info){
        // Write to mySQL log
        if(this.hasMySQLLog) {
            let sql = !this._dbRecordId ? 'INSERT INTO `deploy_log` SET ?' : 'UPDATE `deploy_log` SET ? WHERE id = ' + this._dbRecordId;
            let result = await this._db.query(sql, info)
            if(result && result.insertId) this._dbRecordId = result.insertId;
        }
        return this._dbRecordId
    }

    /**
     * @private
     */
    async _prepare() {
        if(this.hasMySQLLog) {

            if(this._config.logging.mysql.ssh) {
                this._ssh = await new SSHClient().connect({host: this._config.logging.mysql.host, username: 'root'})
            }

            let client = new MySQLClient();
            try {
                this._db = await client.connect(this._config.logging.mysql, this._ssh)
            } catch (e) {
                throw e
            }
        }
        return this._db
    }

    async _destroy() {
        await this._db.disconnect()
    }

    /**
     * @returns {string}
     * @private
     */
    _getDateTime(){
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
}

module.exports = Logger;