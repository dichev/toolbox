'use strict'

const readline = require('readline')
const console = require('../lib/Log')
const v = console.verbose

class Input {
    
    static info(msg){
        console.info(msg)
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
                    resolve(Input.ask(question, choices, def))
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

module.exports = Input