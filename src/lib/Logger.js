'use strict'

const MySQLClient = require('../tools/MySQL')
const SSHClient = require('../tools/SSHClient')
const fetch = require('node-fetch')

// this._config = {
//    "mysql": {
//        "host": "127.0.0.1",
//        "user": "root",
//        "password": "",
//        "database": "envs",
//        "ssh": false
//    },
//    grafana: { // Allows adding of annotations with curl request
//        "apiUrl": false, // https://prodmon.dopamine.bg/api/annotations
//        "apiKey": false  // You can get the api key from here https://prodmon.dopamine.bg/org/apikeys
//    }
// }
class Logger {
    /**
     * @param {object} config
     */
    constructor(config){
        this._config = config
        this.hasMySQLLog = config && !!config.mysql
        this.hasGrafanaLog = config && !!config.grafana && config.grafana.apiUrl && config.grafana.apiKey
        this.enabled = this.hasMySQLLog || this.hasGrafanaLog
        this._db = null
        this._ssh = null
        this._dbRecordId = null
    }

    async start(info){
        if (!this.enabled) return

        await this._prepare()
        await this._log(info, 'start')
    }

    /**
     * @param {int} exitCode
     * @param {string} [msg]
     * @returns {*}
     */
    async end(exitCode, msg){
        if (!this.enabled) return

        let status = ['SUCCESS', 'ERROR', 'ABORT'][exitCode]
        let info = {
            status: status,
            message: msg,
            endAt: this._getDateTime()
        }

        await this._log(info, 'end')
        await this._destroy()
    }

    /**
     * @param {object} info
     * @param {string} source
     * @private
     */
    async _log(info, source){
        // Write to mySQL log
        if(this.hasMySQLLog) {
            try {
                let sql = !this._dbRecordId ? 'INSERT INTO `deploy_log` SET ?' : 'UPDATE `deploy_log` SET ? WHERE id = ' + this._dbRecordId
                let result = await this._db.query(sql, info)
                if(result && result.insertId) this._dbRecordId = result.insertId
            } catch (e) {
                console.log(e)
            }
        }
    
        if (this.hasGrafanaLog) {
            await this._logGrafanaAnnotation(source, info);
        }

        return this._dbRecordId
    }

    async _logGrafanaAnnotation(source, info) {
        if (source === 'start') {
            try {
                let debugInfo = JSON.parse(info.debugInfo)

                let options = {
                    url: this._config.grafana.apiUrl,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${this._config.grafana.apiKey}`
                    },
                    body: {
                        time: Date.now(),
                        isRegion: true,
                        timeEnd: Date.now(),
                        text: "Deploy: " + (info.jiraTicketId ? `<a href="${info.jiraTicketId}" target="_blank">${debugInfo.jira}</a>` : "-"),
                        data: debugInfo,
                        tags: ["deploy"],
                    }
                }

                if (info.action.includes('cdn/')) {
                    options.body.tags.push("frontend")
                } else if (info.action.includes('hermes/')) {
                    options.body.tags.push("backend")
                } else {}
                // Stringify body
                options.body = JSON.stringify(options.body)

                process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
                await fetch(this._config.grafana.apiUrl, options)
                process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 1;

            } catch (e) {
                console.error(e)
            }
        }
    }

    /**
     * @private
     */
    async _prepare() {
        if(this.hasMySQLLog) {
            try {
                if(this._config.mysql.ssh) {
                    this._ssh = await new SSHClient().connect({host: this._config.mysql.host, username: 'root'})
                }
                let client = new MySQLClient()
                this._db = await client.connect(this._config.mysql, this._ssh)
            } catch (e) {
                console.error(e)
                this.hasMySQLLog = false
            }
        }
        return this._db
    }

    async _destroy() {
        if (this._db) {
            await this._db.disconnect()
        }
        if (this._ssh) {
            await this._ssh.disconnect()
        }
    }

    /**
     * @returns {string}
     * @private
     */
    _getDateTime(){
        return new Date().toISOString().slice(0, 19).replace('T', ' ')
    }
}

module.exports = Logger