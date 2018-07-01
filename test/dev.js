#!/usr/bin/env node
'use strict';

/**
 * Usage:
 * $ node test/dev --hosts dev-hermes-web1,dev-hermes-web2
 * $ node test/dev --hosts dev-hermes-*
 * $ node test/dev --hosts all
 */


const Deployer = require('../index')
const HOSTS = [
    { name: 'dev-hermes-web1', ip: '192.168.106.32' },
    { name: 'dev-hermes-web2', ip: '192.168.106.33' },
]

let deployer = new Deployer()


deployer
    .option('-h, --hosts <list|all>', 'The target host names', { choices: HOSTS.map(h => h.name) })
    .loop('hosts')

    .run(async (host) => {
        let ssh = await deployer.ssh(HOSTS.find(h => h.name === host).ip, 'root')
    
        await ssh.exec('cd /opt/dopamine/sys-metrics && git describe --tags')
        await ssh.exec('systemctl status sys-metrics | grep Active')
    })

