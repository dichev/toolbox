'use strict'

const readline = require('readline')
const spawn = require('child_process').spawn
const console = require('./Log')
const v = console.verbose

class Console {
    
    static info(msg){
        console.info(msg)
    }
    
    
    /**
     * @param {string} cmd
     * @return {Promise}
     */
    static async exec(cmd){
        return new Promise((resolve, reject) => {
            let bash = spawn('bash', ['-c', cmd], { stdio: [process.stdin, 'pipe', 'pipe']});
    
            let output = ''
            if(bash.stdout) bash.stdout.on('data', data => {
                output += data.toString()
                console.log(data.toString().trim())
            })
            if(bash.stderr) bash.stderr.on('data', data => {
                output += data.toString()
                console.warn(data.toString().trim())
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
    
    /**
     * @param {string} cmd
     * @return {Promise}
     */
    static async execDryMode(cmd) {
        console.log('$ ', cmd)
        return new Promise((resolve, reject) => setTimeout(resolve, 1000)).then(() => 'dry-mode')
    }
    
    static async confirm(question, def = 'yes', expect = ['yes', 'y']) {
        return new Promise((resolve, reject) => {
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            })
            
            rl.question(question, (answer) => {
                rl.close()
                
                answer = (answer || def).toLowerCase()
                
                console.log(answer)
                if(expect.includes(answer)){
                    resolve(answer)
                } else {
                    process.exit(0)
                }
            })
        })
    }
    
    static async ask(question, choices, def){
        return new Promise((resolve, reject) => {
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            })
            
            let msg = question
            if(choices && choices.length){
                msg += ` (${choices.join(',')}): `
            } else {
                msg += `: `
            }
            
            rl.question(msg, (answer) => {
                rl.close()
                
                if(!answer && def) {
                    answer = def || ''
                }
                if(choices && !choices.includes(answer)){
                    resolve(Console.ask(question, choices, def))
                } else {
                    resolve(answer)
                }
                
            })
            
            if(choices && def){
                rl.write(def)
            }
            
        })
    }
    
}

module.exports = Console