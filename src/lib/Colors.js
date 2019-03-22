'use strict'

const colorName = require('color-name')
const chalk = require('chalk')
const rnd = (max) => Math.floor(Math.random() * max)

class Colors {
    
    /**
     * Convert css colors to hex
     * @param {string|Array} color - name, hex or rgb - for example: 'green' or '#039be5' or 'rgb(3, 155, 229)' or [3, 155, 229]
     * @return {string}
     */
    static toHex(color){
        let rgb
        if(Array.isArray(color) && color.length === 3) { // [3, 155, 229]
            rgb = color
        }
        else if(colorName[color]) { // green
            rgb = colorName[color]
        }
        else if (color.startsWith('rgb')) { // rgb(3, 155, 229)
            rgb = color.replace(/rgb|[\s()]/g, '').split(',').map(c => parseInt(c))
        }
        else { // #039be5 or whatever
            return color
        }
        
        return Colors.rgbToHex(rgb)
    }
    
    /**
     * @param {Array<int,int,int>}rgb
     * @return {string}
     */
    static rgbToHex(rgb) {
        return '#' + rgb.map(x => {
            const hex = x.toString(16)
            return hex.length === 1 ? '0' + hex : hex
        }).join('')
    }
    
    static toRandomANSIColor(str) {
        return chalk.hsl(rnd(35) * 10, 50, 50)(str)
    }
    
}

module.exports = Colors