'use strict';

const promisify = require('util').promisify;
const path = require('path')
const SSH2 = require('ssh2'); // TODO: check security
const Input = require('./Input')
const console = require('../lib/Log')
const fs = require('fs')
const v = console.verbose

class SSHClient {
    
    constructor(dryMode = false) {
        this._ssh = null
        this._cwd = ''
        this._dryMode = dryMode
        this._silent = false
        
        this._location = ''
    }
    
    get silent() {
        return this._silent
    }
    set silent(v) {
        this._silent = Boolean(v)
    }
    
    
    /**
     * @param {object} cfg
     */
    async connect(cfg) {
        return promisify(this._connect.bind(this))(cfg)
    }
    
    disconnect() {
        if (this._ssh) {
            this._ssh.end()
            this._ssh = null
        }
    }
    
    /**
     * @param {string} cmd
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {boolean} [options.allowInDryMode]
     * @param {boolean} [options.trim]
     */
    async exec(cmd, { silent = false, secret = false, allowInDryMode = false, trim = true } = {}) {
        return promisify(this._exec.bind(this))(cmd, {silent, secret, allowInDryMode, trim})
    }
    
    
    /**
     * @param {string} dir
     */
    async chdir(dir) {
        this._cwd = await this.exec(`cd ${dir} && pwd`, { silent: true, allowInDryMode: true })
    }
    
    /**
     * @param {string} path
     * @return {boolean}
     */
    async exists(path) {
        let exists = await this.exec(`[ -e ${path} ] && echo EXISTS || echo NOT_EXISTS`, { silent: true, allowInDryMode: true })
        return exists === 'EXISTS'
    }
    
