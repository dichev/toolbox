'use strict'

const Input = require('./Input')
const SSHClient = require('./SSHClient');
const mysql = require('mysql2/promise'); // TODO: too much deps
const console = require('../lib/Log')
const v = console.verbose

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
                let storedPass = await ssh.exec(`(cat .my.cnf | grep password) || echo ''`, { secret: true, allowInDryMode: true }) || ''
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
        v(`${this._dryMode?'DRY RUN | ':''}[mysql] ${SQL.length > 200 ? SQL.substr(0, 200) + '..' : SQL} [${params||''}]`)
        await this._protect(SQL)
        if(this._dryMode) return []
        let [rows, fields] = await this._db.query(SQL, params)
        return rows
    }
    
    /**
     * Once upon a time a query with DROP DATABASE was executed on production..
     * so for now on we should be a lot more careful
     */
    async _protect(SQL){
        if(!this.isSafe(SQL)){
            console.warn('WARNING! Found risky SQL statement:')
            console.info(SQL)
            console.warn('Are you sure you know what are you doing?')
            
            let answer = await Input.ask(`Please type 'approved' to proceed`, ['approved', 'no'], 'no')
            if(answer !== 'approved'){
                throw Error('The operation is not approved. Aborting..')
            }
        }
    }
    
    /**
     * United tested method
     * @param {string} SQL
     * @return {boolean}
     */
    isSafe(SQL) {
        return /(DROP\s+DATABASE|DROP\s+USER|TRUNCATE\s+)/gmi.test(SQL) !== true
    }
    
    
}

module.exports = MySQL