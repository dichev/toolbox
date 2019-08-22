'use strict'


const mysql = require('mysql2/promise')
const promisify = require('util').promisify
const writeFileAsync = promisify(require('fs').writeFile)
const SSHClient = require('./SSHClient')
const NEW_LINE = require('os').EOL


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
 * @property {boolean} sortKeys = false
 * @property {boolean} silent = false
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
     * @param {Options} options
     * @return {Promise<string>}
     */
    async dump({exportSchema = true, exportData = false, sortKeys = false, maxChunkSize = 1000, dest = null, modifiers = [], excludeTables = [], includeTables = [], excludeColumns = {}, reorderColumns = {}, filterRows = {}}) {
        let [rows] = await this.connection.query('SELECT DATABASE() as dbname')
        let database = rows[0].dbname
        
        let output = ''
        /*
        output += 'DROP DATABASE IF EXISTS `'+ database+'`;\n'
        output += 'CREATE DATABASE `'+ database+'`;\n'
        output += 'USE `'+ database+'`;\n\n'
        */
        let [tables,views] = await this._getTableNames(database, excludeTables, includeTables)
        // this._log(`Found ${tables.length} tables in ${database}`)
        // this._log(`Found ${views.length} views in ${database}`)
        
        let structures = []
        if(exportSchema) {
            for (let table of tables) { // TODO: use parallelLimit
                let structure = await this._dumpStructure(table, database)
                structures.push(structure)
            }
            
            for (let view of views) { // TODO: use parallelLimit
                let structure = await this._dumpStructure(view, database)
                structures.push(structure)
            }
            
            if (sortKeys) {
                structures = structures.map(this._sortKeys)
            }
            
            if ((tables.length + views.length) !== structures.length) throw Error('Data inconsistency found!')
        }
    
        
        let data = []
        if(exportData){
            for (let table of tables) { // TODO: use parallelLimit
                let d = await this._dumpData(table, excludeColumns[table], reorderColumns[table], filterRows[table], maxChunkSize)
                data.push(d)
            }
    
            if (tables.length !== data.length) throw Error('Data inconsistency found!')
        }
    
        for (let i = 0; i < tables.length; i++) {
            if (exportSchema) output += structures[i] + '\n\n'
            if (exportData)   output += data[i] ? data[i] + '\n\n' : ''
        }
        
        
        return await this._save(output, dest, modifiers)
    }
    
    async _save(output, dest, modifiers){
        
        modifiers.forEach(modifier => { // add custom replacements
            output = modifier(output)
        })
        
        output = output.replace(/\r?\n/g, NEW_LINE)
        
        if(typeof dest === 'string'){
            await writeFileAsync(dest, output, 'utf8')
            this._log('The database is dumped: ' + dest)
        }
        
        await this.disconnect()
        
        return output
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
    
    async _dumpStructure(table, database){
        let SQL = 'SHOW CREATE TABLE `' + table + '`'
        let [results] = await this.connection.query(SQL)
        let rules = results[0]['Create Table'] || this._beautifyCreateView(results[0]['Create View'], database)
        if(!rules) console.error('Missing create table info for', table)
        let output = rules + ';'
        return output
    }
    
    async _dumpData(table, exclude = [], orderBy = '', filter = '', maxChunkSize = 1000){
        let columns = '*'
        let order = ''
        
        if(orderBy){
            order = 'ORDER BY ' + orderBy
        }
        
        if(exclude && exclude.length){
            let SQL_COLUMNS = 'SHOW COLUMNS FROM `' + table + '` WHERE Field NOT IN ("' + exclude.join('","') + '")'
    
            let [cols] = await this.connection.query(SQL_COLUMNS)
            columns = cols.map(r => r.Field)
            columns = '`' + columns.join('`, `') + '`'
        }
    
        filter = filter ? `AND (${filter})` : ''
        let SQL = `SELECT ${columns} FROM ${table} WHERE 1 ${filter} ${order}`
        
        let [results] = await this.connection.query(SQL)
        let output = this._buildInserts(results, table, maxChunkSize)
        return output
    }
    
    _buildInserts(rows, table, maxChunkSize = 1000) {
        if (!rows || !rows.length) return
        
        let sql = ''
        let chunks = Math.ceil(rows.length / maxChunkSize)
        
        for (let i = 0; i < chunks; i++) {
            let inserts = [];
            for (let j = 0; j < maxChunkSize; j++) {
                let row = rows[i*maxChunkSize +j];
                if(!row) break
    
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
                inserts.push('(' + values.join(', ') + ')');
            }
            // sql += 'TRUNCATE ' + table + ';\n';
            sql += 'INSERT INTO `' + table + '` (`' + Object.keys(rows[0]).join('`, `') + '`) VALUES\n' + inserts.join(',\n') + ';\n'

        }
        
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
   
    // Print some info if not in silent mode
    _log(log){
        if(!this.silent) console.log(log);
    }
    
}

module.exports = MySQLDumper