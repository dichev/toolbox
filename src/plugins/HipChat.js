'use strict'

const fetch = require('node-fetch')
const dummyError = (err) => { if (err) console.error(err) }


class HipChat {
    
    /**
     * Full HipChat Api docs here: https://www.hipchat.com/docs/apiv2/method/send_room_notification
     *
     * @param {string}   urlToken - url+room+token like: 'https://dopaminebg.hipchat.com/v2/room/{ROOM}/notification?auth_token={TOKEN}'
     * @param {string}   message - May contain basic tags: a, b, i, strong, em, br, img, pre, code, lists, tables
     * @param {string}  [color='green'] - Background color: yellow, green, red, purple, gray, random
     * @param {boolean} [notify=true] - Whether this message should trigger a user popup notification
     * @param {string}  [message_format='html'] - html or text
     * @param {function}[callback]
     */
    static notify(urlToken, {color = 'green', message = 'NO MESSAGE', notify = true, message_format = 'html'}, callback) {
        if (!callback) callback = dummyError
    
        // console.info(`# HipChat notification..`)
        
        let options = {
            url: urlToken,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ color,  message,  notify,  message_format })
        }
        
        fetch(options.url, options)
            .then(res => res.json())
            .then(json => callback())
            .catch(err => callback(error || 'Response error:\n' + err + '\n'))
    }
}


module.exports = HipChat