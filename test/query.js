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
let redisKey = 'cache-koa-middleware:/query?age=10&sex=male'
let redisKey2 = 'cache-koa-middleware:/query?age=10&sex=female'

router.get('/weird-path', cache1, ctx => {
  console.log('Not from cache, count:', count)
  ctx.cookies.set('token', 'secret')
  ctx.body = {count: count++}
})

function clearCacheAndCounter(done) {
  count = 0
  Promise.all([
    redis.del(redisKey),
    redis.del(redisKey2)
  ])
    .then(() => {
      done()
    })
}

describe('Test query string', function () {
  before('clear cache and counter', clearCacheAndCounter)

  it('1st', function (done) {
    request()
      .get('/weird-path?age=10&sex=male')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('set-cookie', 'token=secret; path=/; httponly')
      .expect(200, {count: 0}, done)
  })

  it('same url, same query', function (done) {
    request()
      .get('/weird-path?age=10&sex=male')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('set-cookie', 'token=secret; path=/; httponly')
      .expect(200, {count: 0}, done)
  })

  it('different url, same query', function (done) {
    request()
      .get('/weird-path?sex=male&age=10&#1')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('set-cookie', 'token=secret; path=/; httponly')
      .expect(200, {count: 0}, done)
  })

  it('different query', function (done) {
    request()
      .get('/weird-path?age=10&sex=female')
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect('set-cookie', 'token=secret; path=/; httponly')
      .expect(200, {count: 1}, done)
  })
})

