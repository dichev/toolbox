'use strict'

const console = require('../lib/Console')
const v = console.verbose
const spawn = require('child_process').spawn
const colors = require('colors/safe')

const DRY_RUN = (process.argv.findIndex(arg => arg === '--dry-run') !== -1)

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
     * @param {boolean} [options.allowInDryRun]
     */
    async exec(cmd, {silent = false, allowInDryRun = false} = {}) {
        let isDryMode = DRY_RUN && !allowInDryRun
        if (this._cwd) cmd = `cd ${this._cwd} && ` + cmd
        v((isDryMode ? 'DRY RUN | ' : '') + this._cwd + '$' + cmd)
        if (isDryMode) return
        
        return new Promise((resolve, reject) => {
            let output = ''
            let stderr = ''
            let bash = spawn('bash', ['-e', '-c', cmd], {stdio: ['inherit', 'pipe', 'pipe']}) // Known-issue: with inherit, the terminal colors in Windows MinGW (mintty) will be broken and displayed as ANSI codes
            bash.stdout.setEncoding('utf8')
            bash.stderr.setEncoding('utf8')
            
            bash.stdout.on('data', data => {
                output += data
                if(!silent) process.stdout.write(data)
            })
            bash.stderr.on('data', data => {
                output += data
                stderr += data
                if(!silent) process.stdout.write(colors.yellow(data))
            })
            bash.on('error', (err) => console.error(err));
            bash.on('close', (code) => {
                if(code === 0){
                    resolve(output.trim())
                } else {
                    reject(stderr.trim() || 'Exit with code: ' + code)
                }
                
            })
        })
    }
    
    
}

module.exports = Shell