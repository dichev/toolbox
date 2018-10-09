'use strict'

//TODO: rename to Console
const colors = require('colors/safe') // check 'chalk' package

let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)

const _console = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
}

class Log {
    
    static verbose(...args){
        if (verbose) {
            _console.log.apply(_console, args.map(a => colors.gray(a)))
        }
    }
    
    static log(...args){
        _console.log.apply(_console, args)
    }
    static info(...args){
        _console.info.apply(_console, args.map(a => colors.white(a)))
    }
    static warn(...args){
        _console.warn.apply(_console, args.map(a => colors.yellow(a)))
    }
    static error(...args){
        _console.error.apply(_console, args.map(a => colors.red(a)))
    }
    
    static upgrade(){
        console.verbose = this.verbose
        console.log = this.log
        console.info = this.info
        console.warn = this.warn
        console.error = this.error
    }
}

module.exports = Log