'use strict'

const colors = require('colors/safe') // check 'chalk' package
let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)


let report = {pass: 0, fail: 0}


/**
 * Super simple test framework without 1 million dependencies
 */
class Tester {
    
    constructor(prefix = ''){
        this.testCases = []
        
        this.isRunning = false
        this.prefix = prefix ? `[${prefix}] ` : ''
        this._skipped = false
        
        // TODO: fix code completion
        this.it = this.add.bind(this)
        this.it.skip = this.skip.bind(this)
        this.it.info = this.info.bind(this)
    }
    
    async run(errorOnFail = true){
        if(this.isRunning) return // could happen in parallel execution
        this.isRunning = true
        console.log(`\n\n--- Running the test suit ---------------`)
    
        let pass = 0
        let fail = 0
        
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
                        console.info(colors.gray(`  [-] ${title}`))
                        this._skipped = false
                    } else {
                        console.info(colors.green(`  [√] ${title}`))
                    }
                }
                pass++
            } catch (err) {
                console.error(colors.red(`  [x] ${title}`))
                console.log(colors.gray('      ' + err.message || err.toString()))
                if(verbose && err.stack) console.log('      ' + colors.gray(err.stack.replace(/\r?\n/g, '\n      ') + '\r\n'))
                fail++
            }
        }
    
        report.pass += pass
        report.fail += fail
        if(errorOnFail) this.status()
       
        console.log(`----------------------------------------------\n\n`)
        this.isRunning = false
        return { fail, pass }
    }
    
    /**
     * @return {{fail: number, pass: number}}
     */
    status(errorOnFail = true){
        let {pass, fail} = report
        
        if (pass) console.log(colors.green(`Passed ${pass} test cases`))
        if (fail) {
            if (errorOnFail) throw Error(`Failed ${fail} test cases`)
            console.log(colors.red(`Failed ${fail} test cases`))
            console.log(colors.gray('Run --verbose mode to see the errors stack'))
        }
        return report
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
    
}




module.exports = Tester