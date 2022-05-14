/* 本项目公共数据 */

// 微信小程序
const appID = 'wxfde4d38d1d077cdb'
const appSecret = '8a82209c3b98753135c11666cf39f2f8'

//Token and RedisData invalid time
const tokenOrRedisTime = 4 * 24 * 3600

// update Token minimum time
const tokenUpdateTime = 24 * 3600

// Redis key length
const redisKeyLength = 20

// 数据库中打卡限制信息的id
const IPInfo_id = "627887b653de08d0376d9572"

module.exports = {
    appID,
    appSecret,
    tokenOrRedisTime,
    tokenUpdateTime,
    IPInfo_id,
    redisKeyLength
}
