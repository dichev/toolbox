#!/usr/bin/env node
'use strict';

const Program = require('../').Program
const HOSTS = ['dev-hermes-web1.out','dev-hermes-web2.out']

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
        
        await program.shell().exec('date')
        
        let ssh = await program.ssh(host, 'root')
    
        if (await ssh.exists('/opt/dopamine/sys-metrics')) {
            await ssh.chdir('/opt/dopamine/sys-metrics')
            await ssh.exec('git describe --tags')
            await ssh.exec('systemctl status sys-metrics | grep Active')
        }
        else {
            console.info('Oups, there are no sys-metrics here..')
        }
    })
