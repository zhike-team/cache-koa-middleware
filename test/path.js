const cache = require('../index')
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
  return supertest(app.listen());
}

const cache1 = cache({
  redisClient: redis,
  expireSeconds: 3, // keep 3 seconds
})

let count = 0
let redisKey = 'cache-koa-middleware:/weird-path'

router.all('/weird-path', cache1, ctx => {
  console.log('Not from cache, count:', count)
  ctx.cookies.set('token', 'secret')
  ctx.body = {count: count++}
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

describe('Cache GET request', function () {
  before('clear cache and counter', clearCacheAndCounter)

  it('1st', function (done) {
    request()
      .get('/weird-path')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('set-cookie', 'token=secret; path=/; httponly')
      .expect(200, {count: 0}, done)
  })

  it('2nd', function (done) {
    request()
      .get('/weird-path')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('set-cookie', 'token=secret; path=/; httponly')
      .expect(200, {count: 0}, done)
  })
})

describe('Skip POST request', function () {
  before('clear cache and counter', clearCacheAndCounter)

  it('1st', function (done) {
    request()
      .post('/weird-path')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('set-cookie', 'token=secret; path=/; httponly')
      .expect(200, {count: 0}, done)
  })

  it('2nd', function (done) {
    request()
      .get('/weird-path')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('set-cookie', 'token=secret; path=/; httponly')
      .expect(200, {count: 1}, done)
  })
})

describe('Cache expires', function () {
  before('clear cache and counter', clearCacheAndCounter)

  it('1st', function (done) {
    request()
      .get('/weird-path')
      .expect(200, {count: 0}, done)
  })

  it('2nd expire', function (done) {
    this.timeout(5000);
    setTimeout(() => {
      request()
        .get('/weird-path')
        .expect(200, {count: 1}, done)
    }, 4 * 1000)
  })

})
