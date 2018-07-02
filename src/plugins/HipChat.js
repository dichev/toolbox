'use strict'

const fetch = require('node-fetch')


class HipChat {
    
    /**
     * @param {string}   urlToken - url+room+token like: 'https://dopaminebg.hipchat.com/v2/room/{ROOM}/notification?auth_token={TOKEN}'
     */
    constructor(urlToken) {
        this._urlToken = urlToken
    }
    
    /**
     * Full HipChat Api docs here: https://www.hipchat.com/docs/apiv2/method/send_room_notification
     *
     * @param {string}   message - May contain basic tags: a, b, i, strong, em, br, img, pre, code, lists, tables
     * @param {string}  [color='green'] - Background color: yellow, green, red, purple, gray, random
     * @param {boolean} [notify=true] - Whether this message should trigger a user popup notification
     * @param {string}  [message_format='html'] - html or text
     */
    async notify(message = 'NO MESSAGE', {color = 'green', notify = true, message_format = 'html'} = {}) {
        // console.info(`# HipChat notification..`)
        
        let options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ color,  message,  notify,  message_format })
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