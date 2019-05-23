'use strict'

const readline = require('readline')
const console = require('../lib/Console')
const History = require('../lib/History')
const v = console.verbose

class Input {
    
    constructor({collectHistoryFile = null} = {}){
        this.history = collectHistoryFile ? new History(collectHistoryFile) : null
    }
    
    async confirm(question, def = 'yes', expect = ['yes', 'y']) {
        return new Promise((resolve, reject) => {
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: true,
            })
            
            rl.question(question, (answer) => {
                answer = answer.replace(new RegExp(/`/, 'g'), '')
                rl.close()
                
                answer = (answer || def).toLowerCase().trim()
                
                console.log(answer)
                if(expect.includes(answer)){
                    resolve(answer)
                } else {
                    process.exit(0)
                }
            })
        })
    }
    
    async ask(question, choices, def){
        return new Promise((resolve, reject) => {
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: true, // when the readline is called from child process, then rl.write doesn't display the written characters without this option
            })
            
            let msg = question
            if(choices && choices.length){
                msg += ` (${choices.join(',')}): `
            } else {
                msg += `: `
            }
    
    
            let listener
            if(this.history) {
                listener = (s, key) => {
                    if (key.name === 'up' || key.name === 'down') {
                        rl.write(null, {ctrl: true, name: 'u'}); // this will clear the current input
                        let cmd = key.name === 'up' ? this.history.prev() : this.history.next()
                        rl.write(cmd)
                    }
                }
                process.stdin.on('keypress', listener)
            }
    
            rl.question(msg, (answer) => {
                console.verbose({answer})
                rl.close()
                if (this.history) process.stdin.removeListener('keypress', listener)
               
                if(!answer && def) {
                    answer = def || ''
                }
                if(choices && !choices.includes(answer)){
                    resolve(this.ask(question, choices, def))
                } else {
                    if(this.history) this.history.add(answer)
                    resolve(answer)
                }
                
            })
            
            if(choices && def){
                rl.write(def)
            }
            
        })
    }
    
    async askMultiline(question, choices, def){
        return new Promise((resolve, reject) => {
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: true, // when the readline is called from child process, then rl.write doesn't display the written characters without this option
            })
            
            let msg = question
            if (choices && choices.length) {
                msg += ` (${choices.join(',')}): `
            } else {
                msg += `: `
            }
            
            let listener
            if (this.history) {
                listener = (s, key) => {
                    if (key.name === 'up' || key.name === 'down') {
                        rl.write(null, {ctrl: true, name: 'u'}); // this will clear the current input
                        let cmd = key.name === 'up' ? this.history.prev() : this.history.next()
                        rl.write(cmd)
                    }
                }
                process.stdin.on('keypress', listener)
            }
            
            rl.prompt(msg)
            let input = []
            rl.on('line', function (cmd) {
                cmd = cmd.replace(new RegExp(/`/, 'g'), '')
                input.push(cmd.trim())
                if (cmd === ';' || ~cmd.indexOf(';')) rl.close()
            });
            
            rl.on('close', () => {
                if(this.history) this.history.add(input.join(' '))
                resolve(input.join(' '))
            });
            
            rl.on('SIGINT', () => {
                rl.clearLine(0)
                rl.clearLine(0)
                rl.question('Ctrl+C recieved! Are you sure you want to exit? ', (answer) => {
                    if (answer.match(/^y(es)?$/i)) reject('User cancel');
                });
            });
            
            if (choices && def) {
                rl.write(def)
            }
        })
    }
}

module.exports = Input