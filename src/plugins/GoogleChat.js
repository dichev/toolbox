'use strict'

const fetch = require('node-fetch')
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const console = require('../lib/Console')
const toHex = require('../lib/Colors').toHex

const icons = {
    WARN:    'https://cdn-eu.cloudedge.info/icons/warn.png?v=3',
    ERROR:   'https://cdn-eu.cloudedge.info/icons/error.png?v=4',
    GEAR:    'https://cdn-eu.cloudedge.info/icons/gear.png?v=3',
    DEPLOY:  'https://cdn-eu.cloudedge.info/icons/deploy.png?v=3',
    PACKAGE: 'https://cdn-eu.cloudedge.info/icons/package.png?v=3',
}

const MESSAGE_LENGTH_LIMIT = 4096 // characters

class GoogleChat {
    
    /**
     * @param {string} urlToken
     * @param {string|function} threadKey
     * @param {boolean} [waitResponse] - When is set to false the response/error from google chat will be not awaited.
     *                                   This is useful to avoid script failure due chat notification failure
     *                                   Note if is set to false, there will be still minimal delay just to keep the order of consequent chat messages
     */
    constructor(urlToken, threadKey = 'default', waitResponse = true) {
        this.thread = threadKey
        this._urlToken = urlToken
        this.enabled = !!urlToken
        this.waitResponse = waitResponse
        this._minDelay = 500
    }
    
    
    /**
     * @deprecated
     */
    async notify(message = 'NO MESSAGE', {popup = false, silent = false} = {}, ms = 500) {
        if(!this.enabled) return
        // Do not wait response to avoid execution blocking by the GoogleChat http request
        this.notifyWait(message, {popup, silent }).then().catch(err => console)
        await delay(ms)
    }
    
    /**
     * @deprecated
     */
    async notifyWait(message = 'NO MESSAGE', {popup = false, silent = false} = {}) {
        return this.message(message, {popup, silent})
    }
    
    async message(text, { silent = false, popup = false} = {}){
        if(!silent) console.info(text)
        if(popup) text = '<users/all> ' + text.trim()
        return this._send({
            text: this._sanitizeMessage(text)
        })
    }
    
    async warn(title, text, { silent = false, popup = false} = {}) {
        if(!silent) console.warn(title, text)
        return this._send({
            cards: [{
                header: {title: title, imageUrl: GoogleChat.icons.WARN, imageStyle: 'IMAGE'},
                sections: [{
                    widgets: [{textParagraph: {text: this._sanitizeMessage(text)}}]
                }]
            }]
        })
    }
    
    async error(title, text = '', {silent = false, popup = false} = {}){
        if(!silent) console.error('[chat]', title, text)
        return this._send({
            cards: [{
                header: {title: title, imageUrl: GoogleChat.icons.ERROR, imageStyle: 'IMAGE'},
                sections: [{
                    widgets: [{textParagraph: {text: this._sanitizeMessage(text) }}]
                }]
            }]
        })
    }
    
    async announce(html = '', { title = '', subtitle = '', icon = '', color = '', bold = true, buttons = [], silent = false } = {}) {
        if(!silent) console.info(html, title)
        if (!this.enabled) return
    
        html = this._sanitizeMessage(html)
        if(bold)  html = `<b>${html}</b>`
        if(color) html = `<font color="${toHex(color)}">${html}</font>`
        
        return this._send({
            cards: [{
                header: {title: title, subtitle: subtitle, imageUrl: icon, imageStyle: 'IMAGE'},
                sections: [{
                    widgets: [{
                        textParagraph: {text: html},
                        buttons: buttons.map(({text, url}) => {
                            return {
                                textButton: {
                                    text: text,
                                    onClick: { openLink: { url }}
                                }
                            }
                        }),
                        
                    }],
                }]
            }]
        })
    }
    
    async json(json){
        return this._send(json)
    }
    
    async _send(json){
        if(this.waitResponse){
            return await this._request(json)
        }
        else {
            await Promise.race([
                this._request(json),
                delay(this._minDelay)
            ]).catch(console.error)
        }
    }
    
    async _request(json){
        if (!this.enabled) return
        
        let options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(json)
        }
        
        let result
        let error
        try {
            let url = this._urlToken + `&threadKey=${this.thread}`
            // console.verbose({url: url, options: options})
            const response = await fetch(url, options)
            result = await response.json()
            if (result.error) throw Error(result)
            if (!response.ok) throw Error('Wrong status code: ' + response.status)
            // console.verbose(result)
        }
        catch (err) {
            result = result && result.error ? result.error : {success: false, msg: err.toString()}
            console.verbose('[google chat]', options)
            console.error('[google chat]', result)
        }
        
        return result
    }
    
    _sanitizeMessage(text){
		if(!text) return text

        if (text.length > MESSAGE_LENGTH_LIMIT) {
            text = text.substr(0, MESSAGE_LENGTH_LIMIT - 2) + '..'
        }
        return text.trim()
    }
}

GoogleChat.icons = icons
module.exports = GoogleChat