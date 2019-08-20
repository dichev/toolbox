'use strict'
/**
 * @typedef {Object|null} Params
 * @property {int} parallel
 * @property {boolean} verbose
 * @property {boolean} force
 * @property {boolean} dryRun
 * @property {boolean} quiet
 * @property {boolean} announce
 * @property {boolean} chat
 */

const Input = require('./tools/Input')
const Shell = require('./tools/Shell')
const Tester = require('./tools/Tester')
const MySQL = require('./tools/MySQL')
const SSHClient = require('./tools/SSHClient')
const console = require('./lib/Console')
const colors = require('chalk')
const Pattern = require('./lib/Pattern')
const Logger = require('./lib/Logger')
const Chain = require('./lib/Chain')
const Chat = require('./plugins/GoogleChat')
const commander = require('commander')
const os = require('os')
const isWin = os.platform() === 'win32'
const titleCase = (str) => str.replace(/\b\S/g, t => t.toUpperCase())
const stripAnsi = require('strip-ansi')
const fs = require('fs')

class Program {
    
    constructor({chat = null, smartForce = false, logs = null } = {}) {
 
        /** @type Params **/
        this.params = null
        this._description = ''
        this._icon = ''
        this._usage = ''
        this._exampleUsage = ''
        this._pools = { ssh: [], db: []}
        this._dryRun = false
        this._requiredFlags = []
        this._smartForce = smartForce
        this._interruptCounter = 0
        this.isRun = false
        this._deployUser = (logs && logs.deployUser) ? logs.deployUser : (process.env.DOPAMINE_SSH_USER || os.userInfo().username)

        /** @type GoogleChat **/
        this.chat = new Chat(chat, this.name.command + new Date().toJSON().slice(0, 10), false)
        this.logger = new Logger(logs)
    
        process.on('uncaughtException', async (err) => await this._uncaughtException(err))
        process.on('unhandledRejection', async (reason) => await this._uncaughtRejection(reason))
        process.on('SIGINT', async () => await this._onInterruptSignal());
    }
    
    /**
     * @param {string} url
     * @return {Program}
     */
    icon(url){
        this._icon = Chat.icons.DEPLOY
        return this
    }
    
    /**
     * @param {string} text
     * @return {Program}
     */
    description(text){
        commander.description(text)
        this._description = text
        return this
    }
    
    /**
     * @param {string} text
     * @return {Program}
     */
    example(text){
        this._exampleUsage = text
        return this
    }
    
    /**
     * @return Array<string>
     */
    get args(){
        return commander.args
    }
    
    /**
     * @param {string} flags
     * @param {string} [description]
     * @param {string} [options]
     *    @option {string|function} [def]
     *    @option {array} [choices]
     *    @option {bool}  [loop]
     * @return {Program}
     */
    option(flags, description = '', { def, choices, required } = {}){
        if (def && choices) {
            if(def === 'all') def = choices.join(',')
            else if (!choices.includes(def)) throw Error(`The default option(${def}) is not allowed as choices`)
        }
        if(choices) description += `. Available: ${choices}`
        if(required) {
            description = '[required] ' + description
            let parts = flags.split(', ')
            this._usage += (parts[1] || parts[0]) + ' '
            this._requiredFlags.push(flags)
        }

        commander.option(flags, description, (val) => {
            if (!choices || !Array.isArray(choices) || !choices.length) return val
            let values = val.split(',')
            
            if(values.includes('all')) {
                values = [].concat(choices).concat(values.filter(v => v !== 'all'))
            }
            
            let excluded = values.filter(v => v.startsWith('-')).map(v => v.substr(1))
            let included = values.filter(v => !v.startsWith('-'))
            
            excluded = Pattern.intersect(excluded, choices, true)
            included = Pattern.intersect(included, choices, true)
            
            val = included.filter(v => !excluded.includes(v)).join(',')
            return val
        }, def)
        
        return this
    }
    
