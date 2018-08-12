# Node MySQLDumper
This is customized for our needs mysql dumper. It supports so far:
- Flexible table/columns excluding
- SSH connections
- Output modifiers (like sorted keys)
- Export data/schema beautification
- Modifiers


### Example Usage
Dump data and schema of all tables
```nodejs
const MySQLDumper = require('dopamine-toolbox').MySQLDumper

MySQLDumper.dump({
    connection: {
        host: 'localhost',
        user: 'some-mysql-user',
        password: 'some-pass',
        database: 'some-dbname',
        ssh: null
    },
    dest: './dump.sql',
    exportData: true
})
```

Dump only schema of all tables using SSH
```nodejs
const MySQLDumper = require('dopamine-toolbox').MySQLDumper

MySQLDumper.dump({
    connection: {
        host: 'localhost',
        user: 'some-mysql-user',
        password: 'some-pass',
        database: 'some-dbname',
        ssh: null
    },
    ssh: {
        host: '192.168.XXX.XXX',
        user: 'some-ssh-user',
        agent: 'pageant',
        agentForward: true
    },
    
    dest: './dump.sql',
    exportData: false
})
```

Fully customized export (showing all available options)
```nodejs
const dump = require('dopamine-toolbox').MySQLDumper.dump

dump({
    connection: {
        host: 'localhost',
        user: 'some-mysql-user',
        password: 'some-pass',
        database: 'some-dbname',
        ssh: {
            host: '192.168.XXX.XXX',
            user: 'some-ssh-user',
            agent: 'pageant',
            agentForward: true
        }
    },
    
    dest: './dump.sql',
    
    modifiers: [
        (output) => output.replace(/ AUTO_INCREMENT=\d+/g, '')
    ],
    
    excludeTables: ['some-table-A'],
    excludeColumns: {
        'some-table-B': ['some-column1']
        'some-table-C': ['some-column2', 'some-column3']
    },
    sortKeys: true,
    exportData: false // be careful with this option on mirrors
})
```