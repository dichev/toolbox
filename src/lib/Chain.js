'use strict'

class Chain {
    
    /**
     * @param {int} limit=1
     * @param {Array<Function>} fnPromises - array of functions which returns promises
     * @return {Promise.<*>}
     */
    static async parallelLimit(limit = 1, fnPromises) {
        let chain = new Chain(fnPromises)
        let results = await chain.parallelLimit(limit)
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
     * @return {Array} of all promises results
     */
    async parallelLimit(limit){
        if(limit < 0) throw Error(`Wrong usage of parallelLimit, the limit(${limit}) should be greater or equal to 0`)
        if(limit === 0) return Promise.all(this.fnPromises.map(fn => fn()))
    
        let chains = [];
        for (let i = 0; i < limit; i++) {
            chains.push(this._next());
        }
    
        await Promise.all(chains)
        let results = this.results
        this.results = null // cleanup just in case
        return results
    }
    
   
    async _next() {
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