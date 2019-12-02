#!/usr/bin/env node
'use strict';

;(async () => {

    {
        const calc = require('../').lib.Utils
        console.log(calc.generatePassword(10,20))
    }

    {
        const Input = require('../').Input

        let input = new Input()
        let answer = await input.ask('Choose color', ['yellow', 'blue', 'green'], 'green')
        await input.confirm('Are you sure you want to continue?')
        console.log('continue only if is confirmed')
    }
    
    {
        const Input = require('../').Input

        let input = new Input({collectHistoryFile: __dirname + '/.history'})
        await input.ask('Type any command')
        console.log('doing some work..')
        await input.ask('Type another command')
        console.log('doing some work..')
        await input.ask('Press <up> and <down> to see the previous commands')
    }

    {
        const Program = require('../').Program
        let program = new Program()

        let answer = await program.ask('Choose color', ['yellow', 'blue', 'green'], 'green')
        await program.confirm('Are you sure you want to continue?')
        console.log('continue only if is confirmed')
    }
    
    {
        const Shell = require('../').Shell

        let shell = new Shell()
        await shell.exec('echo "Start execution at $(date)"')
        await shell.chdir('../')
        await shell.exec(`
            set -e
            echo "this is a multi-line shell script"
            echo "working directory is: $(pwd)"
        `)

        console.log('Creating folder test123')
        await shell.exec('mkdir test123')
        console.log('Check if exists: ', await shell.exists('test123'))
        console.log('Deleting folder test123')
        await shell.exec('rm -rf test123')

    }
   
    {
        const Tester = require('../').Tester
        const assert = require('assert')

        let tester = new Tester()
        let it = tester.it

        it(`should be equal`, async () => assert.strictEqual(5 * 5, 25))
        it.warn(`have precision troubles`, async () => assert.strictEqual(0.1 + 0.2, 0.3))
        it.info(`diffs between releases:`, async () => console.info('some useful information'))
        it(`could be skipped`, async () => {
            if (true) return it.skip()
            // test here will be skipped
        })

        await tester.run(false)
    }
    
    {
        const SSHClient = require('../').SSHClient

        let ssh = new SSHClient()
        await ssh.connect({
            host: 'sofia-dev-web1.out',
            username: 'dopamine',
            agent: 'pageant',
            agentForward: true
        })
        await ssh.chdir('/home/dopamine')
        await ssh.exec('echo $PWD && ls -lah')
        let file = '/home/dopamine/testfile'
        if(!await ssh.exists(file)){
            await ssh.writeFile(file, 'some data')
        }
        console.log(await ssh.readFile(file))
        await ssh.exec(`rm -v ${file}`)

        console.log("await ssh.packageExists('git')")
        console.log(await ssh.packageExists('git') === true)

        await ssh.disconnect()
    }
    

    {
        const Program = require('../').Program
        let program = new Program()

        let ssh = await program.ssh('sofia-dev-web1.out', 'dopamine')
        await ssh.chdir('/home')
        await ssh.exec('echo $PWD && ls -lah')
        await ssh.disconnect()
    }

    {
        const MySQL = require('../').MySQL
        let db = new MySQL()

        await db.connect({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'mysql',
        })
        let rows = await db.query('SELECT host, user FROM user')
        console.log(rows)

        db.highLoadProtection({ connections: 100, interval: 2 })
        await db.disconnect()
    }

    {
        const Program = require('../').Program
        let program = new Program()

        let db = await program.mysql({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'mysql',
        })
        let rows = await db.query('SELECT host, user FROM user')
        console.log(rows)
        await db.disconnect()
    }
    
    {
    
        const MySQLDumper = require('dopamine-toolbox').MySQLDumper
        const MySQL = require('dopamine-toolbox').MySQL
    
        let db = new MySQL().connect({host: 'localhost', user: 'root', password: '', database: 'mysql'})
        let dumper = new MySQLDumper(db)
    
        await dumper.dump({ // or use the shorthand: await db.dump({
        
            dest: './dump.sql',
        
            modifiers: [
                (output) => output.replace(/ AUTO_INCREMENT=\d+/g, '')
            ],
        
            excludeTables: ['innodb_index_stats', 'innodb_table_stats'],
            excludeColumns: {
                'help_topic': ['example', 'description']
            },
            sortKeys: true,
            exportData: true // be careful with this option on mirrors
        
            // more options:
            //   includeTables = []
            //   excludeColumns = {}
            //   reorderColumns = {}
            //   filterRows = {}
            //   maxChunkSize = 1000
            //   exportGeneratedColumnsData = false
            //   returnOutput = false
        })

    }
    
    {

        const Program = require('../').Program

        let program = new Program()

        program
            .description('Testing script')
            .option('-h, --hosts <list|all>', 'The target host names', {choices: ['hostA', 'hostB']})
            .run(async (host) => {
                console.log('Hello!')
            })

    }
    
    {
        const console = require('../').lib.console
        console.log('normal output')
        console.info('colorize in white')
        console.warn('colorize in yellow')
        console.error('colorize in red')
        console.verbose('this will be shown only when -v, --verbose param is passed')
    }
    
})().then(() => console.log('done')).catch(console.error)