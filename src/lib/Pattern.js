'use strict'

const ESCAPED = /[|\\{}()[\]^$+?.]/g // escape all regex special chars except *

class Pattern {
    
    
    static test(pattern, string) {
        if(!pattern.includes('*')) return pattern === string
        
        let escaped = pattern.replace(ESCAPED, '\\$&').replace(/\*/g, '.*')
        let re = new RegExp(`^${escaped}$`, 'g')
        return re.test(string)
    }
    
    static includes(pattern, arr){
        for(let str of arr){
            if(str === pattern) return true
            if(this.test(pattern, str)) return true
        }
        return false
    }
    
    /**
     * @param {array} patterns
     * @param {array} sources
     * @param {boolean} [strict]
     */
    static intersect(patterns, sources, strict = false){
        let set = new Set() // contains only unique items
        
        for (let p of patterns) {
            let found = sources.filter(s => this.test(p, s))
            found.forEach(s => set.add(s))
            if (strict && !found.length) throw Error(`No match to ${p}. Available: ${sources}`)
        }
        
        return Array.from(set)
    
    }
}

module.exports = Pattern