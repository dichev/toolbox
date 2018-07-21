'use strict'

const colors = require('colors/safe') // check 'chalk' package
let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)


let testCases = []

/**
 * Super simple test framework without 1 million dependencies
 */
class Tester {
    
    
    static async run(errorOnFail = true){
        console.log(`\n\n--- Running the test suit ---------------`)
    
        let pass = 0
        let fail = 0
        
        while(testCases.length){
            let {title, fn, type} = testCases.shift()
            try {
                if(type === 'info'){
                    console.info(`  [i] ${title}`)
                    await fn()
                }
                else {
                    await fn()
                    if(Tester.skipped) {
                        console.info(colors.gray(`  [-] ${title}`))
                        Tester.skipped = false
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
    
        if(pass) console.log(colors.green(`Passed ${pass} test cases`))
        if(fail) {
            if(errorOnFail) throw Error(`Failed ${fail} test cases`)
            console.log(colors.red(`Failed ${fail} test cases`))
            console.log(colors.gray('\nRun --verbose mode to see the errors stack'))
        }
        console.log(`----------------------------------------------\n\n`)
    }
    
    static add(title, fn, type){
        testCases.push({title, fn, type})
    }
    
    static it(title, fn, type = 'test'){
        return Tester.add(title, fn, type)
    }
    
    static skip(reason = ''){
        Tester.skipped = true
    }
    
    static info(title, fn) {
        return Tester.add(title, fn, 'info')
    }
    
}

// TODO: fix code completion
Tester.it = Tester.add
Tester.it.skip = Tester.skip
Tester.it.info = Tester.info


module.exports = Tester