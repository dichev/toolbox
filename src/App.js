'use strict'

const Config = require('./config/Config')
const Console = require('./lib/Console')
const Pattern = require('./lib/Pattern')
const SSHClient = require('./lib/SSHClient')
const program = require('commander')
const fs = require('fs')


class App {
    
    constructor() {
        this.params = {}
        this._pools = []
        this._loopBy = null
        
        program
            .option('-p, --parallel [limit]', 'When run with multiple hosts define how many commands to be executed in parallel. Set to 0 execute them all together. By default will be executed sequentially')
            .option('-i, --interactive', 'Turn ON the interactive mode')
            .option('-f, --force', 'Suppress confirm messages (used for automation)')
            .option('-c, --config <path>', 'Path to custom config file')
            .version(require('../package.json').version)
        
    }
    
    /**
     * @param {string} flags
     * @param {string} [description]
     * @param {string} [options]
     *    @option {string|function} [def]
     *    @option {array} [choices]
     *    @option {bool}  [loop]
     * @return this
     */
    option(flags, description = '', { def, choices } = {}){
        program.option(flags, description, (val) => {
            if(!choices || !Array.isArray(choices) || !choices.length) return val
            if(val === 'all') return choices.join(',')
            let values = val.includes(',') ? val.split(',') : [val]
            val = Pattern.intersect(values, choices, true).join(',')
            return val
        }, def)
        
        return this
    }
    
    /**
     * @param {string}   option - specify by which option to loop, normally is 'hosts'
     * @return this
     */
    loop(option = 'hosts'){
        this._loopBy = option
        return this
    }
    
   
    /**
     * @param {function} fn
     * @return this
     */
    async run(fn) {
        try {
            program.parse(process.argv)
            this.params = program // TODO: temporary, we should expose only the parsed arguments, see console.log(program)
    
            let HOSTS = null
            
            if (typeof fn !== 'function') throw Error(`Invalid arguments! Expected deployer.run(async function), received deployer.run(${typeof fn})`)
            if (this.params.parallel !== undefined) throw Error(`TODO: support parallelism`)
            
            if(this._loopBy) {
                let param = this.params[this._loopBy]
                if(!param) throw Error(`Invalid parameter option:(${this._loopBy})! It's expected to be array and to be predefined as cli option`)
                
                HOSTS = param.split(',')
            }
            
            
            if(!HOSTS){
                await fn()
            }
            else {
                for (let host of HOSTS) {
                    if (HOSTS.length > 1) {
                        console.log(`\n-- ${host} -----------------------------------------`)
                    }
                    await fn(host)
                }
            }
        }
        catch (err) {
            this._errorHandler(err)
        }
        this.destroy()
        
        return this
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
     * @return {Promise<SSHClient>}
     */
    async ssh(host, user){
        let cfg = Config.servers.find(s => s.name === host)
        if(!cfg) throw Error('There is no such server in our configuration: ' + host)
        
        let ssh = new SSHClient(host)
        await ssh.connect({
            host: cfg.ip,
            username: user,
            agent: 'pageant',
            agentForward: true
        })
    
        this._pools.push(ssh)
        
        
        return ssh
    }
    
    
    /**
     * @return Console
     */
    async bash(){
        return Console
    }
    
    destroy(){
        while (this._pools.length) {
            this._pools.shift().disconnect()
        }
    }
    
    
    _errorHandler(err) {
        console.error('ERROR:', err)
        this.destroy()
        process.exit(1)
    }
    
}

module.exports = App