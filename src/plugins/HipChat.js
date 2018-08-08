'use strict'

const fetch = require('node-fetch')
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const console = require('../lib/Log')

class HipChat {
    
    /**
     * @param {string}   urlToken - url+room+token like: 'https://dopaminebg.hipchat.com/v2/room/{ROOM}/notification?auth_token={TOKEN}'
     */
    constructor(urlToken) {
        this._urlToken = urlToken
        this._enabled = !!urlToken
    }
    
    get enabled() { return this._enabled }
    set enabled(v){ return this._enabled = !!v }
    
    /**
     * Full HipChat Api docs here: https://www.hipchat.com/docs/apiv2/method/send_room_notification
     *
     * @param {string}   message - May contain basic tags: a, b, i, strong, em, br, img, pre, code, lists, tables
     * @param {string}  [color] - Background color: yellow, green, red, purple, gray, random
     * @param {boolean} [popup] - Whether this message should trigger a user popup notification
     * @param {string}  [format] - html or text
     * @param {boolean} [silent] - do not ouput message in stdout
     * @param {int}     [ms] - how many sec to wait until resolve the promise
     */
    async notify(message = 'NO MESSAGE', {color = 'gray', popup = false, format = 'html', silent = false} = {}, ms = 500) {
        if(!silent) console.info(message)
        if(!this._enabled) return
        // Do not wait response to avoid execution blocking by the HipChat http request
        this.notifyWait(message, { color, popup, format }).then().catch(err => console)
        await delay(ms)
    }
    
    async notifyWait(message = 'NO MESSAGE', {color = 'gray', popup = false, format = 'html'} = {}) {
        if (!this._enabled) return
        
        if(format === 'html'){
            message = message.trim().replace(/\n/g, '<br/>')
        }
        
        let options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ color,  message,  notify: popup,  message_format: format })
        }
    
    
        let result
        try {
            const response = await fetch(this._urlToken, options)
            if (!response.ok) throw Error('Wrong status code: ' + response.status)
            const result = await response.text() // it's empty
        }
        catch (err) {
            result = err.error ? err.error : {success: false, msg: err.toString()}
            console.error(result)
        }

        return result
    }
}


module.exports = HipChat