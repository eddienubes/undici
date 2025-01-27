'use strict'

const { test } = require('tap')
const { Client } = require('..')
const { createServer } = require('node:http')
const FakeTimers = require('@sinonjs/fake-timers')
const timers = require('../lib/timers')

test('multiple reconnect', (t) => {
  t.plan(5)

  let n = 0
  const clock = FakeTimers.install()
  t.teardown(clock.uninstall.bind(clock))

  const orgTimers = { ...timers }
  Object.assign(timers, { setTimeout, clearTimeout })
  t.teardown(() => {
    Object.assign(timers, orgTimers)
  })

  const server = createServer((req, res) => {
    n === 0 ? res.destroy() : res.end('ok')
  })
  t.teardown(server.close.bind(server))

  server.listen(0, () => {
    const client = new Client(`http://localhost:${server.address().port}`)
    t.teardown(client.destroy.bind(client))

    client.request({ path: '/', method: 'GET' }, (err, data) => {
      t.ok(err)
      t.equal(err.code, 'UND_ERR_SOCKET')
    })

    client.request({ path: '/', method: 'GET' }, (err, data) => {
      t.error(err)
      data.body
        .resume()
        .on('end', () => {
          t.ok(true, 'pass')
        })
    })

    client.on('disconnect', () => {
      if (++n === 1) {
        t.ok(true, 'pass')
      }
      process.nextTick(() => {
        clock.tick(1000)
      })
    })
  })
})
