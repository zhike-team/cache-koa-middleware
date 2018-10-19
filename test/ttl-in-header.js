const cache = require('..')
const Redis = require('ioredis')
const redis = new Redis()
const assert = require('assert')
const supertest = require('supertest')
const Koa = require('koa')
const Router = require('koa-router')
const router = new Router()

const app = new Koa()
app.proxy = true
app.use(router.routes())

function request() {
  return supertest(app.listen())
}

const clientMaxAgeHeader = 'x-max-age'

const cache1 = cache({
  redisClient: redis,
  expireSeconds: 3, // keep 3 seconds
  clientMaxAgeHeader: clientMaxAgeHeader
})

let count = 0
let redisKey = 'cache-koa-middleware:/weird-path'

router.all('/weird-path', cache1, ctx => {
  console.log('Not from cache, count:', count)
  ctx.cookies.set('token', 'secret')
  ctx.body = {
    count: count++
  }
})

function clearCacheAndCounter(done) {
  redis.del(redisKey, err => {
    count = 0
    if (err) {
      throw err
    }
    done()
  })
}

describe('Custom TTL header', function () {
  before('clear cache and counter', clearCacheAndCounter)

  it('1st', function (done) {
    request()
      .get('/weird-path')
      .expect(200)
      .end(done)
  })

  it('2nd', function (done) {
    this.timeout(5000);
    setTimeout(() => {
      request()
        .get('/weird-path')
        .expect(function (res) {
          console.log(res.headers)
          if(res.headers[clientMaxAgeHeader] !== '1'){
            throw new Error('Wrong TTL')
          }
        })
        .end(done)

    }, 2 * 1000)
  })

})