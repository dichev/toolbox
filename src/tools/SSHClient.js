'use strict';

const util = require('util')
const path = require('path')
const SSH2 = require('ssh2'); // TODO: check security
const Input = require('./Input')
const console = require('../lib/Console')
const fs = require('fs')
const v = console.verbose
const colors = require('chalk')
const randomColor = require('../lib/Colors').toRandomANSIColor
const isWin = require('os').platform() === 'win32'
const readline = require('readline')
const progress = require('progress-stream');

const DRY_RUN = (process.argv.findIndex(arg => arg === '--dry-run') !== -1)

let HOSTS_COLORS = {}

class SSHClient {
    
    constructor() {
        this._ssh = null
        this._cwd = ''
        this._silent = false
        this._prefix = '[ssh]'
    }
    
    get silent() {
        return this._silent
    }
    set silent(v) {
        this._silent = Boolean(v)
    }
    
    
    /**
     * @param {object} cfg - see: https://www.npmjs.com/package/ssh2#client-methods
     * @return {Promise<SSHClient>}
     */
    async connect(cfg) {
        return new Promise((resolve, reject) => {
            this._connect(cfg, (err) => {
                if(err) reject(err)
                else resolve(this)
            })
        })
    }
    
    /**
     * @return {Promise<SSHClient>}
     */
    async disconnect() {
        if (this._ssh) {
            this._ssh.end()
            this._ssh = null
            this._prefix = '[ssh]'
        }
        return this
    }
    
    /**
     * @param {string} cmd
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {boolean} [options.allowInDryRun]
     * @param {boolean} [options.trim]
     */
    async exec(cmd, { silent = false, secret = false, allowInDryRun = false, trim = true, interactive = false } = {}) {
        return new Promise((resolve, reject) => {
            this._exec(cmd, {silent, secret, allowInDryRun, trim, interactive}, (error, output) => {
                if(error) reject(error)
                else resolve(output)
            })
        })
    }

    /**
     * @param {object} shellProp Remote Shell properties
     * Starts interactive shell session on remote server
     * @returns {Promise<*>}
     */
    async shell(shellProp) {
        shellProp = shellProp || { term: 'xterm-256color'}
        return new Promise((resolve, reject) => {
            this._ssh.shell(shellProp,function(err, stream) {
                if (err) throw err;

                process.stdin.setRawMode(true);
                process.stdin.pipe(stream);
                stream.pipe(process.stdout);
                stream.stderr.pipe(process.stderr);
                stream.setWindow(process.stdout.rows, process.stdout.columns);
                process.stdout.on('resize', () => {
                    stream.setWindow(process.stdout.rows, process.stdout.columns);
                });

                const listeners = process.stdin.listeners('keypress');
                process.stdin.removeAllListeners('keypress');
                stream.on('close', function() {
                    process.stdin.setRawMode(false);
                    process.stdin.unpipe(stream);
                    process.stdin.unref();
                    listeners.forEach(listener => process.stdin.addListener('keypress', listener));
                });
            })
        })
    }

    /**
     *  TODO: could be changed to ssh.exec(cmd, {screen: true})
     *  TODO: using nohup because can't detect when screen job is finished: $ screen -dm bash -c "${cmd} >> ${LOGFILE} 2>&1"
     * @param {string} cmd
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {boolean} [options.allowInDryRun]
     * @param {boolean} [options.trim]
     * @param {boolean} [options.remoteLogFile]
     */
    async execBackground(cmd, { silent = false, secret = false, allowInDryRun = false, trim = true, remoteLogFile } = {}) {
        return new Promise((resolve, reject) => {
            const LOGFILE = remoteLogFile || `/tmp/nohup.${Date.now()}.${(Math.round(Math.random()*100000))}.out`
    
            console.log(`Executing command in nohup, logging here: ${LOGFILE}`)
            console.warn('WARNING! This command will continue exection even if script is stopped')
            cmd = `
                set -e
                touch ${LOGFILE}
                tail -f -n 0 ${LOGFILE} & tailPID=$!
                nohup bash <<'EOF' >> ${LOGFILE} 2>&1 & wait $! && status=0 || status=1\n${cmd}\nEOF
                kill -s TERM $tailPID
                exit $status
            `

            this._exec(cmd, {silent, secret, allowInDryRun, trim}, (error, output) => {
                if (error) reject(error)
                else resolve(output)
            })
        })
    }
    
    
    /**
     * @param {string} dir
     */
    async chdir(dir) {
        this._cwd = await this.exec(`cd ${dir} && pwd`, { silent: true, allowInDryRun: true })
    }
    
