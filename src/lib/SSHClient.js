'use strict';

const promisify = require('util').promisify;
const SSH2 = require('ssh2'); // TODO: check security


class SSHClient {
    
    constructor() {
        this._ssh = null
        this._cwd = ''
    }
    
    
    /**
     * @param {object} cfg
     */
    async connect(cfg) {
        return promisify(this._connect.bind(this))(cfg)
    }
    
    async disconnect() {
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
        console.log('[ssh] Connecting to %s@%s via ssh..', cfg.username, cfg.host);
        
        this._ssh = new SSH2();
        this._ssh.on('ready', () => {
            console.log('[ssh] Connected successfully..');
            callback();
        })
            .on('end', (data) => {
                console.log('[ssh] SSH connection closed');
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
        console.log('[ssh] >', cmd);
        if (!this._ssh) throw Error('Can not .exec commands before SSH is connected!')
    
        if (this._cwd) cmd = `cd ${this._cwd} && ` + cmd
        // console.log('[ssh] >', cmd);
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
            let error = (code !== 0) ? new Error('code: ' + code + ' | stderr: \n' + _stderr) : null;
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
            console.error(stderr);
        });
    }
    
    
}


module.exports = SSHClient;