    async tunnel(boundPort, remotePort) {
        v(`Tunneling 127.0.0.1:${boundPort} to 127.0.0.1:${remotePort}`);
        
        return new Promise((resolve, reject) => {
            this._ssh.forwardOut(
                '127.0.0.1', boundPort,   // source IP / port
                '127.0.0.1', remotePort,  // destination IP / port
                (error, stream) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(stream)
                    }
                }
            )
        })
    }
    
    
    async readFile(path) {
        v(`[sftp] Reading from ${path}`)
        return new Promise((resolve, reject) => {
            this._ssh.sftp((err, sftp) => {
                if (err) return reject(err)
                let readStream = sftp.createReadStream(path);
                let content = ''
                readStream.on('data', data => content += data)
                readStream.on('close', () => {
                    v(`[sftp] Data read ${path}`)
                    sftp.end();
                    resolve(content)
                })
            });
        })
    }
    
    
    async writeFile(path, data){
        v(`[sftp] Writing to ${path}`)
        return new Promise((resolve, reject) => {
            this._ssh.sftp((err, sftp) => {
                if (err) return reject(err)
                let writeStream = sftp.createWriteStream(path);
                writeStream.on('close', () => {
                    v(`[sftp] Data written to ${path}`)
                    sftp.end();
                    resolve()
                })
                writeStream.write(data.toString())
                writeStream.end()
            });
        })
    }
    
     async uploadFile(localPath, remotePath){
        v(`[sftp] Uploading ${localPath} to ${remotePath}`)
        return new Promise((resolve, reject) => {
            this._ssh.sftp((err, sftp) => {
                if (err) return reject(err)
                let readStream = fs.createReadStream(localPath);
                let writeStream = sftp.createWriteStream(remotePath);
                writeStream.on('close', () => {
                    v(`[sftp] Data written to ${remotePath}`)
                    sftp.end();
                    resolve()
                })
                readStream.pipe(writeStream)
            });
        })
    }
    
    
    /**
     * @param {object} cfg
     * @param {function} callback
     */
    _connect(cfg, callback) {
        this._location = cfg.username + '@' + cfg.host
        v(`[ssh] Connecting to ${this._location} via ssh..`);
        
        this._ssh = new SSH2();
        this._ssh
            .on('ready', () => {
                // v(`[ssh] Connected successfully: ${this._location}`);
                callback();
            })
            .on('end', (data) => {
                v(`[ssh] SSH connection closed: ${this._location}`);
                this._ssh = null;
            })
            .on('error', (err) => {
                v(`[ssh] Error ${this._location}`);
                callback(err)
            })
            .connect(cfg);
    }
    
    /**
     * @param {string} cmd
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {boolean} [options.allowInDryMode]
     * @param {function} callback
     */
    _exec(cmd, options = {}, callback) {
        let isDryMode = this._dryMode && !options.allowInDryMode
        if (!options.secret) v(`${isDryMode?'DRY RUN | ':''}${this._location}:${this._cwd}$`, cmd);
        if (!this._ssh) throw Error('Can not .exec commands before SSH is connected!')
        if (this._cwd) cmd = `cd ${this._cwd} && ` + cmd
        
        this._protect(cmd).then(() => {
            if (isDryMode) return callback()
            this._ssh.exec(cmd, (err, stream) => {
                if (err) return callback(err);
                this._handleStream(stream, options, callback);
            })
        })
    }
    
    /**
     * @param {stream} process
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {function} callback
     * @private
     */
    _handleStream(process, { secret = false, silent = false, trim = true }, callback) {
        let _stdout = '';
        let _stderr = '';
        
        process.on('close', (code) => {
            let error = (code !== 0) ? new Error(_stderr || 'Error code: ' + code) : null;
            if(trim){
                _stdout = _stdout.trim()
                _stderr = _stderr.trim()
            }
            callback(error, _stdout, _stderr);
        });
        
        
        process.stdout.on('data', (data) => {
            let stdout = data.toString();
            _stdout += stdout;
            if(!secret) (this._silent || silent) ? v(stdout) : console.log(stdout);
        });
        
        process.stderr.on('data', (data) => {
            let stderr = data.toString();
            _stderr += stderr;
            if(!secret) (this._silent || silent) ? v(stderr) : console.warn(stderr);
        });
    }
    
    
    /**
     * Some day this will save the world, I'm sure
     */
    async _protect(cmd) {
        if(!this.isSafe(cmd)){
            console.warn('WARNING! Found risky shell commands:')
            console.info(cmd)
            console.warn('Are you sure you know what are you doing?')
            let answer = await Input.ask(`Please type 'approved' to proceed`, ['approved', 'no'], 'no')
            if (answer !== 'approved') {
                throw Error('The operation is not approved. Aborting..')
            }
        }
    }
    
    /**
     * Protect from accidental deletion of restricted server files
     * United tested method
     * @param {string} commands
     * @return {boolean}
     */
    isSafe(commands){
    
        let filterRe = /^(rm|cd)\s+/
        let cdRe = /^cd\s+(\S+)/
        let rmRe = /^rm\s+-.*?r.*?\s+(\S+)/
        
        let safe = true
        let baseDir = '/'
        let cmds = commands.split(/&&|\|\|/g).map(c => c.trim()).filter(c => filterRe.test(c))
        for(let cmd of cmds){
            // console.log({cmds})
            let cd = cmd.match(cdRe)
            let rm = cmd.match(rmRe)
    
            if(cd && cd[1]) {
                let dir = cd[1]
                if(dir.startsWith('/')) baseDir = dir
                else baseDir = path.join(baseDir, cd[1])
            }
            if(rm && rm[1]){
                let dir = rm[1]
                if (!dir.startsWith('/')) {
                    dir = path.join(baseDir, rm[1])
                }
                dir = path.normalize(dir).replace(/\\/g, '/') // protect from /path/../
                // console.log({dir})
    
                let mustNotBeExactly = [
                    '/home/dopamine/',
                    '/home/dopamine/*',
                    '/home/dopamine/production',
                    '/home/dopamine/production/*',
                    '/opt/dopamine/',
                    '/opt/dopamine/*',
                ]
                let mustStartWith = [
                    '/home/dopamine/',
                    '/opt/dopamine/',
                ]
    
                if (mustNotBeExactly.includes(dir) || !mustStartWith.find(base => dir.startsWith(base))) {
                    safe = false
                }
            }
        }
        return safe
    }
    
}


module.exports = SSHClient;