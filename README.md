# Dopamine ToolBOX

A bunch of tools used to simplify the development of automation scripts and commands in NodeJS.

This document contains a list of code snippets and examples how to use them. 
The additional options of each tool is (partially) documented only inside their source code, so please use IDE for code completion.
 
* **[Usage](#Usage)**
* **[Tools](#Tools)**
    * **[Program](#Program)**
    * **[Shell](#Shell)**
    * **[Tester](#Tester)**
    * **[SSHClient](#SSHClient)**
    * **[MySQL](#MySQL)**
    * **[MySQLDumper](#MySQLDumper)**
* **[Plugins](#Plugins)**
    * **[HipChat](#HipChat)**
    * **[Cloudflare](#Cloudflare)**
* **[Lib](#Lib)**
    * **[Console](#Console)**

## Usage

Note all examples use **async await**, so to be able to test just wrap them inside this construction:
```javascript
#!/usr/bin/env node
'use strict';

;(async () => {
    
    // now you can write "await" code
    // put example code here..
    
})().catch(console.error).then(() => console.log('done'))
``` 
If you use the Program tool you could wrap them there:
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

##### <a name="Program"></a>Program 
This is the must have lib for all commands. 
It's responsible for parsing cli arguments, generating help, running in parallel, etc.. 
If it is used then your script will directly support following cli arguments:
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


Here is example how to made very simple command:
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
Save it as example.js and then you are ready to run in shell:
```bash
node example.js --help
node example.js --hosts hostA,hostB
node example --hosts all
./example --hosts hostA
```

If you want to run you command multiple times over list of arguments then try this 

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

Here is an example how some useful command should look:
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

##### <a name="Shell"></a>Shell 
Local machine shell executor (using bash)
```javascript
const Shell = require('dopamine-toolbox').Shell

let shell = new Shell()
await shell.exec('echo "Start execution at $(date)"')
await shell.chdir('../')
await shell.exec(`
    set -e
    echo "this is a multi-line shell script"
    echo "working directory is: $(pwd)"
`)
```
Note the shell doesn't support any fancy functions like shell.git(), shell.find(), shell.mkdir(), etc.. by reason.
The idea is to not abstract the standard shell commands and to let sysadmin guys to write automation in the way the know best, aka piping

##### <a name="Input"></a>Input 
Provide async methods for user cli input
```javascript
const input = require('dopamine-toolbox').Input

let answer = await input.ask('What color?', ['yellow', 'blue', 'green'], 'green')
await input.confirm('Are you sure you want to continue?')
console.log('continue only if is confirmed')
```
Aliases:
```javascript
const Program = require('dopamine-toolbox').Program
let program = new Program()

let answer = await program.ask('Choose color', ['yellow', 'blue', 'green'], 'green')
await program.confirm('Are you sure you want to continue?')
console.log('continue only if is confirmed')
```


##### <a name="Tester"></a>Tester 
Super simple test framework without 1 million dependencies
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

##### <a name="SSHClient"></a>SSHClient 
Adapter over ssh2 lib - https://github.com/mscdex/ssh2

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

##### <a name="MySQL"></a>MySQL 
Adapter over mysql2 lib: https://www.npmjs.com/package/mysql2
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
##### <a name="MySQLDumper"></a>MySQLDumper 
This is customized for our needs mysql dumper. It supports useful options for:
- Flexible table/columns excluding
- SSH connections
- Output modifiers (like sorted keys)
- Export data/schema beautification

```javascript
const dump = require('dopamine-toolbox').MySQLDumper.dump
await dump({
    connection: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'mysql',
        ssh: null
    },

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
})
```

### Plugins
Plugins are just adapters to the API of external third party services
##### <a name="HipChat"></a>HipChat

```javascript
const HipChat = require('dopamine-toolbox').plugins.HipChat
let urlToken = 'https://dopaminebg.hipchat.com/v2/room/{ROOM}/notification?auth_token={TOKEN}'

let chat = new HipChat(urlToken)
await chat.notify('Hey!')
await chat.notify('Hey again!', {color: 'green', popup: true, format: 'html', silent: false})
```

##### <a name="CloudFlare"></a>CloudFlare
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
## Lib
##### <a name="Console"></a>Console
This is extended version of the js console. It basically colorize it and add in addition console.verbose method
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







































