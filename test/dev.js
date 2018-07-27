#!/usr/bin/env node
'use strict';


const Program = require('../index').Program
const HOSTS = [
    { name: 'dev-hermes-web1', ip: '192.168.106.32' },
    { name: 'dev-hermes-web2', ip: '192.168.106.33' },
]

let program = new Program()


program
    .description('Testing script')
    .example(`
        node test/dev --hosts dev-hermes-web1,dev-hermes-web2
        node test/dev --hosts dev-hermes-*
        node test/dev --hosts all
    `)
    .option('-h, --hosts <list|all>', 'The target host names', { choices: HOSTS.map(h => h.name), required: true })
    .loop('hosts')

    .run(async (host) => {
        
        await program.shell().exec('date')
        
        let ssh = await program.ssh(HOSTS.find(h => h.name === host).ip, 'root')
    
        if (await ssh.exists('/opt/dopamine/sys-metrics')) {
            await ssh.chdir('/opt/dopamine/sys-metrics')
            await ssh.exec('git describe --tags')
            await ssh.exec('systemctl status sys-metrics | grep Active')
        }
        else {
            console.info('Oups, there are no sys-metrics here..')
        }
    })