    parse(){
        if(this.params) return this // already parsed
        
        commander
            .option('-p, --parallel [limit]', 'When run with multiple hosts define how many commands to be executed in parallel. Set to 0 execute them all together. By default will be executed sequentially')
            // .option('-i, --interactive', 'Turn ON the interactive mode')
            .option('-v, --verbose', 'Turn ON log details of whats happening')
            .option('-f, --force', 'Suppress confirm messages (used for automation)')
            .option('--dry-run', 'Dry run mode will do everything as usual except commands execution')
            .option('--quiet', 'Turn off chat and some logs in stdout')
            .option('--wait <int>', 'Pause between iterations in seconds')
            .option('--announce [text]', 'Announce what and why is happening. If there is no [text] value then it will be asked interactively (useful for avoiding escaping issues)')
            .option('--delayed [minutes]', 'Delay starting of the command (useful in combination with announce)')
            .option('--jira [text]', 'Jira ticket id is used for logging purposes.')
            .option('--no-chat', 'Disable chat notification if they are activated')

        commander.usage(this._usage)
        if (this._exampleUsage) {
            commander.on('--help', () => {
                console.log('\n  Example usage:')
                console.log(this._exampleUsage.trim().split('\n').map(s => '    ' + s.trim()).join('\n'));
            })
        }
    
        // ugly but it works as once Niki said
        commander.helpInformationOrigin = commander.helpInformation
        commander.helpInformation = () => {
            let help = commander.helpInformationOrigin()
            help = help.replace(/(Usage:) (\S+)/, '$1 node ' + this.name.command + '/' + this.name.action)
            help = help.replace(/(Options:\n)\n/, '$1')
            help = help.replace(/( {2}-p, --parallel)/, '\nAdditional Options:\n$1')
            return help
        }
    
        commander.parse(process.argv)
        this.params = commander.opts()
        
        // START Read param from file
        for ( let paramName in this.params ){
            let param = this.params[paramName]
            if(typeof param === 'string'){
                if(param.substr(0,1) === '@'){
                    this.params[paramName] = fs.readFileSync(param.substr(1)).toString()
                }
            }
        }
        // END Read param from file

        if (commander.dryRun) {
            console.info('============== DRY RUN =============')
            this._dryRun = true
        }
    
        for (let flags of this._requiredFlags) {
            let option = commander.options.find(o => o.flags === flags)
            if (this.params[option.attributeName()] === undefined) {
                throw Error(`Missing required parameter: ${flags}`)
            }
        }
    
        if (this.params.parallel !== undefined) {
            let limit = this.params.parallel === true ? 0 : parseInt(this.params.parallel)
            if (limit < 0) throw Error(`Invalid value of ${limit} for --parallel <limit>`)
            this.params.parallel = limit
        }
        
        if(this.params.chat === false){
            this.chat.enabled = false
        }
        
        console.verbose('Parsed params:')
        console.verbose(this.params)
        
        return this
    }
    
    /**
     * @param {function} fn
     * @return {Program}
     */
    async run(fn) {
        try {
            this.parse()
            if (typeof fn !== 'function') throw Error(`Invalid arguments! Expected program.run(async function), received program.run(${typeof fn})`)
        
            await this._before()
            await fn()
            this.destroy()
            await this._after()
        }
        catch (err) {
            await this._errorHandler(err)
        }
        
        
        return this
    }
   
    /**
     * @param {string} loopBy
     * @param {function} fn
     * @return {Program}
     */
    async iterate(loopBy, fn) {
        try {
            // Validations
            this.parse()
            
            if (typeof fn !== 'function' || typeof loopBy !== 'string') throw Error(`Invalid arguments! Expected program.iterate(string, async function), received program.run(${loopBy}, ${typeof fn})`)
            if(!this.params[loopBy]) throw Error(`Invalid parameter option:(${loopBy})! It's expected to be array and to be predefined as program option.`)
        
            let quiet = this.params.quiet || false
            let parallel = this.params.parallel !== undefined
            let parallelLimit = this.params.parallel || 0
            let iterations = this.params[loopBy].split(',')
        
            if (this._smartForce && !this.params.force && iterations.length >= 3) {
                let answer = await this.ask(`It seems there are ${iterations.length} iterations. Do you want to activate --force mode?`, ['yes', 'no'], 'yes')
                if (answer === 'yes') this.params.force = true
            }
    
            // Execution
            await this._before()
            
            if(parallel){
                if (!quiet) console.log(colors.gray(`\n-- Running in parallel(${parallelLimit}): ${iterations} -----------------------------------------`))
                await Chain.parallelLimitMap(parallelLimit, 0.100, iterations, async host => {
                    if (!quiet) await this.chat.message(`*Executing on ${host}*`, {silent: true})
                    return fn(host)
                })
                this.destroy() // TODO: could keep open a lot connections
            }
            else {
                let i = 0
                let total = iterations.length
                for (let host of iterations) {
                    if (!quiet && total > 1) {
                        console.log(colors.gray(`\n-- ${host} -----------------------------------------`))
                        await this.chat.message(`*${++i}/${total} Executing on ${host}*`, { silent: true })
                    }
                    await fn(host)
                    if(this.params.wait && total > 1) {
                        if (!quiet) await this.chat.message(`Waiting between iterations (${this.params.wait} sec)`, { silent: true })
                        await this.sleep(this.params.wait, 'waiting')
                    }
                    this.destroy()
                }
            }
    
            await this._after()
        }
        catch (err) {
            await this._errorHandler(err)
        }
        return this
    }
    
