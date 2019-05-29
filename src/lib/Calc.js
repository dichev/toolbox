'use strict'

class Calc {
    
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
}

module.exports = Calc