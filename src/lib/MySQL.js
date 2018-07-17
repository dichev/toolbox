'use strict'

const SSHClient = require('./SSHClient');
const mysql = require('mysql2/promise'); // TODO: too much deps

class MySQL {
    
    constructor(dryMode = false) { // TODO: dryMode
        this._db = null
        this._dryMode = dryMode
    }
    
    
    /**
     * @param {string} host
     * @param {string} user
     * @param {string} password
     * @param {string} database
     * @param {SSHClient} ssh
     * @return {MySQL}
     */
    async connect({host, user = 'root', password = '', database = ''}, ssh = null){
        let cfg = {
            host: host,
            user: user,
            password: password,
            database: database,
            supportBigNumbers: false,
            bigNumberStrings: false,
            dateStrings: 'date',
            multipleStatements: true
        }
    
        if (ssh) {
            if(!password) {
                let storedPass = await ssh.exec(`(cat .my.cnf | grep password) || echo ''`, { secret: true })
                cfg.password = storedPass.replace(/password(\s?)+=/, '').trim() || ''
            }
            
            let port = `1${Date.now().toString().substr(-4)}` // random port
            cfg.stream = await ssh.tunnel(port, 3306)
            
        }
    
        this._db = await mysql.createConnection(cfg)
        
        return this
    }
    
    // TODO: implement --show-warnings
    async query(SQL, params){
        let [rows, fields] = await this._db.query(SQL, params)
        return rows
    }
    
}

module.exports = MySQL