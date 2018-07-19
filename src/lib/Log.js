'use strict'

//TODO: rename to Console
const colors = require('colors/safe') // check 'chalk' package

let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)

class Log {
    
    static verbose(...args){
        if (verbose) {
            console.log.apply(console, args.map(a => colors.gray(a)))
        }
    }
    
    static log(...args){
        console.log.apply(console, args)
    }
    static info(...args){
        console.info.apply(console, args.map(a => colors.green(a)))
    }
    static warn(...args){
        console.warn.apply(console, args.map(a => colors.yellow(a)))
    }
    static error(...args){
        console.error.apply(console, args.map(a => colors.red(a)))
    }
    
}

module.exports = Log