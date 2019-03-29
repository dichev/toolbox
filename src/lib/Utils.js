'use strict'

class Utils {
    
    /**
     * Splits array into chunks
     * @param {array} arr
     * @param {int} size
     * @return {Array<Array>}
     */
    static chunk(arr, size) {
        if(!Array.isArray(arr) || !Number.isInteger(size)) throw Error(`Invalid arguments: arr:${typeof arr}, size:${typeof size}`)
        const chunks = []
        let index = 0
        while (index < arr.length) {
            chunks.push(arr.slice(index, size + index))
            index += size
        }
        return chunks
    }
    
}

module.exports = Utils