    async _before(){
        if(this.isRun) throw Error('The program is already running. Please avoid executing program.run() or program.iterate() again during their execution')
        this.isRun = true
        
        if(!this.params.quiet) {
            let link = this.chat.enabled ? this.getCommandSourceCodeUrl() : null
            let args = process.argv.slice(2).map(a=>a.includes(' ') ? '"' + a + '"': a).join(' ')
            let code = `$ ${this.name.command} ${this.name.action} ${args}`
            let delay = 0
            let msg = ''
            
            if(this._description){
                msg += this._description + '<br/><br/>'
            }
            
            if(this.params.announce) {
                let announce;
                if(this.params.announce === true) { // no params
                    announce = await this.ask('Announce')
                } else {
                    announce = this.params.announce.trim()
                }

                if (announce) {
                    msg += `<b>Announce:</b> ${announce}<br/>`
                }
            }
            // TODO: may be use handlebars templates
            for(let [key, val] of Object.entries(this.params)){
                if(!val && val !== 0) continue
                if(['verbose', 'quiet', 'chat', 'announce'].includes(key)) continue
                if(key === 'parallel') {
                    val = val === 0 ? 'true' : val + ' at same time'
                } else if (key === 'wait'){
                    val = `${val}s between iterations`
                }
                msg += `<b>${titleCase(key)}:</b> `
                if(typeof val === 'string' && val.includes(',')){
                    msg += `<br/>` + val.split(',').map((name, i) => `• ${name}`).join('<br/>') + '<br/>'
                } else {
                    msg += `${val}<br/>`
                }
            }
            
            
            let delayed = this.params.delayed
            if(delayed === undefined && this.params.announce === true){ // special case where the command is called only with this arg: --announce
                delayed = await this.ask('Delay (2min)', null, 2)
            }
            if(delayed) {
                let seconds = 0
                let minutes = parseInt(delayed)
    
                if (minutes > 0) {
                    let now = new Date()
                    seconds = (60 - now.getSeconds())
                    now.setSeconds(0)
                    now.setMinutes(now.getMinutes() + minutes) // TODO what if 59 + 2
                    msg += `<b>Schedule:</b> ${now.toTimeString().substr(0, 8)} (after ${minutes} min)<br/>`
                    delay = minutes * 60 + seconds
                }
            }
            
            
            // await this.chat.message('```'+ code+'```')
            await this.chat.message('`' + code + '`' + (link ? ` <${link}|see code>` : ''), { silent: true })
            await this.chat.announce(msg, {
                title: titleCase(this.name.command + ' ' + this.name.action) + ' ' + (this.params.rev || this.params.tag || this.params.version || ''),
                subtitle: 'by ' + this._deployUser,
                silent: true,
                popup: true,
                bold: false,
                icon: this._icon || Chat.icons.GEAR,
                // buttons: [{ text: 'see code', url: link }]
            })

            if (delay) {
                await this.sleep(delay, 'Waiting..')
                await this.chat.message('Executing..', { popup: true })
            }
        }

        await this.logger.start({
            startAt: new Date(),
            endAt: null,
            status: 'IN_PROGRESS',
            action: 'node ' + this.name.command + '/' + this.name.action + ' ' +
                (this.params.rev || this.params.tag || this.params.version || '') +
                ' ' + process.argv.slice(2).join(' '),
            jiraTicketId: this.params.jira ? 'https://jira.dopamine.bg/browse/' + this.params.jira : null,
            user: this._deployUser,
            debugInfo: JSON.stringify(this.params),
        })
    }
    
    
    async _after(){
        if(!this.params.quiet) {
            await this.chat.message(`✓ Finished!`, {color: 'green', silent: true })
        }
        await this.logger.end(0, 'Finished')
        this.isRun = false
    }
    
    async confirm(question, def = 'yes', expect = ['yes', 'y']) {
        if(this.params && this.params.force){
            console.log(question, 'yes (force)')
            return
        }
        return new Input().confirm(question, def, expect)
    }
    
    async ask(question, choices, def){
        let input = new Input()
            return await input.ask(question, choices, def)
    }
    
