'use strict'

const request = require('request')
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
            json: { color,  message,  notify,  message_format }
        }
        
        request(options, (error, response, body) => {
            if (!error && (response.statusCode === 200 || response.statusCode === 204)) {
                // console.info('success', response.statusCode)
                callback()
            } else {
                // console.error(body)
                callback(error || 'Response error:\n' + JSON.stringify(body, null, 2) + '\n')
            }
        });
    }
}


module.exports = HipChat