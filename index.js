'use strict'

const Program = require('./src/Program')
const CloudFlare = require('./src/plugins/CloudFlare')
const HipChat = require('./src/plugins/HipChat')


module.exports = { Program }
module.exports.plugins = { CloudFlare, HipChat }
