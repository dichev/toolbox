'use strict';

const promisify = require('util').promisify;
const SSH2 = require('ssh2'); // TODO: check security
const console = require('../lib/Log')
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
        this._silent = v
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
     */
    async exec(cmd, {silent = false, secret = false, allowInDryMode = false} = {}) {
        return promisify(this._exec.bind(this))(cmd, {silent, secret, allowInDryMode})
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
            .on('error', callback)
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
        if (isDryMode) return callback()
        
        if (this._cwd) cmd = `cd ${this._cwd} && ` + cmd
        this._ssh.exec(cmd, (err, stream) => {
            if (err) return callback(err);
            this._handleStream(stream, options, callback);
        });
    }
    
    /**
     * @param {stream} process
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {function} callback
     * @private
     */
    _handleStream(process, { secret = false, silent = false}, callback) {
        let _stdout = '';
        let _stderr = '';
        
        process.on('close', (code) => {
            let error = (code !== 0) ? new Error(_stderr || 'Error code: ' + code) : null;
            callback(error, _stdout.trim(), _stderr.trim());
        });
        
        
        process.stdout.on('data', (data) => {
            let stdout = data.toString().trim();
            _stdout += stdout + '\n';
            if(!secret && !this._silent) silent ? v(stdout) : console.log(stdout);
        });
        
        process.stderr.on('data', (data) => {
            let stderr = data.toString().trim();
            _stderr += stderr + '\n';
            if(!secret && !this._silent) silent ? v(stderr) : console.warn(stderr);
        });
    }
    
    
}


module.exports = SSHClient;