'use strict'

const request = require('request-promise-native') //TODO //@ grr too many deps


const API = 'https://api.cloudflare.com/client/v4'

class CloudFlare {
    
    constructor(zone, email, key) {
        this._zone = zone
        this._email = email
        this._key = key
    }
    
    // aliases
    async get(url)          { return this.request({url, method: 'GET' }) }
    async post(url, json)   { return this.request({url, method: 'POST',   json }) }
    async put(url, json)    { return this.request({url, method: 'PUT',    json }) }
    async delete(url, json) { return this.request({url, method: 'DELETE', json }) }
    async patch(url, json)  { return this.request({url, method: 'PATCH',  json }) }
    
    async request({url, method = 'GET', json = true}) {
        console.log(`Cloudflare ${method} ${url}`)
        
        let options = {
            url: `${API}/zones/${this._zone}/${url}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Email': this._email,
                'X-Auth-Key': this._key
            },
            json: json,
            resolveWithFullResponse: true
        }
        
        
        let result
        try {
            let response = await request(options)
            result = response.body
            console.log(JSON.stringify(result, null, 4))
        }
        catch (err) {
            result = err.error ? err.error : { success: false, msg: err.toString() }
            console.error(result)
        }
        
        return result
    }
    
    
}

module.exports = CloudFlare