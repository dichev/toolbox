'use strict'


const mysql = require('mysql2/promise')
const fs = require('fs')
const {Readable, Transform, Stream} = require('stream')
const SSHClient = require('./SSHClient')
const NEW_LINE = require('os').EOL
const {v, vv, vvv} = require('../lib/Console')

/**
 * @typedef {Object} Options
 * @property {object|PromiseConnection} connection
 * @property {string} connection.host
 * @property {string} connection.user
 * @property {string} connection.pass
 * @property {string} connection.database
 * @property {object} connection.ssh
 * @property {string} dest = null
 * @property {array<function>} modifiers = []
 * @property {array<string>} excludeTables = []
 * @property {array<string>} includeTables = []
 * @property {object} excludeColumns = {}
 * @property {object} reorderColumns = {}
 * @property {object} filterRows = {}
 * @property {int} maxChunkSize = 1000
 * @property {boolean} exportData = false
 * @property {boolean} exportSchema = true
 * @property {boolean} exportGeneratedColumnsData = false
 * @property {boolean} sortKeys = false
 * @property {boolean} silent = false
 * @property {boolean} returnOutput = false - that could be very memory heavy when the databases contains a lot of data
 */


class MySQLDumper {
    
    /**
     * @param {Options}   options
     * @param {function} [callback]
     * @return {string}
     */
    static async dump(options, callback) {
        let output = ''
        try {
            let sharedConnection = options.connection && options.connection.constructor && options.connection.constructor.name === 'PromiseConnection' && options.connection || null
            let dumper = new MySQLDumper(sharedConnection, options.silent)
            if(!sharedConnection) await dumper.connect(options.connection)
            output = await dumper.dump(options)
        } catch (err){
            if(callback) return callback(err)
            throw err
        }
        return output
    }
    
    constructor(connection = null, silent = false){
        /** @type mysql **/
        this.connection = null
        /** @type SSHClient **/
        this.sshClient = null
        /** @type boolean **/
        this.silent = silent
        /** @type boolean **/
        this.sharedConnection = false
        
        
        if(connection) {
            this.connection = connection
            this.sharedConnection = true
        }
    }
    
    async connect({host, user, password, database, ssh}){
        let cfg = {
            host: host,
            user: user,
            password: password,
            database: database,
            supportBigNumbers: true,
            bigNumberStrings: true,
            dateStrings: 'date' // TODO - customize
        }
        
        if (ssh) {
            this.sshClient = new SSHClient();
            await this.sshClient.connect(ssh)
            let port = `1${Date.now().toString().substr(-4)}` // random port
            cfg.stream = await this.sshClient.tunnel(port, 3306)
        }
        this.connection = await mysql.createConnection(cfg)
    }
    
