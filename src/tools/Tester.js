'use strict'

const colors = require('colors/safe') // check 'chalk' package
let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)


let report = {pass: 0, fail: 0, warn: 0, text: { full: '', failed: '', summary: '' }}


/**
 * Super simple test framework without 1 million dependencies
 */
class Tester {
    
    /**
     * @return {{fail: number, pass: number, warn: number, text: { full: string, failed: string, summary: string }}}
     */
    static report(errorOnFail = true) {
        let {pass, fail, warn} = report
    
        console.log(`\n\n----------------------------------------------`)
        report.text.summary = `\n\n----------------------------------------------\n`
    
        if (pass) {
            console.log(colors.green(`Passed ${pass} test cases`))
            report.text.summary += `Passed ${pass} test cases\n`
        }
        if (warn) {
            console.log(colors.yellow(`Warning on ${warn} test cases`))
            report.text.summary += `Warning on ${warn} test cases\n`
        }
        if (fail) {
            if (errorOnFail) throw Error(`Failed ${fail} test cases\n`)
            console.log(colors.red(`Failed ${fail} test cases`))
            report.text.summary += `Failed ${fail} test cases\n`
            console.log(colors.gray('Run --verbose mode to see the errors stack'))
        }
        
        return report
    }
    
    constructor(prefix = '', silent = false){
        this.testCases = []
        
        this.isRunning = false
        this.prefix = prefix ? `[${prefix}] ` : ''
        this._skipped = false
        this.silent = silent
        
        // TODO: fix code completion
        this.it = this.add.bind(this)
        this.it.add = this.add.bind(this)
        this.it.skip = this.skip.bind(this)
        this.it.info = this.info.bind(this)
        this.it.warn = this.warn.bind(this)
    }
    
    async run(errorOnFail = true, suitName = ''){
        if(this.isRunning) return // could happen in parallel execution
        this.isRunning = true
    
    
        if (!this.silent) console.log(`\n--- ${this.prefix} Running test suit: ${suitName} ---------------`)
        
        while(this.testCases.length){
            let {title, fn, type} = this.testCases.shift()
            try {
                if(type === 'info'){
                    this._collect(title, 'info')
                    await fn()
                }
                else {
                    await fn()
                    if(this._skipped) {
                        this._collect(title, 'skip')
                        this._skipped = false
                    } else {
                        this._collect(title, 'pass')
                    }
                }
            } catch (err) {
                if(type === 'warn'){
                    this._collect(title, 'warn')
                } else {
                    this._collect(title, 'fail')
                }
                this._collect(err.message || err.toString(), 'fail_details')
                if(verbose && err.stack) console.log('      ' + colors.gray(err.stack.replace(/\r?\n/g, '\n      ') + '\r\n'))
            }
        }
    
        if(errorOnFail) this.status(true)
    
        // if (!this.silent) console.log(`----------------------------------------------\n`)
        this.isRunning = false
        return report
    }
    
    _collect(msg, type){
        let text = ''
        
        switch (type){
            
            case 'info':
                console.info(`  [i] ${msg}`)
                report.pass++
                break;
            
            case 'skip':
                text = `  [-] ${msg}`
                console.log(colors.gray(text))
                report.pass++
                break;
            
            
            case 'pass':
                text = `  [√] ${msg}`
                console.log(colors.green(`  [√] `) + msg)
                report.pass++
                break;
            
            
            case 'warn':
                text = `  [!] ${msg}`
                console.warn(colors.yellow(`  [!] `) + msg)
                report.warn++
                break;
            
            
            case 'fail':
                text = `  [x] ${msg}`
                console.error(colors.red(text))
                report.text.failed += text.trim() + '\n'
                report.fail++
                break;
            
            
            
            case 'fail_details':
                text = msg
                console.log(colors.gray(msg))
                report.text.failed += text + '\n'
                break;
        }
        
        report.text.full += text + '\n'
    }
    
    
    /**
     * @return {{fail: number, pass: number}}
     */
    status(errorOnFail = true){
        return Tester.report()
    }
    
    
    add(title, fn, type = 'test'){
        title = this.prefix + title
        this.testCases.push({title, fn, type})
    }
    
    skip(reason = ''){
        this._skipped = true
    }
    
    info(title, fn) {
        return this.add(title, fn, 'info')
    }
    
    warn(title, fn) {
        return this.add(title, fn, 'warn')
    }
    
}




module.exports = Tester