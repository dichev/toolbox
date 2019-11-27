#!/usr/bin/env node
'use strict';

const Program = require('../').Program
const Shell = require('../').Shell
const SSHClient = require('../').SSHClient
const HOSTS = ['sofia-dev-web1.out','sofia-dev-web2.out']

let program = new Program()

program
    .description('Testing script')
    .option('-h, --hosts <list|all>', 'The target host names', { choices: HOSTS, required: true })
    .example(`
        node test/dev --hosts dev-hermes-web1.out,dev-hermes-web2.out
        node test/dev --hosts dev-hermes-*
        node test/dev --hosts all
    `)
    
    .iterate('hosts', async (host) => {
        
        await new Shell().exec('date')
        
        let ssh = await new SSHClient().connect({ host: host, username: 'root'})

        if (await ssh.exists('/opt/dopamine/exporters/sysmetrics_exporter')) {
            await ssh.chdir('/opt/dopamine/exporters/sysmetrics_exporter')
            await ssh.exec('git log -5 --oneline')
            await ssh.exec('systemctl status sysmetrics | grep Active')
        }
        else {
            console.info('Oups, there are no sys-metrics here..')
        }
    
        await ssh.disconnect()
    })
