'use strict'

const sleep = (sec) => new Promise(resolve => setTimeout(resolve, sec * 1000))

class Chain {
    
    /**
     * @param {int} limit=1
     * @param {int} delay=0 - specify delay in seconds between every next promise. Used for throttling reasons
     * @param {Array} array - iterative array that contains a list of values to be passed as value to the promise fn
     * @param {Function} fn - function to be executed that return a promise
     * @return {Promise.<*>}
     */
    static async parallelLimitMap(limit = 1, delay = 0, array, fn) {
        let fns = array.map(v => async () => await fn(v))
        let chain = new Chain(fns)
        let results = await chain.parallelLimit(limit, delay)
        return results
    }
    
    /**
     * @param {Array<Function>} fnPromises - array of functions which returns promises
     * @return {Array} of all promises results
     */
    constructor(fnPromises) { // check is fn, not promise
        if(!fnPromises || !Array.isArray(fnPromises) || !fnPromises.length) return []
        if(typeof fnPromises[0] !== 'function') throw Error('The fnPromises must be array of functions which returns promises (note array of functions, not array of promises because they should not be called instantly)')
        
        this.fnPromises = fnPromises
        this.results = []
    }
    
    /**
     * @param {int} limit - if is set to 0, then there will be no limit (will fallback to Promise.all)
     * @param {int} delay=0 - specify delay in seconds between every next promise. Used for throttling reasons
     * @return {Array} of all promises results
     */
    async parallelLimit(limit, delay = 0){
        if(limit < 0) throw Error(`Wrong usage of parallelLimit, the limit(${limit}) should be greater or equal to 0`)
        if(limit === 0) return Promise.all(this.fnPromises.map(async (fn, i) => {
            await sleep(i * delay)
            return fn()
        }))
    
        let chains = [];
        for (let i = 0; i < limit; i++) {
            chains.push(this._next(i * delay));
        }
    
        await Promise.all(chains)
        let results = this.results
        this.results = null // cleanup just in case
        return results
    }
    
   
    async _next(delay = 0) {
        await sleep(delay)
        let promise = this.fnPromises.shift()
        
        if(promise){
            let res = await promise()
            this.results.push(res)
            
            return this._next()
        } else {
            return Promise.resolve()
        }
    }
    
    
}

module.exports = Chain