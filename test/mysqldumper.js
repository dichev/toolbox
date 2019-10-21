'use strict'

const MySQL = require('../index').MySQL
const MySQLDumper = require('../index').MySQLDumper
const verboseLevel = require('../index').lib.Utils.getVerboseLevel()
const fs = require('fs')
const DIR = __dirname + '/tmp'

if(verboseLevel === 0) throw Error('Please run the test with verbose parameter: -v')

if(!fs.existsSync(DIR)) fs.mkdirSync(__dirname + '/tmp')

;(async () => {
    
    // Test static
    await MySQLDumper.dump({
        connection: {
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'mysql',
        },
        
        dest: DIR + '/dump-full.sql',
        
        excludeTables: ['innodb_index_stats', 'innodb_table_stats'],
        excludeColumns: {
            'help_topic': ['example', 'description']
        },
        
        maxChunkSize: 100,
        exportData: true,
        sortKeys: true,
    })
    
    
    // Test as MySQL
    let db = await new MySQL().connect({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'mysql',
    })
    
    
    // Test from MySQL
    await db.dump({
        dest: DIR + '/dump-full.sql',
        
        excludeTables: ['innodb_index_stats', 'innodb_table_stats'],
        excludeColumns: {
            'help_topic': ['example', 'description']
        },
    
        maxChunkSize: 100,
        exportData: true,
        sortKeys: true,
    })
    
    
    // Test as object
    let dumper = new MySQLDumper(db)

    // Test as promise
    await dumper.dump({
        dest: DIR + '/dump-schema.sql',
    
        excludeTables: ['innodb_index_stats'],
        exportSchema: true,
        exportData: false,
    })
    
    // Test as stream
    let stream = dumper.dumpStream({
        dest: DIR + '/dump-help.sql',
    
        includeTables: ['help_category'],
        exportSchema: true,
        exportData: true,
    })
    
    for await (let chunk of stream) {
        console.log(chunk.toString())
    }

    await db.disconnect()

})()