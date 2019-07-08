const Logger = require('../src/lib/Logger')


async function test (exitCode, msg) {
    let logger = new Logger({})
    await logger.start()
    logger.end(exitCode, msg)
}

test(0, 'uhaaaa').catch(e => console.log(e))
test(1, 'ehaaa').catch(e => console.log(e))
test(2, 'ehaaa').catch(e => console.log(e))