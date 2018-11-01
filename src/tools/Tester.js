'use strict'

const colors = require('colors/safe') // check 'chalk' package
let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)


let report = {pass: 0, fail: 0, warn: 0}


/**
 * Super simple test framework without 1 million dependencies
 */
class Tester {
    
    /**
     * @return {{fail: number, pass: number}}
     */
    static report(errorOnFail = true) {
        let {pass, fail, warn} = report
    
        console.log(`\n\n----------------------------------------------`)
    
        if (pass) console.log(colors.green(`Passed ${pass} test cases`))
        if (warn) console.log(colors.yellow(`Warning on ${warn} test cases`))
        if (fail) {
            if (errorOnFail) throw Error(`Failed ${fail} test cases`)
            console.log(colors.red(`Failed ${fail} test cases`))
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
        if(!this.silent) console.log(`\n--- Running test suit: ${suitName} ---------------`)
    
        let pass = 0
        let fail = 0
        let warn = 0
        
        while(this.testCases.length){
            let {title, fn, type} = this.testCases.shift()
            try {
                if(type === 'info'){
                    console.info(`  [i] ${title}`)
                    await fn()
                }
                else {
                    await fn()
                    if(this._skipped) {
                        console.log(colors.gray(`  [-] ${title}`))
                        this._skipped = false
                    } else {
                        console.log(colors.green(`  [√] `) + title)
                    }
                }
                pass++
            } catch (err) {
                if(type === 'warn'){
                    console.warn(colors.yellow(`  [!] `) + title)
                    warn++
                } else {
                    console.error(colors.red(`  [x] ${title}`))
                    fail++
                }
                console.log(colors.gray(err.message || err.toString()))
                if(verbose && err.stack) console.log('      ' + colors.gray(err.stack.replace(/\r?\n/g, '\n      ') + '\r\n'))
            }
        }
    
        report.pass += pass
        report.fail += fail
        report.warn += warn
        if(errorOnFail) this.status(true)
    
        // if (!this.silent) console.log(`----------------------------------------------\n`)
        this.isRunning = false
        return { fail, pass, warn }
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