    async disconnect() {
        if (this.sharedConnection) return // we are not owner of the shared connection
        if (this.connection) this.connection.end()
        if (this.sshClient) await this.sshClient.disconnect()
        this.connection = this.sshClient = null
    }
    
    
    /**
     * Using streams to be able to dump efficiently databases in any size without memory overflow
     *
     * @param {Options} options
     * @return {Promise<String>}
     */
    async dump(options) {
        let stream = this.dumpStream(options)
        let dest = options.dest
        
        if (dest) {
            if (typeof dest === 'string') {
                let writable = fs.createWriteStream(dest, {encoding: 'utf8'})
                stream.pipe(writable)
            } else if (dest instanceof Stream) {
                stream.pipe(dest)
            } else {
                throw Error(`Unsupported 'dest' value (${typeof dest}) - please use String or Stream`)
            }
        }
        
        let sql = ''
        for await (const chunk of stream) {
            if(options.returnOutput) sql += chunk
        }
    
        if (dest) v('The database is dumped: ' + (dest.path || dest))
        
        return sql
    }
    
    
    /**
     * @param {Options} options
     * @return {ReadableStream}
     */
    dumpStream(options) {
        let iterator = this.dumpGenerator(options)
        let dataStream = new Readable({
            async read() {
                // await new Promise(resolve => setTimeout(()=> { console.warn('.. waited 1sec'); resolve() }, 1000)) // FOR DEBUGGING STREAMS
                let res = await iterator.next()
                if(!res.done){
                    this.push(res.value)
                } else {
                    this.push(null)
                }
            }
        })
        
        
        let dataTransform = new Transform({
            transform(chunk, encoding, callback) {
                // unify new lines
                chunk = chunk.toString().replace(/$\r?\n/gm, NEW_LINE)
    
                // add custom replacements
                if(options.modifiers.length) {
                    options.modifiers.forEach(modifier => {
                        chunk = modifier(chunk)
                    })
                }
                
                this.push(chunk)
                callback()
            }
        })
    
        let stream = dataStream.pipe(dataTransform)
        return stream
    }
    
    
    /**
     * Using generator to yield only group of the rows instead all of them at once - to avoid memory overload
     * @param {Options} options
     * @return {Promise<ReadableStream>}
     */
    async* dumpGenerator({exportSchema = true, exportData = false, exportGeneratedColumnsData = false, exportViewData = false, sortKeys = false, maxChunkSize = 1000, dest = null, modifiers = [], excludeTables = [], includeTables = [], excludeColumns = {}, reorderColumns = {}, filterRows = {}}) {
        v('MySQL dump options:', arguments[0])
        
        let [rows] = await this.connection.query('SELECT DATABASE() as dbname')
        let database = rows[0].dbname
        if(!database) throw Error('MySQLDumper: you must select database before doing export, please execute first: USE dbname;')
       
        /*
        output += 'DROP DATABASE IF EXISTS `'+ database+'`;\n'
        output += 'CREATE DATABASE `'+ database+'`;\n'
        output += 'USE `'+ database+'`;\n\n'
        */
        
        let [tables,views] = await this._getTableNames(database, excludeTables, includeTables)
        v(`Found ${tables.length} tables and ${views.length} views in ${database}`)
        
        if(exportSchema || exportData) {
            v('Exporting:')
            for (let names of [tables, views])
                for (let name of names) { // TODO: use parallelLimit (order will be not guaranteed)
                    v(' -', name)
                    if (exportSchema) {
                        let structure = await this._dumpStructure(name, database, sortKeys)
                        yield structure
                    }
            
                    if (exportData) {
                        yield* this._dumpData(name, excludeColumns[name], reorderColumns[name], filterRows[name], maxChunkSize, exportGeneratedColumnsData)
                    }
                }
        }
        
        await this.disconnect()
        
    }
    
    async _getTableNames(database, excludeTables = [], includeTables = []){
        if(includeTables.length && excludeTables.length) throw new Error('Wrong configuration! You must choose just one from this settings: excludeTables, includeTables')
    
        let filter = ''
        if(excludeTables.length){
            filter = `AND TABLE_NAME NOT IN ('${excludeTables.join("','")}')`;
        }
        else if(includeTables.length){
            filter = `AND TABLE_NAME IN ('${includeTables.join("','")}')`;
        }
        
        let SQL_GET_TABLE_NAMES = `SELECT TABLE_TYPE, TABLE_NAME FROM information_schema.TABLES
                                   WHERE TABLE_SCHEMA = '${database}' ${filter}
                                   ORDER BY TABLE_SCHEMA ASC, TABLE_NAME ASC`
        
        let [results] = await this.connection.query(SQL_GET_TABLE_NAMES)
        
        let tables = []
        let views = []
        results.map(row => (row.TABLE_TYPE === 'VIEW' ? views.push(row.TABLE_NAME) : tables.push(row.TABLE_NAME)))
        return [tables, views]
    }
    
    async _dumpStructure(table, database, sortKeys = false){
        let SQL = 'SHOW CREATE TABLE `' + table + '`'
        let [results] = await this.connection.query(SQL)
        let rules = results[0]['Create Table'] || this._beautifyCreateView(results[0]['Create View'], database)
        if(!rules) console.error('Missing create table info for', table)
        let output = rules + ';'
        if(sortKeys) {
            output = this._sortKeys(output)
        }
        return output + NEW_LINE + NEW_LINE
    }
    
