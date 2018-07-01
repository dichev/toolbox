'use strict'


let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)

class Log {
    
    static verbose(...args){
        if (verbose) {
            console.log.apply(console, args)
        }
    }
    
    static log(...args){
        console.log.apply(console, args)
    }
    static info(...args){
        console.info.apply(console, args)
    }
    static warn(...args){
        console.warn.apply(console, args)
    }
    static error(...args){
        console.error.apply(console, args)
    }
    
}

module.exports = Log