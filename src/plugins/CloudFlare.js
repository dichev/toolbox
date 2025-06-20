'use strict'

const fetch = require('node-fetch')
const console = require('../lib/Console')

const API = 'https://api.cloudflare.com/client/v4'

class CloudFlare {
    
    constructor(zone, email, key) {
        this._zone = zone
        this._email = email
        this._key = key
        
        this.silent = false
    }
    
    // aliases
    async get(url)          { return this.request({url, method: 'GET' }) }
    async post(url, json)   { return this.request({url, method: 'POST',   json }) }
    async put(url, json)    { return this.request({url, method: 'PUT',    json }) }
    async delete(url, json) { return this.request({url, method: 'DELETE', json }) }
    async patch(url, json)  { return this.request({url, method: 'PATCH',  json }) }
    
    async request({url, method = 'GET', json = null}) {
        console.verbose(`Cloudflare ${method} ${url}`)
        
        let options = {
            url: `${API}/zones/${this._zone}/${url}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Email': this._email,
                'X-Auth-Key': this._key
            },
            body: json ? JSON.stringify(json) : null
        }
        
        
        let result
        try {
            const response = await fetch(options.url, options)
            result = await response.json()
            let raw = JSON.stringify(result, null, 4)
            this.silent ? console.verbose(raw) : console.log(raw)
            if(!result.success) throw Error('The response is not successful')
        }
        catch (err) {
            let msg = result.errors ? result.errors.map(e => e.message).join(' | ') : err.toString()
            throw Error('CF Error: ' + msg)
        }
        
        return result
    }
    
    
}

module.exports = CloudFlare