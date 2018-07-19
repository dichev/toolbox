'use strict'

const colors = require('colors/safe') // check 'chalk' package
let verbose = (process.argv.findIndex(arg => arg === '-v' || arg === '--verbose') !== -1)


let testCases = []

/**
 * Super simple test framework without 1 million dependencies
 */
class Tester {
    
    
    static async run(errorOnFail = true){
        console.log(`\n# Running the test suit:`)
    
        let pass = 0
        let fail = 0
        
        while(testCases.length){
            let {title, fn} = testCases.shift()
            try {
                await fn()
                console.info(colors.green(`  [√] ${title}`))
                pass++
            } catch (err) {
                console.error(colors.red(`  [x] ${title}`))
                console.log(colors.gray('      ' + err.message || err.toString()))
                if(verbose && err.stack) console.log('      ' + colors.gray(err.stack.replace(/\n/g, '\n      ') + '\n'))
                fail++
            }
        }
    
        if(fail) console.log(colors.gray('\nRun --verbose mode to see the errors stack'))
        console.log(`----------------------------------------------\n`)
        if(pass) console.log(colors.green(`Passed ${pass} test cases`))
        if(fail) {
            if(errorOnFail) throw Error(`Failed ${fail} test cases`)
            console.log(colors.red(`Failed ${fail} test cases`))
        }
    }
    
    static add(title, fn){
        testCases.push({title, fn})
    }
    
    static it(title, fn){
        return Tester.add(title, fn)
    }
    
}


module.exports = Tester