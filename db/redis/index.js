const redis = require("redis");

const client = redis.createClient({
    url: 'redis://:8023@127.0.0.1:6379'
})

client.on('error', (err) => console.log('Redis Client Error', err))
client.connect().then(() => console.log('Redis 连接成功')).catch(e => console.log('Redis 连接失败', e));

module.exports = client

