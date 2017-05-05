# RethinkDB session middleware for Telegraf

RethinkDB store-based session middleware for [Telegraf (Telegram bot framework)](https://github.com/telegraf/telegraf).

## Installation

```js
$ npm install @xqd/telegraf-session-rethinkdb --save
```

## Example
  
```js
const Telegraf = require('telegraf')
const RethinkSession = require('@xqd/telegraf-session-rethinkdb')
const r = require('rethinkdb')

const telegraf = new Telegraf(process.env.TOKEN)

const store = {
	host: process.env.RETHINKDB_HOST,
	port: process.env.RETHINK_PORT
}

r.connect(store).then(async (connection) => {
	let session = new RethinkSession(connection/*, options */)

	await session.setup()

	telegraf.use(session.middleware)

	telegraf.use((ctx, next) => {
	  ctx.session.counter = ctx.session.counter || 0
	  ctx.session.counter++
	  console.log('->', ctx.session) // -> { counter: 1, id: 'chatId:fromId' }

	  next()
	})

	telegraf.startPolling()
})
```

## API

### Options

* `property`: context property name (default: `"session"`)
* `table`: table name (default: `"_telegraf_session"`)
* `db`: db name (default: `"test"`)
* `getSessionKey`: session key function (context -> string)

Default session key depends on sender/chat:

```js
function getSessionKey(ctx) {
  return `${ctx.from.id}:${ctx.chat.id}`
}
```

### Destroying a session

To destroy a session simply set it to `null`.

```js
ctx.session = {}
```

## Credits
Used these projects as inspiration:  
- [telegraf/telegraf-session-rethinkdb](https://github.com/telegraf/telegraf-session-rethinkdb)  
- [ExceedeMedia/telegraf-session-mongo](https://github.com/ExceedeMedia/telegraf-session-mongo)
