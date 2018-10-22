'use strict'

const fetch = require('node-fetch')
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const console = require('../lib/Console')
const toHex = require('../lib/Colors').toHex

const icons = {
    WARN:    'https://cdn-eu.cloudedge.info/icons/warn.png?v=1',
    ERROR:   'https://cdn-eu.cloudedge.info/icons/error.png?v=1',
    GEAR:    'https://cdn-eu.cloudedge.info/icons/gear.png?v=1',
    DEPLOY:  'https://cdn-eu.cloudedge.info/icons/deploy.png?v=1',
    PACKAGE: 'https://cdn-eu.cloudedge.info/icons/package.png?v=2',
}

class GoogleChat {
    
    /**
     * @param {string} urlToken
     * @param {string|function} threadKey
     */
    constructor(urlToken, threadKey = 'default') {
        this.thread = threadKey
        this._urlToken = urlToken
        this.enabled = !!urlToken
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
            text: text.trim()
        })
    }
    
    async warn(title, text, { silent = false, popup = false} = {}) {
        if(!silent) console.warn(title, text)
        return this._send({
            cards: [{
                header: {title: title, imageUrl: GoogleChat.icons.WARN, imageStyle: 'IMAGE'},
                sections: [{
                    widgets: [{textParagraph: {text: text}}]
                }]
            }]
        })
    }
    
    async error(title, text, {silent = false, popup = false} = {}){
        if(!silent) console.error('[chat]', title, text)
        return this._send({
            cards: [{
                header: {title: title, imageUrl: GoogleChat.icons.ERROR, imageStyle: 'IMAGE'},
                sections: [{
                    widgets: [{textParagraph: {text: text}}]
                }]
            }]
        })
    }
    
    async announce(html, { title = '', subtitle = '', icon = '', color = '', bold = true, buttons = [], silent = false } = {}) {
        if(!silent) console.info(html, title)
        if (!this.enabled) return
        
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
            result = result.error ? result.error : {success: false, msg: err.toString()}
            console.verbose('[google chat]', json)
            console.error('[google chat]', result)
        }
        
        return result
    }
    
    
}

GoogleChat.icons = icons
module.exports = GoogleChat