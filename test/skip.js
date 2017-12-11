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
app.use(async (ctx, next) => {
	try{
		await next()
	}
	catch(e){
		console.log(e)
	}
})

app.use(router.routes())

function request() {
	return supertest(app.listen());
}

const cache1 = cache({
	redisClient: redis,
	skipCacheFn: (ctx, redisKey) => {
		if (ctx.headers['x-skip-secret'] === 'right') {
			return Promise.resolve(true)
		}
		else {
			return Promise.resolve(false)
		}
	},
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

describe('Skip Cache Fn', function () {
	before('clear cache and counter', clearCacheAndCounter)

	it('1st', function (done) {
		request()
			.get('/weird-path')
			.expect('Content-Type', 'application/json; charset=utf-8')
			.expect('set-cookie', 'token=secret; path=/; httponly')
			.expect(200, {count: 0}, done)
	})

	it('not skip cache', function (done) {
		request()
			.get('/weird-path')
			.set({'x-skip-secret': 'wrong'})
			.expect('Content-Type', 'application/json; charset=utf-8')
			.expect('set-cookie', 'token=secret; path=/; httponly')
			.expect(200, {count: 0}, done)
	})

	it('skip cache', function (done) {
		request()
			.get('/weird-path')
			.set({'x-skip-secret': 'right'})
			.expect('Content-Type', 'application/json; charset=utf-8')
			.expect('set-cookie', 'token=secret; path=/; httponly')
			.expect(200, {count: 1}, done)
	})

})

