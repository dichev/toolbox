'use strict'

const path = require('path')
const _cache = { verbose: null }

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
    
    /**
     * Return the verbosity level passed by these cli arguments:  -v, -vv, -vvv, --verbose
     * Note the argument can be combined, for example -v -v is equal to -vv
     * @return {int} - between 0 and 3
     */
    static getVerboseLevel(){
        if(_cache.verbose === null) {
            let levels = {'--verbose': 1, '-v': 1, '-vv': 2, '-vvv': 3}
            let types = Object.keys(levels)
            let verboseLevel = 0
    
            for (let arg of process.argv.slice(2)) {
                if (types.includes(arg)) {
                    verboseLevel += levels[arg]
                    if(verboseLevel >= 3) {
                        verboseLevel = 3
                        break
                    }
                }
            }
            _cache.verbose = verboseLevel
        }
        return _cache.verbose
    }

    /*
    * Generates a password according to the length containing
    * at least 1 uppercase letter, 1 lowercase letter,
    * a number and a special symbol
    *
    * @param {int} minLen
    * @param {int} [maxLen]
    * @return {string}
    */
    static generatePassword(minLen, maxLen = minLen) {
        let length = this.rand(minLen, maxLen)

        let seed = [
            '1234567890',
            'abcdefghijklmnopqrstuvwxyz',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '!-_^%$#@()?[]'
        ];

        let seedAll = seed[0] + seed[1] + seed[2] + seed[3];
        let seedAllCount = seedAll.length - 1;

        let password = '';
        for (let i = 0; i < length; i++) {
            if (i < 4) {
                password += this.pickOne(seed[i]);
            } else {
                password += this.pickOne(seedAll, seedAllCount);
            }
        }

        return this.shuffle(password).join('');
    }

    static rand(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    static pickOne(string, max = null) {
        max = max || string.length - 1;
        return string[this.rand(0, max)];
    }

    static shuffle(vectors) {
        let set = vectors;
        let length = set.length;
        let shuffled = new Array(length);
        let rand;
        for (let i = 0; i < length; i++) {
            rand = this.rand(0, i);
            shuffled[i] = shuffled[rand];
            shuffled[rand] = set[i];
        }
        return shuffled;
    }
    
    
    /**
     * Protect from accidental deletion of restricted server files
     * Unit tested method
     * @param {string} commands
     * @return {boolean}
     */
    static isSafeCommand(commands){
    
        let filterRe = /^(rm|cd|gcloud)\s+/
        let cdRe = /^cd\s+(\S+)/
        let rmRe = /^(rm)(\s+)(-\S?r.*?\s+)(\S+)/
        let gcDeleteRe = /gcloud\s+compute\s+instances\s+delete/
        
        let safe = true
        let baseDir = '/'
        let cmds = commands.split(/&&|\|\|/g).map(c => c.trim()).filter(c => filterRe.test(c))
        for(let cmd of cmds){
            // console.log({cmds})
            let cd = cmd.match(cdRe)
            let rm = cmd.match(rmRe)
            let gcDelete = cmd.match(gcDeleteRe)
    
            if(cd && cd[1]) {
                let dir = cd[1]
                if(dir.startsWith('/')) baseDir = dir
                else baseDir = path.join(baseDir, cd[1])
            }
            
            if(rm && rm[4]){
                let dir = rm[4]
                if (!dir.startsWith('/')) {
                    dir = path.join(baseDir, rm[1])
                }
                dir = path.normalize(dir).replace(/\\/g, '/') // protect from /path/../
                // console.log({dir})
    
                let mustNotBeExactly = [
                    '/home/dopamine/',
                    '/home/dopamine/*',
                    '/home/dopamine/production',
                    '/home/dopamine/production/*',
                    '/opt/dopamine/',
                    '/opt/dopamine/*',
                    '/opt/',
                    '/opt/*',
                ]
                let mustStartWith = [
                    '/home/dopamine/',
                    '/opt/',
                ]
                
                if (mustNotBeExactly.includes(dir) || !mustStartWith.find(base => dir.startsWith(base))) {
                    safe = false
                }
            }
            
            if(gcDelete){
                safe = false
            }
            
        }
        return safe
    }
    
}

module.exports = Utils