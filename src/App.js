'use strict'

const Config = require('./config/Config')
const Console = require('./lib/Console')
const SSHClient = require('./lib/SSHClient')
const program = require('commander')


class App {
    
    constructor() {
        this.params = {}
        
        program
            .option('-i, --interactive', 'Turn ON the interactive mode')
            .option('-f, --force', 'Suppress confirm messages (used for automation)')
            .option('-c, --config <path>', 'Path to custom config file')
            .version(require('../package.json').version)
        
    }
    
    /**
     * @param {string} flags
     * @param {string} [description]
     * @param {string|function} [def] function or default
     * @returns {Command} for chaining
     */
    option(flags, description, def){
        program.option(flags, description, def)
        return this
    }
    
    /**
     * @param {function} fn
     * @return boolean
     */
    async run(fn){
        program.parse(process.argv)
        this.params = program // TODO: temporary, we should expose only the parsed arguments, see console.log(program)
        
        try {
            await fn()
        } catch (err) {
            console.error(err)
            return false
        }
        console.log('time to kill')
        SSHClient.killThemAll()
        return true
    }
    
    async exec(cmd){
        return Console.exec(cmd)
    }
    
    async confirm(question, def = 'yes', expect = ['yes', 'y']) {
        return Console.confirm(question, def, expect)
    }
    
    async ask(question, choices, def){
        return Console.ask(question, choices, def)
    }
    
    /**
     * @return {Promise<SSH>}
     */
    async ssh(host, user){
        let cfg = Config.servers.find(s => s.name === host)
        if(!cfg) throw Error('There is no such server in our configuration:' + host)
        
        let ssh = new SSHClient(host)
        await ssh.connect({
            host: cfg.ip,
            username: user,
            agent: 'pageant',
            agentForward: true
        })
        
        return ssh
    }
    
    
    /**
     * @return Console
     */
    async log(){
        return Console
    }
    
}

module.exports = App