'use strict';

const promisify = require('util').promisify;
const SSH2 = require('ssh2'); // TODO: check security
const console = require('./Log')
const v = console.verbose

class SSHClient {
    
    constructor(dryMode = false) {
        this._ssh = null
        this._cwd = ''
        this._dryMode = dryMode
        
        this._location = ''
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
     */
    async exec(cmd) {
        return promisify(this._exec.bind(this))(cmd)
    }
    
    
    /**
     * @param dir
     */
    async chdir(dir) {
        this._cwd = await this.exec(`cd ${dir} && pwd`)
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
     * @param {function} callback
     */
    _exec(cmd, callback) {
        v(`${this._location}:${this._cwd}$`, cmd);
        if (!this._ssh) throw Error('Can not .exec commands before SSH is connected!')
        if (this._dryMode) return callback()
        
        if (this._cwd) cmd = `cd ${this._cwd} && ` + cmd
        
        this._ssh.exec(cmd, (err, stream) => {
            if (err) return callback(err);
            this._handleStream(stream, callback);
        });
    }
    
    /**
     * @param {stream} process
     * @param {function} callback
     * @private
     */
    _handleStream(process, callback) {
        let _stdout = '';
        let _stderr = '';
        
        process.on('close', (code) => {
            let error = (code !== 0) ? new Error(_stderr || 'Error code: ' + code) : null;
            callback(error, _stdout.trim(), _stderr.trim());
        });
        
        
        process.stdout.on('data', (data) => {
            let stdout = data.toString().trim();
            _stdout += stdout + '\n';
            console.log(stdout);
        });
        
        process.stderr.on('data', (data) => {
            let stderr = data.toString().trim();
            _stderr += stderr + '\n';
            console.warn(stderr);
        });
    }
    
    
}


module.exports = SSHClient;