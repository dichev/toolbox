'use strict'

const ESCAPED = /[|\\{}()[\]^$+?.]/g // escape all regex special chars except *

class Pattern {
    
    
    static match(pattern, string) {
        let escaped = pattern.replace(ESCAPED, '\\$&').replace(/\*/g, '.*')
        let re = new RegExp(escaped, 'g')
        return re.test(string)
    }
    
    static includes(pattern, arr){
        for(let str of arr){
            if(str === pattern) return true
            if(this.match(pattern, str)) return true
        }
        return false
    }
    
    /**
     * @param {array} patterns
     * @param {array} sources
     * @param {boolean} [strict]
     */
    static intersect(patterns, sources, strict = false){
        
        let set = new Set() // contains unique items
        
        for (let p of patterns) {
            if (p.includes('*')) {
                let found = sources.filter(c => this.match(p, c))
                found.forEach(c => set.add(c))
                if (strict && !found.length) throw Error(`No match to ${p}. Available: ${sources}`)
            } else {
                if(sources.includes(p)) {
                    set.add(p)
                } else {
                    if (strict) throw Error(`There is no such choice ${p}. Available: ${sources}`)
                }
            }
        }
        
        return Array.from(set)
    
    }
}

module.exports = Pattern