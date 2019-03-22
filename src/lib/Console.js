'use strict'

//TODO: rename to Console
const colors = require('chalk')

let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)

const _console = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
}

class Console {
    
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

// just map all other console functions for compatibility
Object.keys(console)
      .filter(key => typeof console[key] === 'function' && !Console[key])
      .forEach(key => Console[key] = console[key].bind(console))


module.exports = Console