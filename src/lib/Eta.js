'use strict'

const Duration = require('luxon').Duration

class Eta {
    
    constructor(probesSize = 10) {
        this._probes = new Array(probesSize)
        this._iterations = 0
    }
    
    /**
     * @param {int} lastDurationMillis - in milliseconds
     * @param {int} iterationsLeft
     * @return {string}
     */
    measure(lastDurationMillis, iterationsLeft) {
        this._probes.shift()
        this._probes.push(lastDurationMillis)
        this._iterations = iterationsLeft
        
        return this.getEta()
    }
    
    /**
     * @return {string}
     */
    getEta() {
        let average = this.getAverage()
        return Duration.fromMillis(average * this._iterations).toFormat('hh:mm:ss')
    }
    
    /**
     * @return {number}
     */
    getAverage(){
        let sum = 0, count = 0
        for (let probe of this._probes) if (probe > 0) {
            sum += probe
            count++
        }
        return sum / count
    }
    
    
}

module.exports = Eta