    /**
     * @param {string} path
     * @return {boolean}
     */
    async exists(path) {
        let exists = await this.exec(`[ -e ${path} ] && echo EXISTS || echo NOT_EXISTS`, { silent: true, allowInDryRun: true })
        return exists === 'EXISTS'
    }
    
    async tunnel(boundPort, remotePort) {
        v(this._prefix + `Tunneling 127.0.0.1:${boundPort} to 127.0.0.1:${remotePort}`);
        
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
        v(this._prefix + `[sftp] Reading from ${path}`)
        return new Promise((resolve, reject) => {
            this._ssh.sftp((err, sftp) => {
                if (err) return reject(err)
                let readStream = sftp.createReadStream(path);
                let content = ''
                readStream.on('data', data => content += data)
                readStream.on('close', () => {
                    v(this._prefix + `[sftp] Data read ${path}`)
                    sftp.end();
                    resolve(content)
                })
            });
        })
    }
    
    
    async writeFile(path, data){
        v(this._prefix + `[sftp] Writing to ${path}`)
        return new Promise((resolve, reject) => {
            this._ssh.sftp((err, sftp) => {
                if (err) return reject(err)
                let writeStream = sftp.createWriteStream(path);
                writeStream.on('close', () => {
                    v(this._prefix + `[sftp] Data written to ${path}`)
                    sftp.end();
                    resolve()
                })
                writeStream.write(data.toString())
                writeStream.end()
            });
        })
    }
    
    async copyFile(remotePath, localPath){
        v(this._prefix + `[sftp] Writing ${localPath} to ${remotePath}`)

        return new Promise((resolve, reject) => {
            let str = progress({
                length: fs.statSync(localPath).size,
                time: 500 /* ms */
            })
            str.on('progress', (p) => {
                console.log(colors.gray(`${p.percentage.toFixed(1)}% ${(p.transferred / 1024 / 1024).toFixed(1)}MB/${(p.length / 1024 / 1024).toFixed(1)}MB (speed: ${(p.speed / 1024 / 1024).toFixed(1)}MB/s, eta: ${p.eta}s)`))
            })
            
            this._ssh.sftp((err, sftp) => {
                if (err) return reject(err)
                let readStream = fs.createReadStream(localPath)
                let writeStream = sftp.createWriteStream(remotePath)
                writeStream.on('close', () => {
                    v(this._prefix + `[sftp] Data written to ${remotePath}`)
                    sftp.end()
                    resolve()
                })
                readStream.pipe(str).pipe(writeStream)
            })
        })
    }
    
     async uploadFile(localPath, remotePath){
        v(this._prefix + `[sftp] Uploading ${localPath} to ${remotePath}`)
        return new Promise((resolve, reject) => {
            this._ssh.sftp((err, sftp) => {
                if (err) return reject(err)
                let readStream = fs.createReadStream(localPath);
                let writeStream = sftp.createWriteStream(remotePath);
                writeStream.on('close', () => {
                    v(this._prefix + `[sftp] Data written to ${remotePath}`)
                    sftp.end();
                    resolve()
                })
                readStream.pipe(writeStream)
            });
        })
    }

    /**
     * @param {string} pack - Package name to look for
     * @returns {Promise<boolean>}
     */
    async packageExists(pack){
        return (await this.exec(`dpkg -l | grep ${pack} | wc -l`,{silent:true}) > '0')
    }

    /**
     * @param {string} file - File name
     * @param {string} content - Content to be appended
     * @returns {Promise<*>}
     */
    async fileAppend(file,content){
        return (await this.exec("echo '" + Buffer.from(content).toString('base64') + "' | base64 -d >> " + file,{silent:true}))
    }

    /**
     * @param {string} file - File to be searched
     * @param {string} needle - String to search for
     * @returns {Promise<array>}
     */
    async findInFile(file,needle){
        try{
            return (await this.exec(`cat  ${file} | grep ${needle}`,{silent:true})).split("\n")
        }catch(e){
            return []
        }
    }

