const Config = {
    servers: [
        {
            network: 'office',
            name: 'dev-hermes-lb',
            ip: '192.168.106.30',
            location: 'Sofia2-Telepoint',
            type: 'lb-office',
            defaultUser: 'dopamine'
        },
        {
            network: 'office',
            name: 'dev-hermes-sql',
            ip: '192.168.106.31',
            location: 'Sofia2-Telepoint',
            type: 'mysql-office',
            defaultUser: 'dopamine'
        },
        {
            network: 'office',
            name: 'dev-hermes-web1',
            ip: '192.168.106.32',
            location: 'Sofia2-Telepoint',
            type: 'web',
            defaultUser: 'dopamine'
        },
        {
            network: 'office',
            name: 'dev-hermes-web2',
            ip: '192.168.106.33',
            location: 'Sofia2-Telepoint',
            type: 'web',
            defaultUser: 'dopamine'
        }
    ]
}
module.exports = Config