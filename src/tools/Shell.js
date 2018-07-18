'use strict'

const console = require('../lib/Log')
const v = console.verbose
const spawn = require('child_process').spawn

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
        
        // TODO: dry mode
        // return new Promise((resolve, reject) => setTimeout(resolve, 1000)).then(() => 'dry-mode')
        
        return new Promise((resolve, reject) => {
            let bash = spawn('bash', ['-c', cmd]); // , { stdio: [process.stdin, 'pipe', 'pipe']} <- this totally breaks shell colors
    
            let output = ''
            if(bash.stdout) bash.stdout.on('data', data => {
                output += data.toString()
                if(!silent) console.log(data.toString().trim())
            })
            if(bash.stderr) bash.stderr.on('data', data => {
                output += data.toString()
                if(!silent) console.warn(data.toString().trim())
            })
            bash.on('error', (err) => console.error(err));
            bash.on('close', (code) => {
                if(code === 0){
                    resolve(output.trim())
                } else {
                    reject('Error code: ' + code)
                }
                
            });
            // bash.stdin.write(cmd + '\n')
            // bash.stdin.end()
        })
    }
    
    
}

module.exports = Shell