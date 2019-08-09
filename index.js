'use strict'

const Program = require('./src/Program')
const CloudFlare = require('./src/plugins/CloudFlare')
const HipChat = require('./src/plugins/HipChat')
const GoogleChat = require('./src/plugins/GoogleChat')
const Input = require('./src/tools/Input')
const Shell = require('./src/tools/Shell')
const SSHClient = require('./src/tools/SSHClient')
const Tester = require('./src/tools/Tester')
const MySQL = require('./src/tools/MySQL')
const MySQLDumper = require('./src/tools/MySQLDumper')
const console = require('./src/lib/Console')
const Utils = require('./src/lib/Utils')
const Chain = require('./src/lib/Chain')

module.exports = { Program, Input, Shell, SSHClient, Tester, MySQL, MySQLDumper }
module.exports.lib = { console, Utils, Chain }
module.exports.plugins = { CloudFlare, HipChat, GoogleChat }
