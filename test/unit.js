'use strict'

const assert = require('assert')
const Tester = require('../src/tools/Tester')
const MySQL = require('../src/tools/MySQL')
const SSHClient = require('../src/tools/SSHClient')

let tester = new Tester()
let it = tester.it


it('detects not safe SQL statements', async () => {
    let mysql = new MySQL()
    
    let fails = [
        'DROP DATABASE dbname;',
        'SELECT 1; DROP DATABASE   dbname;',
        'DROP	DATABASE dbname;',
        'dRoP DATABaSE',
        `DROP
         DATABASE`,
    
        'DROP USER name;',
        'SELECT 1; DROP USER   name;',
        'DROP	USER name;',
        'dRoP useR',
        `DROP
         USER`,
        
        'TRUNCATE table;',
        'SELECT 1; TRUNCATE   table;',
        'TRUNCATE	table;',
        'truncate ',
        `TRUNCATE
         table`
    ]
    
    for(let sql of fails){
        assert.ok(mysql.isSafe(sql) === false, `${sql} is not detected as unsafe`)
    }
})


it('detects not safe rm -r commands', async () => {
    let ssh = new SSHClient()
    
    let fails = [
        'rm -rf /etc',
        'rm -r /root',
        'rm -fr /',
        'rm -r /home/dopamine/production',
        'rm -r /home/dopamine/production/*',
        'rm -r /opt/*',
        'rm -r /opt/',
        'rm -rf /home/dopamine/../',
        'echo test1 && rm -r /root || echo test2',
        'rm -r /root',
        'rm -rf /home/dopamine/something && echo 1 && rm -rf /',
        'rm -rf something',
        'cd /home/dopamine/.. && rm -rf something',
        // 'rm -f -r something', // TODO support it
    ]
    
    for(let sql of fails){
        assert.ok(ssh.isSafe(sql) === false, `${sql} is not detected as unsafe`)
    }
    
    let okays = [
        'rm -rf /home/dopamine/production/rtg',
        'rm -rf /opt/dopamine/axa',
        'cd /home/dopamine && rm -rf something',
        'cd /home/dopamine && rm -f -r something',
        'cd /opt/dopamine/sys-metrics && rm -rf /opt/dopamine/sys-metrics',
        'cd /home/dopamine && cd ../ && cd /opt/dopamine && rm -rf something',
    ]

    for(let sql of okays){
        assert.ok(ssh.isSafe(sql) === true, `${sql} is detected as unsafe, but should be okay`)
    }
})



tester.run(false)