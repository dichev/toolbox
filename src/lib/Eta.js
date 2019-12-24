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
        let totalMillis = average * this._iterations
        let duration = Duration.fromMillis(totalMillis)
        
        let secs = totalMillis / 1000
        let format = "s's'"
        if (secs > 60) format = "m'm' " + format
        if (secs > 60 * 60) format = "h'h' " + format
        if (secs > 60 * 60 * 24) format = "d'd' " + format
        return duration.toFormat(format)
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