    /**
     * @deprecated
     * @param {string} host
     * @param {string} user
     * @param {string} [cmd]
     * @return {Promise<SSHClient>|null}
     */
    async ssh(host, user, cmd = ''){
        let ssh = new SSHClient()
        await ssh.connect({
            host: host,
            username: user,
            agent: isWin ? 'pageant' : process.env.SSH_AUTH_SOCK,
            agentForward: true
        })
    
        this._pools.ssh.push(ssh)
        
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
            this._pools.ssh.push(ssh)
            return ssh
        }
    }
    
    /**
     * @deprecated
     * @param {object} cfg
     * @return {Promise<MySQL>}
     */
    async mysql(cfg = {}) {
        let db = new MySQL()
        let ssh = null
        if(cfg.ssh) {
            if(cfg.ssh instanceof SSHClient) ssh = cfg.ssh
            else ssh = await this.ssh(cfg.ssh.host, cfg.ssh.user)
        }
        await db.connect(cfg, ssh)
        this._pools.db.push(db)
        return db
    }
   
    /**
     * @deprecated
     * @return Shell
     */
    shell(){
        return new Shell()
    }
    
    /**
     * @deprecated
     * @param {string} [prefix] - used when run in parallel mode
     * @return {Tester}
     */
    tester(prefix = ''){
        let parallel = this.params.parallel !== undefined
        return new Tester(parallel ? prefix : '', parallel)
    }

    
    destroy(){
        while (this._pools.db.length) {
            this._pools.db.shift().disconnect()
        }
        while (this._pools.ssh.length) {
            this._pools.ssh.shift().disconnect()
        }
    }
    
    
    sleep(sec = 1, msg = '') {
        if (msg) console.info(msg, `(${sec}s)`)
        return new Promise((resolve) => setTimeout(resolve, sec * 1000))
    }
    
    /**
     * @return {{command: string, action: string}}
     */
    get name() {// TODO: this is temporary until migration to program cli
        let parts = process.argv[1].replace(/\\/g, '/').split('/')
        let action = parts.pop().replace('.js', '')
        let command = parts.pop()
        return {command,action}
    }
    
    getCommandSourceCodeUrl(){
        let gitlabUrl = ''
        try {
            gitlabUrl = require(process.cwd() + '/package.json').repository.url
        } catch (err) {
            // well it can't work always, but that's fine ;)
            console.verbose('[expected] Attempted to find the command repository url, but failed with following error:', err.toString())
            return
        }
    
        let parts = process.argv[1].replace(/\\/g, '/').split('/')
        let file = parts.slice(parts.length - 3).join('/')
        if (!file.endsWith('.js')) file += '.js'
    
        return gitlabUrl.replace(/.git$/, '/blob/master/' + file)
    }
    
    
    /**
     * @param {Error} err
     * @param {String} type
     * @private
     */
    async _errorHandler(err, type = '') {
        let msg = err.message || err.toString()
        if(type) msg = type + ' | ' + msg
        console.error(msg)
        if(err.stack) console.verbose(err.stack)
        
        if(this.isRun) {
            this.destroy()
            if(this.chat.enabled || this.logger.enabled) {
                msg = stripAnsi(msg).replace(/\n/g, '<br/>')
                this.chat.error(`${this.name.action} | Aborting due error`, msg, {silent: true, popup: true}).catch(console.error)
                this.logger.end(1, 'Aborting due error: ' + console.error)
                await new Promise((resolve) => setTimeout(() => process.exit(1), 1000)) // TODO: the chat and logger should be in parent process to avoid this timeout
            } else {
                process.exit(1)
            }
        } else {
            console.log('Please see --help')
            process.exit(1)
        }
    }
    
    /**
     * @param {Error} err
     * @private
     */
    async _uncaughtRejection(err) {
        console.warn(`WARNING! Found uncaughtRejection of promise, during catching/handling such error the execution will continue for a short period and this could be kind of dangerous!`)
        // proccess.exit(1) // if we just stop the process here we will have an illusion of control - even if the process is stopped asap, the next events/promises would still be in execiting state causing unpredictable behavouir. This happens most likelye due forgotten await statement without catcher
        
        // redirect it to the error handler to at least track the error
        await this._errorHandler(err, 'uncaughtPromiseRejection')
    }
    
    /**
     * @param {Error} err
     * @private
     */
    async _uncaughtException(err) {
        await this._errorHandler(err, 'uncaughtException')
    }
    
    /**
     * @param {Error} err
     * @private
     */
    async _onInterruptSignal(err) {
        if (++this._interruptCounter <= 1) {
            console.warn('Caught interrupt signal, aborting gracefully (press again in emergency)');
            await this._errorHandler(new Error('Aborted by user (ctrl + c)'))
        } else {
            console.warn('Caught second interrupt signal! Emergency exit..');
            process.exit(1)
        }
    }
    
}

module.exports = Program