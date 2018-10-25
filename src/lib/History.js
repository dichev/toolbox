'use strict'

const fs = require('fs')

class History {
    
    constructor(cacheFile) {
        if(!cacheFile) throw Error('History: you must define a cacheFile where the history will be saved: '+ cacheFile)
        this.cacheFile = cacheFile
        this.commands = []
        this.pos = 0
        if(fs.existsSync(cacheFile)) {
            let cached = fs.readFileSync(cacheFile).toString().trim()
            this.commands = cached.split('\n').map(cmd => cmd.trim())
            this.pos = this.commands.length - 1
        }
        else {
            fs.writeFileSync(cacheFile, '') // Purposely try to create the file or throw error
        }
    }
    
    add(cmd){
        if(this.commands[this.commands.length - 1] !== cmd) {
            this.commands.push(cmd)
            fs.appendFileSync(this.cacheFile, cmd + '\r\n', null, () => {})
        }
        this.pos = this.commands.length - 1
    }
    
    prev(){
        // console.log('prev', this.pos, '\n')
        if(this.pos >= 0) {
            let cmd = this.commands[this.pos]
            this.pos--
            return cmd
        }
        return ''
    }
    
    next(){
        // console.log('next', this.pos, '\n')
        if (this.pos < this.commands.length - 1) {
            this.pos++
            let cmd = this.commands[this.pos]
            return cmd
        }
        return ''
    }
    
    
}

module.exports = History