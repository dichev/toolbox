'use strict'

const Input = require('./tools/Input')
const Shell = require('./tools/Shell')
const Tester = require('./tools/Tester')
const MySQL = require('./tools/MySQL')
const SSHClient = require('./tools/SSHClient')
const console = require('./lib/Log')
const Pattern = require('./lib/Pattern')
const Chain = require('./lib/Chain')
const HipChat = require('./plugins/HipChat')
const program = require('commander')
const os = require('os')
const isWin = os.platform() === 'win32'

class App {
    
    constructor({chatToken = null } = {}) {
        this.params = {}
        this._description = ''
        this._pools = []
        this._loopBy = null
        this._dryMode = false
        
        this.chat = new HipChat(chatToken)
        
        program
            .option('-p, --parallel [limit]', 'When run with multiple hosts define how many commands to be executed in parallel. Set to 0 execute them all together. By default will be executed sequentially')
            .option('-i, --interactive', 'Turn ON the interactive mode')
            .option('-v, --verbose', 'Turn ON log details of whats happening')
            .option('-f, --force', 'Suppress confirm messages (used for automation)')
            .option('-n, --dry-run', 'Dry run mode will do everything as usual except commands execution')
            .version(require('../package.json').version)
    
        process.on('uncaughtException', (err) => this._errorHandler(err))
        process.on('unhandledRejection', (reason) => this._errorHandler(reason))
    }
    
    /**
     * @param text
     * @return {App}
     */
    description(text){
        program.description(text)
        this._description = text
        return this
    }
    
    /**
     * @param {string} flags
     * @param {string} [description]
     * @param {string} [options]
     *    @option {string|function} [def]
     *    @option {array} [choices]
     *    @option {bool}  [loop]
     * @return {App}
     */
    option(flags, description = '', { def, choices } = {}){
        if (def && choices) {
            if (!choices.includes(def)) throw Error(`The default option(${def}) is not allowed as choices`)
        }
        if(choices) description += ` Available: ${choices}`
        

        program.option(flags, description, (val) => {
            if (!choices || !Array.isArray(choices) || !choices.length) return val
            if (val === 'all') return choices.join(',')
            let values = val.includes(',') ? val.split(',') : [val]
            val = Pattern.intersect(values, choices, true).join(',')
            return val
        }, def)
        
        return this
    }
    
    /**
     * @param {string}   option - specify by which option to loop, normally is 'hosts'
     * @return {App}
     */
    loop(option = 'hosts'){
        this._loopBy = option
        return this
    }
    
   
    /**
     * @param {function} fn
     * @return {App}
     */
    async run(fn) {
        try {
            program.parse(process.argv)
            this.params = program.opts()
            if(program.dryRun){
                console.info('============== DRY RUN =============')
                this._dryMode = true
            }
    
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
            
            
            // await this.chat.notify(`${host} | Running fo`)
            await this.chat.notify(`${this.actionName} | RUN: ${this._description} (by ${os.userInfo().username})`)
            
            if(!iterations.length){
                await fn()
            }
            else if(parallel){
                console.info(`\n-- Running in parallel(${parallelLimit}): ${iterations} -----------------------------------------`)
                let fnPromises = iterations.map(host => async () => {
                    await this.chat.notify(`${this.actionName} | Executing on ${host}..`)
                    return fn(host)
                })
                await Chain.parallelLimit(parallelLimit, fnPromises)
            }
            else {
                for (let host of iterations) {
                    console.info(`\n-- ${host} -----------------------------------------`)
                    await this.chat.notify(`${this.actionName} | Executing on ${host}..`)
                    await fn(host)
                }
            }
        }
        catch (err) {
            await this._errorHandler(err)
        }
        this.destroy()
        await this.chat.notify(`${this.actionName} | Finished!`, {color: 'green'})
        
        return this
    }
    
    async confirm(question, def = 'yes', expect = ['yes', 'y']) {
        return Input.confirm(question, def, expect)
    }
    
    async ask(question, choices, def){
        return Input.ask(question, choices, def)
    }
    
    /**
     * @param {string} host
     * @param {string} user
     * @param {string} [cmd]
     * @return {Promise<SSHClient>|null}
     */
    async ssh(host, user, cmd = ''){
        let ssh = new SSHClient(this._dryMode)
        await ssh.connect({
            host: host,
            username: user,
            agent: isWin ? 'pageant' : process.env.SSH_AUTH_SOCK,
            agentForward: true
        })
    
        this._pools.push(ssh)
        
        if(cmd){
            try {
                await ssh.exec(cmd)
            } catch (err) {
                await ssh.disconnect()
                throw err
            }
            return null
        }
        else {
            this._pools.push(ssh)
            return ssh
        }
    }
    
    /**
     * @param {object} cfg
     * @return {MySQL}
     */
    async mysql(cfg = {}) {
        let db = new MySQL(this._dryMode)
        let ssh = null
        if(cfg.ssh) {
            if(cfg.ssh instanceof SSHClient) ssh = cfg.ssh
            else ssh = await this.ssh(cfg.ssh.host, cfg.ssh.user)
        }
        await db.connect(cfg, ssh)
        return db
    }
   
    /**
     * @return Shell
     */
    shell(){
        return new Shell()
    }
   
    /**
     * @return Tester
     */
    get tester(){
        return Tester
    }

    
    destroy(){
        while (this._pools.length) {
            this._pools.shift().disconnect()
        }
    }
    
    get actionName() { // TODO: this is temporary until migration to deployer cli
        let parts = process.argv[1].replace(/\\/g, '/').split('/')
        let action = parts.pop().replace('.js', '')
        let command = parts.pop()
        return `$ ${command} ${action}`
    }
    
    /**
     * @param {Error} err
     * @private
     */
    _errorHandler(err) {
        let msg = err.message || err.toString()
        console.error(msg)
        if(err.stack) console.verbose(err.stack)
        
        this.destroy()
        this.chat.notify(`${this.actionName} | Aborting due error: <br/> ${msg.replace(/\n/g, '<br/>')}`, {color: 'red'}).catch(console.error)
        setTimeout(() => process.exit(1), 500)
    }
    
}

module.exports = App