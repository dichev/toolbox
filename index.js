'use strict'

module.exports = require('./src/App')
module.exports.plugins = {
    CloudFlare: require('./src/plugins/CloudFlare'),
    HipChat: require('./src/plugins/HipChat')
}