    /**
     * @param {object} cfg
     * @param {function} callback
     */
    _connect(cfg, callback) {
        if(!HOSTS_COLORS[cfg.username + '@' + cfg.host]) {
            HOSTS_COLORS[cfg.username + '@' + cfg.host] = randomColor((cfg.username + '@' + cfg.host).padEnd(24) + ' | ')
        }
        this._prefix = HOSTS_COLORS[cfg.username + '@' + cfg.host]
        
        v(this._prefix + `Connecting via ssh..`);
        if(!cfg.username) throw Error('[ssh] Missing username: ' + cfg.username)
        if(!cfg.host) throw Error('[ssh] Missing host: ' + cfg.host)
        if(typeof cfg.host !== 'string') throw Error('[ssh] Invalid host (must be a string): ' + util.inspect(cfg.host))
        if(typeof cfg.username !== 'string') throw Error('[ssh] Invalid username (must be a string): ' + util.inspect(cfg.username))
        if(!cfg.privateKey && typeof cfg.agent === 'undefined') cfg.agent = isWin ? 'pageant' : process.env.SSH_AUTH_SOCK
        if(!cfg.privateKey && typeof cfg.agentForward === 'undefined') cfg.agentForward = true
        
        this._ssh = new SSH2();
        this._ssh
            .on('ready', () => {
                v(this._prefix + `Connected successfully`);
                callback(null, this._ssh);
            })
            .on('end', (data) => {
                v(this._prefix + `SSH connection closed`);
                this._ssh = null;
            })
            .on('error', (err) => {
                v(this._prefix + `Error!`);
                callback(err)
            })
            .connect(cfg);
    }
    
    /**
     * @param {string} cmd
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {boolean} [options.allowInDryRun]
     * @param {function} callback
     */
    _exec(cmd, options = {}, callback) {
        let isDryMode = DRY_RUN && !options.allowInDryRun
        if (!options.secret) v(this._prefix + `${isDryMode?'DRY RUN | ':''}${this._cwd}$`, cmd);
        if (!this._ssh) throw Error('Can not .exec commands before SSH is connected!')
        if (this._cwd) cmd = `cd ${this._cwd} && ` + cmd
        if(cmd.search('\n') !== -1) cmd = 'set -e && ' + cmd
        
        this._protect(cmd).then(() => {
            if (isDryMode) return callback()
            this._ssh.exec(cmd, {pty: options.interactive || false}, (err, stream) => {
                if (err) return callback(err);
                this._handleStream(stream, options, callback);
            })
        })
    }
    
    /**
     * @param {stream} stream
     * @param {object} [options]
     * @param {boolean} [options.silent]
     * @param {boolean} [options.secret]
     * @param {function} callback
     * @private
     */
    _handleStream(stream, { secret = false, silent = false, trim = true, interactive = false } = {}, callback) {
        let stderr = ''
        let stdout = ''
        let output = ''
        let rl = null
    
        if(interactive) {
            rl = readline.createInterface({ input: process.stdin, output: stream.stdout })
            rl.on('line', (d) => {
                stream.write(d.trim() + '\n')
            })
        }

        stream.stdout.setEncoding('utf8')
        stream.stderr.setEncoding('utf8')
        
        stream.stdout.on('data', data => {
            let dataPrefixed = this._formatChunkPrefix(stdout, data)
            output += data // do not overwrite or change original data ( it may be used by callback, and should stay free of any modifications )
            stdout += data
            if(!secret) (this._silent || silent) ? v(dataPrefixed) : process.stdout.write(dataPrefixed)
        })
        
        stream.stderr.on('data', data => {
            let dataPrefixed = this._formatChunkPrefix(stderr, data)
            output += data
            stderr += data
            if(!secret) (this._silent || silent) ? v(dataPrefixed) : process.stdout.write(colors.yellow(dataPrefixed))
        })
    
        stream.on('close', (code) => {
            if (interactive) rl.close()
            if (code !== 0) {
                return callback(new Error(stderr.trim() || 'Error code: ' + code))
            }
            callback(null, trim ? output.trim() : output)
        })
    }
    
    _formatChunkPrefix(prev, chunk){
        let prefix = this._prefix
        let str = chunk
    
        if (!prev || prev.endsWith('\n')) {
            str = prefix + str
        }

        if(chunk.endsWith('\n')){
            str = str.slice(0, -1).replace(/\n/g, '\n' + prefix) + '\n'
        } else {
            str = str.replace(/\n/g, '\n' + prefix)
        }
        
        return str
    }
    
    
    /**
     * Some day this will save the world, I'm sure
     */
    async _protect(cmd) {
        if(!this.isSafe(cmd)){
            console.warn('WARNING! Found risky shell commands:')
            console.info(cmd)
            console.warn('Are you sure you know what are you doing?')
            let answer = await new Input().ask(`Please type 'approved' to proceed`, ['approved', 'no'], 'no')
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