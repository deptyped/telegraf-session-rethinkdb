const debug = require('debug')('telegraf:session-rethink')
let util  = require('util');
let deeq  = require('deep-equal');
let inspect = (o, depth = 1) => console.log(util.inspect(o, { colors: true, depth }));
const r = require('rethinkdb')

class RethinkSessionError extends Error {

}

class RethinkSession {

  constructor(connection, options) {
    this.options = Object.assign({
      property: 'session',
      table: '_telegraf_sessions',
      db: 'test',
      getSessionKey(ctx) {
        if(!ctx.chat || !ctx.from) { return; }
        return `${ctx.chat.id}:${ctx.from.id}`;
      },
    }, options);
    this.connection = connection;
  }

  async getSession(key) {
    debug('Getting session for %s', key);
    const document = await r.table(this.options.table).get(key).run(this.connection)

    if (document !== null) {
      document.id = key
    }

    return (document || { id: key })
  }

  async saveSession(key, data) {
    if(!data || Object.keys(data).length === 0) {
      debug(`Deleting session: ${key}`);
      return await r.table(this.options.table).get(key).delete().run(this.connection)
    }
    debug('Saving session %s %o', key, data);
    await r.table(this.options.table).insert(data, {conflict: 'replace'}).run(this.connection)
  }

  getWrappedStorage(storage) {
    debug('Initializing session: %o', storage);
    const $set = {}
    const $unset = {}
    var dirty = false;
    const access = new Proxy(storage, {
      get(target, property, receiver) {
        switch(property)
        {
          case '__dirty':
            return dirty;
          default:
            // debug(`Get: ${property}`);
            // inspect(target);
            return Reflect.get(target, property, receiver);
        }
      },
      set(target, property, value, receiver) {
        if(!target[property] || (target[property] && !deeq(target[property], value))) {
          dirty = true;
          debug('setting %s made object dirty', property);
        }
        Reflect.set(target, property, value, receiver);
        $set[`data.${property}`] = value;
        delete $unset[property];
        return true;
      },
      deleteProperty(target, property, receiver) {
        debug('delete %s', property);
        Reflect.deleteProperty(target, property, receiver);
        delete $set[property];
        $unset[`data.${property}`] = '';
        dirty = true;
        return true;
      }
    });
    return access;
  }

  get middleware() {
    return async (ctx, next) => {
      const key = this.options.getSessionKey(ctx);
      if(!key) { return await next(); }

      let session = this.getWrappedStorage(await this.getSession(key));

      Object.defineProperty(ctx, this.options.property, {
        get() { return session },
        set(value) { session = Object.assign({}, value); }
      });

      await next();
      await this.saveSession(key, session);
    }
  }

  async setup() {
    try {
      await r.dbCreate(this.options.db).run(this.connection)
    } catch(e) {
      debug(e)

      if (e.msg.includes("already exists") !== true) {
        throw e
      }
    }
    try {
      await r.tableCreate(this.options.table).run(this.connection)
    } catch(e) {
      debug(e)

      if (e.msg.includes("already exists") !== true) {
        throw e
      }
    }
  }
}

module.exports = RethinkSession
module.exports.RethinkSessionError = RethinkSessionError
