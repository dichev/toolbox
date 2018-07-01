'use strict'

const Console = require('./lib/Console')
const Pattern = require('./lib/Pattern')
const Chain = require('./lib/Chain')
const SSHClient = require('./lib/SSHClient')
const program = require('commander')
const console = require('./lib/Log')

class App {
    
    constructor() {
        this.verbose = false
        this.params = {}
        this._pools = []
        this._loopBy = null
        
        program
            .option('-p, --parallel [limit]', 'When run with multiple hosts define how many commands to be executed in parallel. Set to 0 execute them all together. By default will be executed sequentially')
            .option('-i, --interactive', 'Turn ON the interactive mode')
            .option('-v, --verbose', 'Turn ON log details of whats happening')
            .option('-f, --force', 'Suppress confirm messages (used for automation)')
            .version(require('../package.json').version)
        
    }
    
    /**
     * @param {string} flags
     * @param {string} [description]
     * @param {string} [options]
     *    @option {string|function} [def]
     *    @option {array} [choices]
     *    @option {bool}  [loop]
     * @return App
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
     * @return App
     */
    loop(option = 'hosts'){
        this._loopBy = option
        return this
    }
    
   
    /**
     * @param {function} fn
     * @return App
     */
    async run(fn) {
        try {
            program.parse(process.argv)
            this.params = program.opts()
    
            let iterations = []
            let parallel = false
            let parallelLimit = 0
            
            if (typeof fn !== 'function') throw Error(`Invalid arguments! Expected deployer.run(async function), received deployer.run(${typeof fn})`)
            
            if (this.params.parallel !== undefined) {
                let limit = this.params.parallel === true ? 0 : parseInt(this.params.parallel)
                if(limit < 0) throw Error(`Invalid value of ${limit} for --parallel <limit>`)
                parallel = true
                parallelLimit = limit
            }
            
            if(this._loopBy) {
                let param = this.params[this._loopBy]
                if(!param) throw Error(`Invalid parameter option:(${this._loopBy})! It's expected to be array and to be predefined as cli option`)
    
                iterations = param.split(',')
            }
            
            
            if(!iterations.length){
                await fn()
            }
            else if(parallel){
                console.info(`\n-- Running in parallel(${parallelLimit}): ${iterations} -----------------------------------------`)
                let fnPromises = iterations.map(host => () => fn(host))
                await Chain.parallelLimit(parallelLimit, fnPromises)
            }
            else {
                for (let host of iterations) {
                    console.info(`\n-- ${host} -----------------------------------------`)
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
        let ssh = new SSHClient(this.verbose)
        await ssh.connect({
            host: host,
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