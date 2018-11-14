'use strict'

const Input = require('./Input')
const SSHClient = require('./SSHClient')
const mysql = require('mysql2/promise') // TODO: too much deps
const MySQLDumper = require('./MySQLDumper')
const console = require('../lib/Console')
const v = console.verbose
const sleep = (sec) => new Promise((resolve) => setTimeout(resolve, sec * 1000))
const sqlTrim = (sql) => {
    sql = sql.trim().replace(/^(  )+/gm, '  ')
    let lines = sql.split(/\r\n|\r|\n/)
    if (lines.length > 6) sql = lines.slice(0, 6).join('\n') + `\n.. (${lines.length-6} more)`
    return sql
}

const DRY_RUN = (process.argv.findIndex(arg => arg === '--dry-run') !== -1)

class MySQL {
    
    constructor() {
        /** @type PromiseConnection **/
        this._db = null
        this._ssh = null
        this._dbName = null
        this._prefix = '[mysql]'
        
        this._thresholds = {
            enabled: false,
            connections: 300,
            interval: 2, // sec
            lastCheck: Date.now()
        }
    }
    
    /**
     * @return {string|null}
     */
    get dbname() { return this._dbName }
    
    /**
     * @return {PromiseConnection}
     */
    getConnection(){
        return this._db
    }
    
    /**
     * @param {string} host
     * @param {string} user
     * @param {string} password
     * @param {string} database
     * @param {SSHClient} ssh
     * @return {Promise<MySQL>}
     */
    async connect({host = '127.0.0.1', user = 'root', password = '', database = ''}, ssh = null){
        let cfg = {
            host: host,
            user: user,
            password: password,
            database: database,
            supportBigNumbers: true,
            bigNumberStrings: true,
            dateStrings: 'date',
            multipleStatements: true
        }
        this._prefix = (DRY_RUN ? 'DRY RUN | `' : '') + `[mysql ${user}@${host}]`
    
        if (ssh) {
            if(!password) {
                let storedPass = await ssh.exec(`(cat .my.cnf | grep password) || echo ''`, { secret: true, allowInDryRun: true }) || ''
                cfg.password = storedPass.replace(/password(\s?)+=(\s?)+/, '').trim().replace(/['"]/g, '') || ''
            }
            
            let port = `1${Date.now().toString().substr(-4)}` // random port
            cfg.stream = await ssh.tunnel(port, 3306)
            this._ssh = ssh
        }
    
        this._db = await mysql.createConnection(cfg)
        this._dbName = database
        
        return this
    }
    
    /**
     * @return {Promise<MySQL>}
     */
    async disconnect(){
        if (this._db) this._db.end()
        v(`${this._prefix} disconnected`)
        if (this._ssh) await this._ssh.disconnect()
        this._db = this._ssh = null
        this._prefix = '[mysql]'
        return this
    }
    
    // TODO: implement --show-warnings
    async query(SQL, params = []){
        v(`${this._prefix}\n` + sqlTrim(SQL) + (params.length ? `\n[${params||''}]` : ''))
        await this._protect(SQL)
        if(DRY_RUN) return []
        
        if(this._thresholds.enabled) await this._waitOnHighLoad()
        
        let [rows, fields] = await this._db.query(SQL, params)
        
        v(rows)
        return rows
    }
    
    async dump({exportSchema = true, exportData = false, sortKeys = false, maxChunkSize = 1000, dest = null, modifiers = [], excludeTables = [], includeTables = [], excludeColumns = {}, reorderColumns = {}}){
        let dumper = new MySQLDumper(this.getConnection())
        return await dumper.dump({exportSchema, exportData, sortKeys, maxChunkSize, dest, modifiers, excludeTables, includeTables, excludeColumns, reorderColumns})
    }
    
    /**
     *  strange way of detecting is the result from multiple statements or not
     * @param res
     */
    isMultiResult(res) {
        return res.length > 1 && Array.isArray(res[res.length - 1])
    }
    
    /**
     * Convert keys of object to mysql insert field list (aka INSERT INTO table (key1, key2)
     * @param {Object|Array<Object>} row
     * @return {string} - like "key1, key2"
     */
    toKeys(row){
        if(Array.isArray(row)) {
            row = row[0]
        }
        
        return Object.keys(row).join(', ')
    }
    
    /**
     * Convert values of object or array of objects in mysql insert values (aka INSERT ... VALUES (val11, val12), (val21, val22)
     * @param {Object|Array<Object>} rows
     * @return {Array<Array>}
     */
    toValues(rows){
        if(typeof rows === 'object' && !Array.isArray(rows)) {
            rows = [rows]
        }
        
        return [rows.map(row => Object.keys(row).map(key => row[key]))]
    }
    
    
    /**
     * @param {string} query
     * @param {Array} params
     * @return {string}
     */
    trace(query, params) {
        for (let p of params) {
            query = query.replace('?', p === null ? 'NULL' : `'${p}'`)
        }
        console.log(query)
        return query
    }
    
    
    highLoadProtection({ enabled = true, connections = 300, interval = 2 }){
        if(enabled) console.info(`[mysql] High load protection activated (limit ${connections} connections)`)
        this._thresholds.enabled = enabled
        this._thresholds.connections = connections
        this._thresholds.interval = interval
    }
    
    async _waitOnHighLoad(){
        const t = this._thresholds
        if(!t.enabled || !t.connections) return
        if(Date.now()-t.lastCheck < t.interval*1000) return
        t.lastCheck = Date.now()
        
        let [rows, fields] = await this._db.query(`SHOW GLOBAL STATUS like 'threads_connected'`)
        let threads = parseInt(rows[0].Value)
        v(`${this._prefix} Detected ${threads} active connections`)
        if(threads > t.connections){
            console.warn(`[mysql] Pausing query execution due high load: ${threads} connections (${t.connections} limit)`)
            await sleep(t.interval)
            return this._waitOnHighLoad()
        }
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
            
            let answer = await new Input().ask(`Please type 'approved' to proceed`, ['approved', 'no'], 'no')
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
        return /(DROP\s+DATABASE|DROP\s+USER)/gmi.test(SQL) !== true
    }
    
    
}

module.exports = MySQL