'use strict'

const Console = require('./Console')
const console = require('./Log')
const v = console.verbose

class Shell {
    
    constructor() {
        this._cwd = ''
    }
    
    
    /**
     * @param {string} dir
     * @return {string}
     */
    async chdir(dir) {
        this._cwd = await this.exec(`cd ${dir} && pwd`, { silent: true })
        return this._cwd
    }
    
    /**
     * @param {string} cmd
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {boolean} [options.allowInDryMode]
     */
    async exec(cmd, {silent = false, secret = false, allowInDryMode = false} = {}) {
        if (this._cwd) cmd = `cd ${this._cwd} && ` + cmd
        v(this._cwd)
        return Console.exec(cmd, { silent })
    }
    
    async execDryMode(cmd) {
        return Console.execDryMode(cmd)
    }
    
    async confirm(question, def = 'yes', expect = ['yes', 'y']) {
        return Console.confirm(question, def, expect)
    }
    
    async ask(question, choices, def){
        return Console.ask(question, choices, def)
    }
    
    
}

module.exports = Shell