    /**
     * @return {string}
     */
    async* _dumpData(table, exclude = [], orderBy = '', filter = '', maxChunkSize = 1000, exportGeneratedColumnsData = false){
        let excludedColumns = exclude && exclude.length ? `AND Field NOT IN ("${exclude.join('","')}")` : ''
        let excludeGeneratedColumns = exportGeneratedColumnsData ? '' : `AND Extra != 'VIRTUAL GENERATED'`
        let SQL_COLUMNS = `SHOW COLUMNS FROM \`${table}\` WHERE 1 ${excludeGeneratedColumns} ${excludedColumns}`
        let [cols] = await this.connection.query(SQL_COLUMNS)
        let columns = cols.map(r => r.Field)
        columns = '`' + columns.join('`, `') + '`'
    
        orderBy = orderBy ? 'ORDER BY ' + orderBy : ''
        filter = filter ? `AND (${filter})` : ''
        let SQL = `SELECT ${columns} FROM ${table} WHERE 1 ${filter} ${orderBy}`
    
    
        let rows = []
        let toSQL = this._buildInsert.bind(this)
        let dataTransform = new Transform({
            writableObjectMode: true,
            highWaterMark: 1,
            
            transform(chunk, encoding, callback) {
                rows.push(chunk)
                if(rows.length >= 10) {
                    this.push(toSQL(rows, table))
                    rows = []
                }
                callback()
            },
            flush(callback) {
                if(rows.length) {
                    this.push(toSQL(rows, table))
                    rows = []
                }
                this.push('\n')
                callback()
            }
        })
        
        let stream = this.connection.connection.query(SQL).stream().pipe(dataTransform)
        for await (const chunk of stream) {
            yield chunk
        }
    }
    
    /**
     * @param {Object} rows
     * @param {string} table
     * @return {string}
     */
    _buildInsert(rows, table) {
        if (!rows || !rows.length) return ''
        
        let values = rows.map(row => this._toValues(row))
        let columns = Object.keys(rows[0])
        let sql = 'INSERT INTO `' + table + '` (`' + columns.join('`, `') + '`) VALUES\n' + values.join(',\n') + ';\n'
    
        return sql + NEW_LINE
    }
    
    /**
     *
     * @param {Object} row
     * @return {string}
     */
    _toValues(row) {
        let sql
        let values = [];
        for (let k in row) {
            let v = row[k]
            if (v === null) {
                values.push('NULL')
            }
            else if (typeof v === 'number') {
                values.push(v)
            }
            else {
                let val = ''
                if (typeof v === 'object') { // json
                    val = JSON.stringify(v)
                } else {
                    val = v
                }
                val = this.connection.escape(val)
                val = val.replace(/\\"/g, '"') // restore escaping of double quotes (because json)
                values.push(val)
            }
        }
        
        sql = '(' + values.join(', ') + ')'
        return sql
    }
    
    _sortKeys(schema) {
        let reKey = new RegExp(/^.+KEY .+$/gm)
        let keys = schema.match(reKey);
        
        if(keys && keys.length){
            let sorted = keys
                            .map(k => k.replace(/  KEY/g, '  W_KEY')) // arrange normal indexes after unique/primary
                            .sort()
                            .map(k => k.replace(/  W_KEY/g, '  KEY'))
                            .map((k, i) => k.replace(/,$/, '') + ((i < keys.length - 1) ? ',' : '')) // fix commas
    
            schema = schema.replace(reKey, () => sorted.shift())
        }
        
        return schema;
    }
    
    // attempt to beautify a bit the single line create view statements
    _beautifyCreateView(sql, database){
        return sql.replace(/(SELECT|FROM|LEFT JOIN|INNER JOIN|OUTER JOIN|RIGHT JOIN|JOIN|WHERE|GROUP BY|ORDER BY|LIMIT) /gi, (m, m1) => '\n'+m1.toUpperCase()+'\n  ')
                  .replace(/(`,)/gi, '$1\n  ')
                  .replace(/[) ](on|and|or)[ (]/g, (m, m1) => m.toUpperCase())
                  .replace(/([a-z_0-9]+?)\(/g, (m, m1) => m.toUpperCase())
                  .replace(/ ALGORITHM=UNDEFINED/, '')
                  .replace(/ DEFINER=`.+?`@`.+?`/, '')
                  .replace(/ SQL SECURITY DEFINER/, '')
                  .replace(new RegExp('`'+database+'`.', 'gi'), '')
    }

    
}

module.exports = MySQLDumper