'use strict';

module.exports = (options) => {
  if (!(options instanceof Object)) {
    throw new Error('options must be an Object');
  }

  const redis = options.redisClient;
  if (typeof redis !== 'object') {
    throw new Error('options.redisClient must be an instance ioredis(https://www.npmjs.com/package/ioredis)');
  }

  const expireSeconds = options.expireSeconds;
  if (!(Number.isInteger(expireSeconds) && expireSeconds > 0)) {
    throw new Error('options.expireSeconds must be an integer larger than zero');
  }

  let keyFn = ctx => {
		let sortedKeys = Object.keys(ctx.query).sort();
		let sortedSearchString = sortedKeys.length > 0 ? '?' : '';
		for(let key of sortedKeys){
			sortedSearchString += `${key}=${ctx.query[key]}`;
		}
    return 'cache-koa-middleware:' + ctx.path + sortedSearchString;
  }
  if (options.keyGenerator) {
    if (typeof options.keyGenerator === 'function') {
      keyFn = options.keyGenerator;
    }
    else {
      throw new Error('options.keyGenerator must be a function which returns a string as redis key');
    }
  }

  return async (ctx, next) => {
  	if(ctx.method !== 'GET'){
			await next();
		}
		else{
			let redisKey = keyFn(ctx);
			let responseInCache = await redis.get(redisKey);
			if(responseInCache){
				let response = JSON.parse(responseInCache);
				ctx.set(response.headers);
				ctx.body = response.body;
				return;
			}

			// if hit cache, use cache
			await next();

			// if GET request has a 200 OK text response, then set cache
			if(ctx.status === 200 && (typeof ctx.body === 'object' || typeof ctx.body === 'string')){
				let response = {
					headers: ctx.response.headers,
					body: ctx.body
				};
				redis.set(redisKey, JSON.stringify(response), 'EX', expireSeconds);
			}
		}
  }

}
