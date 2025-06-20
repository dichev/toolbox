# Dopamine ToolBOX

A bunch of tools used to simplify the development of automation scripts and commands in NodeJS.

This document contains a list of code snippets and examples of how to use them. 
The additional options of each tool are (partially) documented only inside their source code, so please use IDE for code completion.
 
* **[Usage](#Usage)**
* **[Tools](#Tools)**
    * **[Program](#Program)**
    * **[Shell](#Shell)**
    * **[Tester](#Tester)**
    * **[SSHClient](#SSHClient)**
    * **[MySQL](#MySQL)**
    * **[MySQLDumper](#MySQLDumper)**
* **[Plugins](#Plugins)**
    * **[GoogleChat](#GoogleChat)**
    * **[HipChat](#HipChat)**
    * **[Cloudflare](#Cloudflare)**
* **[Lib](#Lib)**
    * **[Console](#Console)**
    * **[Logger](#Logger)**
* **[Known Issues](#KnownIssues)**

## Usage

Note all examples use **async await**, so to be able to test, just wrap them inside this construction:
```javascript
#!/usr/bin/env node
'use strict';

;(async () => {
    
    // now you can write "await" code
    // put example code here..
    
})().catch(console.error).then(() => console.log('done'))
``` 
If you use the Program tool, you could wrap them there:
```javascript
#!/usr/bin/env node
'use strict';

const Program = require('../index').Program
let program = new Program()
program.run(async () => {
    // now you can write "await" code
    // put example code here..
    // the errors will be catched by the program
})
```


## <a name="Tools"></a>Tools

#### <a name="Program"></a>Program 
This is the must-have lib for all commands. 
It's responsible for parsing cli arguments, generating help, running in parallel, etc. 
If it is used, then your script will directly support the following cli arguments:
```bash
  Additional Options:
    -p, --parallel [limit]  When run with multiple hosts define how many commands to be executed in parallel. Set to 0 execute them all together. By default will be executed sequentially
    -v, --verbose           Turn ON log details of whats happening
    -f, --force             Suppress confirm messages (used for automation)
    -n, --dry-run           Dry run mode will do everything as usual except commands execution
    -q, --quiet             Turn off chat and some logs in stdout
    --wait <int>            Pause between iterations in seconds
    --announce              Announce what and why is happening and delay the execution to give time to all to prepare
    --no-chat               Disable chat notification if they are activated
    -h, --help              output usage information
```


Here is an example of how to make a basic command:
```javascript
#!/usr/bin/env node
'use strict';
const Program = require('dopamine-toolbox').Program

let program = new Program()

program
    .description('Testing script')
    .option('-h, --hosts <list|all>', 'The target host names', {choices: ['hostA', 'hostB']})
    .run(async () => {
        console.log('Hello!')
        console.log('Passed parameters:', program.params)
    })
```
Save it as example.js, and then you are ready to run in shell:
```bash
node example.js --help
node example.js --hosts hostA,hostB
node example --hosts all
./example --hosts hostA
```

If you want to run your command multiple times over a list of arguments, then try this 

```javascript
#!/usr/bin/env node
'use strict';
const Program = require('dopamine-toolbox').Program

let program = new Program()

program
    .description('Testing script')
    .option('-h, --hosts <list|all>', 'The target host names', { required: true, choices: ['hostA', 'hostB']})
    .iterate('hosts', async (host) => {
        console.log('Hey, working on host:', host)
    })
```
Save it as example.js and then run:
```bash
node example --hosts all
node example --hosts all --parallel
```

Here is an example of how some useful commands should look:
```javascript
const Program = require('dopamine-toolbox').Program
const HOSTS = ['dev-hermes-web1.out','dev-hermes-web2.out']

let program = new Program()

program
    .description('Checking are sys-metrics active on given hosts')
    .option('-h, --hosts <list|all>', 'The target host names', { choices: HOSTS, required: true })
    .example(`
        node test/dev --hosts dev-hermes-web1.out,dev-hermes-web2.out
        node test/dev --hosts dev-hermes-*
        node test/dev --hosts all
    `)
    
    .iterate('hosts', async (host) => {
        
        await program.shell().exec('date')
        
        let ssh = await program.ssh(host, 'root')
    
        if (await ssh.exists('/opt/dopamine/sys-metrics')) {
            await ssh.chdir('/opt/dopamine/sys-metrics')
            await ssh.exec('git describe --tags')
            await ssh.exec('systemctl status sys-metrics | grep Active')
        }
        else {
            console.info('Oups, there are no sys-metrics here..')
        }
    })

```

#### <a name="Shell"></a>Shell 
Local machine shell executor (using bash)
```javascript
const Shell = require('dopamine-toolbox').Shell

let shell = new Shell()
await shell.exec('echo "Start execution at $(date)"')
await shell.chdir('../')
await shell.exec(`
    echo "this is a multi-line shell script"
    echo "working directory is: $(pwd)"
`)
```
The execution will be done in **bash with "set -e" mode activated** (to avoid mistakes in multi-line scripts)

The shell doesn't support any fancy functions like shell.git(), shell.find(), shell.mkdir(), etc. by reason.
The idea is to not abstract the standard shell commands and to let sysadmin guys to write automation in the way they know best, aka piping

#### <a name="Input"></a>Input 
Provide async methods for user cli input
```javascript
const Input = require('dopamine-toolbox').Input

let input = new Input()
let answer = await input.ask('What color?', ['yellow', 'blue', 'green'], 'green')
await input.confirm('Are you sure you want to continue?')
console.log('continue only if is confirmed')
```
Optionally, the typed answers could be saved between sessions in a file. 
This is very useful to store commands history, like in shell
```javascript
const Input = require('../').Input

let input = new Input({collectHistoryFile: __dirname + '/.history'})
await input.ask('Type any command')
console.log('doing some work..')
await input.ask('Type another command')
console.log('doing some work..')
await input.ask('Press <up> and <down> to see the previous commands')
```

Aliases:
```javascript
const Program = require('dopamine-toolbox').Program
let program = new Program()

let answer = await program.ask('Choose color', ['yellow', 'blue', 'green'], 'green')
await program.confirm('Are you sure you want to continue?')
console.log('continue only if is confirmed')
```


#### <a name="Tester"></a>Tester 
Super simple test framework without one million dependencies
```javascript
const Tester = require('dopamine-toolbox').Tester
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
```

#### <a name="SSHClient"></a>SSHClient 
Adapter over ssh2 lib - https://github.com/mscdex/ssh2


Basically, it supports async await methods, and it has built-in protection against "rm -rf"
```javascript
const SSHClient = require('dopamine-toolbox').SSHClient

let ssh = new SSHClient()
await ssh.connect({ // for all connection options see: https://www.npmjs.com/package/ssh2#client-methods
    host: 'dev-hermes-web1.out',
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
await ssh.disconnect()
```
The execution will be done **with "set -e" mode activated** for multi-line scripts to avoid mistakes

#### <a name="MySQL"></a>MySQL 
Adapter over mysql2 lib: https://www.npmjs.com/package/mysql2

It has built-in protection against DROP DATABASE statements and server overloading
```javascript
const MySQL = require('dopamine-toolbox').MySQL
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
```
#### <a name="MySQLDumper"></a>MySQLDumper 
This is customized for our needs mysql dumper. It supports useful options for:
- Flexible table/columns excluding
- SSH connections
- Output modifiers (like sorted keys)
- Export data/schema beautification
- Exporting as a readable stream (useful for huge databases)

```javascript
const MySQLDumper = require('dopamine-toolbox').MySQLDumper
const MySQL = require('dopamine-toolbox').MySQL

let db = new MySQL().connect({ host: 'localhost', user: 'root', password: '', database: 'mysql' })
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
```

### <a name="Plugins"></a>
Plugins are just adapters to the API of external third-party services
#### <a name="GoogleChat"></a>GoogleChat

```javascript
const GoogleChat = require('dopamine-toolbox').plugins.GoogleChat

// you can get the urlToken from Google Chat app -> Configure webhooks 
let urlToken = 'https://chat.googleapis.com/v1/spaces/{SPACE}/messages?key={KEY}&token={TOKEN}'

let chat = new GoogleChat(urlToken, 'SomeThread', true)

await chat.message('Some message with simple *md formatting*')
await chat.error('Fatal Error!', `Missing required configuration or something`)
await chat.warn('Aborting', `This env is used already on live, so for security reasons the command is disabled for it`)
await chat.announce('Release bundle is ready for deploy', {
    title: 'r3.10.5.1',
    icon: GoogleChat.icons.PACKAGE,
    bold: false,
    buttons: [{
        "text": "Change Log",
        "url": "https://example.com/CHANGELOG"
    }]
})
await chat.json({ text: 'anything' }) // you can pass here any raw json from google chat docs 
```
#### <a name="HipChat"></a>HipChat

```javascript
const HipChat = require('dopamine-toolbox').plugins.HipChat
let urlToken = 'https://dopaminebg.hipchat.com/v2/room/{ROOM}/notification?auth_token={TOKEN}'

let chat = new HipChat(urlToken)
await chat.notify('Hey!')
await chat.notify('Hey again!', {color: 'green', popup: true, format: 'html', silent: false})
```

#### <a name="CloudFlare"></a>CloudFlare
```javascript
const CloudFlare = require('dopamine-toolbox').plugins.CloudFlare

let cf = new CloudFlare(zone, email, key)
await cf.get(url)
await cf.get(url)
await cf.post(url, json)
await cf.put(url, json)
await cf.delete(url, json)
await cf.patch(url, json)

```
## <a name="Lib"></a>Lib
#### <a name="Console"></a>Console
This is an extended version of the js console. It basically colorizes it and adds in addition console. Verbose method
```javascript
const console = require('dopamine-toolbox').lib.console

console.log('normal output')
console.info('colorize in white')
console.warn('colorize in yellow')
console.error('colorize in red')
console.verbose('this will be shown only when -v, --verbose param is passed')
```
If you don't want to include it in each module, then you can just override the js console:
```javascript
require('dopamine-toolbox').lib.console.upgrade()
```


#### <a name="Logger"></a>Logger
This is the class used to log deploy info in a database.
You can use it separately, but it's implemented in Program.js to be used in an automation project to log the deployment process.
```javascript
// variant 1
new Program({logs: cfg.logs})

// variant 2
let config = {    
    "mysql": {
       "host": "127.0.0.1",
       "user": "root",
       "password": "",
       "database": "envs",
       "ssh": false
    }
};
let logger = new Logger(config)
logger.start(info)
logger.end(exitCode, msg)
```
You need to set up a database to use the database. You can find schema and seed in **./.db/deploy_log.sql**


## <a name="KnownIssues"></a>Known Issues

- Some colors in the shell are displayed as ANSI codes in Windows MinGW64 (mintty)
```bash
?[32m hey, I am green ?[39m
```
This happens when a child process has colors, and its stdio is attached to the parent process. It seems to be a limitation of the terminal emulator, so the best way to fix it is to switch to [ConEmu](https://conemu.github.io/)

