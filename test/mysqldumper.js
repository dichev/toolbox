'use strict'

const MySQLDumper = require('../index').MySQLDumper
const fs = require('fs')
const DIR = __dirname + '/tmp'

if(!fs.existsSync(DIR)) fs.mkdirSync(__dirname + '/tmp')

MySQLDumper.dump({
	connection: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'platform',
    },
	
	dest: DIR + '/dump-schema.sql',
	
	excludeTables: ['users_default_bet_limits'],
	exportData: false,
    sortKeys: true,
}).catch(err => { throw err })

MySQLDumper.dump({
	connection: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'platform',
    },
	
	dest: DIR + '/dump-full.sql',
	
	excludeTables: ['users_default_bet_limits'],
	exportData: true
}).catch(err => { throw err })


MySQLDumper.dump({
    connection: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'platform',
    },
    
    dest: DIR + '/dump-ipguard-ranges.sql',
    
    includeTables: ['ipguard_ranges'],
    exportData: true,
    maxChunkSize: 10024,
}).catch(err => { throw err })