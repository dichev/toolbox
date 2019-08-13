'use strict'

//TODO: rename to Console
const colors = require('chalk')
const stripAnsi = require('strip-ansi')
const EventEmitter = require('events').EventEmitter

let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)

const _console = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
}

/** @type module:events.internal.EventEmitter **/
let _emitter = null

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
        Console._emit('WARN', ...args)
    }
    static error(...args){
        _console.error.apply(_console, args.map(a => colors.red(a)))
        Console._emit('ERROR', ...args) // do not make it lowercase
    }
    
    
    static on(eventName, listener){
        if(!_emitter) return this.warn('console.on() - The console.upgrade() is NOT invoked')
        return _emitter.on(eventName, listener)
    }
    static once(eventName, listener){
        if (!_emitter) return this.warn('console.on() - The console.upgrade() is NOT invoked')
        return _emitter.once(eventName, listener)
    }
    static off(eventName, listener){
        if (!_emitter) return this.warn('console.on() - The console.upgrade() is NOT invoked')
        return _emitter.off(eventName, listener)
    }
    static _emit(eventName, ...args){
        if(!_emitter) return
        return _emitter.emit(eventName, ...args.map(stripAnsi))
    }
    
    
    static upgrade(){
        if(this._upgraded) return this.warn('The console.upgrade() is already invoked! Please check for wrong code flow..')
        this._upgraded = true

        // do not bind Console here (to preserve the stack tree)
        console.verbose = this.verbose
        console.log = this.log
        console.info = this.info
        console.warn = this.warn
        console.error = this.error
    
        _emitter = new EventEmitter()
    }
    
}

// just map all other console functions for compatibility
Object.keys(console)
      .filter(key => typeof console[key] === 'function' && !Console[key])
      .forEach(key => Console[key] = console[key].bind(console))


module.exports = Console