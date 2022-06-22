const express = require('express')
const router = express.Router()
const utils = require('../utils')

const user = require('../db/mongodb/user')
const userList = require('../db/mongodb/userList')
const clockList = require('../db/mongodb/clockList')

const {getDateFn} = require('../utils/DBMethod')

router.post('/member', (req, res) => {
    let {token, page, limit} = req.body
    if (!token) {
        return res.send({
            code: 2,
            msg: 'token is null'
        })
    } else {
        try {
            token = utils.RsaPrivateKeyDecrypt(token)
        } catch {
            return res.send({
                code: 2,
                msg: "Error token"
            })
        }
    }
    utils.jwt2Redis(token).then(d => {
        if (!d.data || typeof d.data !== 'string') {
            return res.send({
                code: 1,
                msg: 'sid expired',
            })
        }

        let _d = JSON.parse(d.data)
        if (!_d.super) return res.send({
            code: -1,
            msg: 'Not the superuser',
        })

        let projection = {openid: 0, phone: 0, ifClock: 0, reqDate: 0}
        let options = {sort: {'super': -1}}
        if (typeof page !== 'number' || typeof limit !== 'number') {
            options['limit'] = 100
        } else {
            options['limit'] = limit
            options['skip'] = limit * (page - 1)
        }

        user.find({}, projection, options).then(data => {
            res.send({
                code: 0,
                data
            })
        }).catch(e => {
            console.error(e)
            res.send({
                code: 4,
                msg: 'server error'
            })
        })
    }).catch((obj) => {
        let code = obj.code
        console[code === 4 ? 'error' : 'log'](obj.e)
        res.send({
            code,
            msg: code === 4 ? 'server error' : 'Token expired'
        })
    })
})
router.post('/apply', (req, res) => {
    let token = req.body.token
    if (!token) {
        return res.send({
            code: 2,
            msg: 'token is null'
        })
    } else {
        try {
            token = utils.RsaPrivateKeyDecrypt(token)
        } catch {
            return res.send({
                code: 2,
                msg: "Error token"
            })
        }
    }
    utils.jwt2Redis(token).then(d => {
        if (!d.data || typeof d.data !== 'string') {
            return res.send({
                code: 1,
                msg: 'sid expired',
            })
        }

        let _d = JSON.parse(d.data)
        if (!_d.super) return res.send({
            code: -1,
            msg: 'Not the superuser',
        })

        userList.find({'state': false}, {openid: 0, state: 0, phone: 0, reqDate: 0}).then(data => {
            res.send({
                code: 0,
                data
            })
        }).catch(e => {
            console.error(e)
            res.send({
                code: 4,
                msg: 'server error'
            })
        })
    }).catch((obj) => {
        let code = obj.code
        console[code === 4 ? 'error' : 'log'](obj.e)
        res.send({
            code,
            msg: code === 4 ? 'server error' : 'Token expired'
        })
    })
})
router.post('/clock', (req, res) => {
    let token = req.body.token
    if (!token) {
        return res.send({
            code: 2,
            msg: 'token is null'
        })
    }
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
    } catch {
        return res.send({
            code: 2,
            msg: "Error token"
        })
    }
    utils.jwt2Redis(token).then(d => {
        if (!d.data || typeof d.data !== 'string') {
            return res.send({
                code: 1,
                msg: 'sid expired',
            })
        }
        let minLimitTime = new Date(getDateFn()).getTime(),
            maxLimitTime = new Date().getTime()
        clockList.find(
            {reqDate: {$gte: minLimitTime, $lt: maxLimitTime}},
            {sCode: 1, reqDate: 1, _id: 0},
            {sort: {reqDate: -1}}
        ).populate('clockID', {openid: 0, phone: 0, reqDate: 0, ifClock: 0}).then(data => {
            let newArr = data
            if (data.length > 1) {
                let temporaryArr = []
                newArr = data.filter((item) => {
                    let bool = false
                    if (item.clockID && temporaryArr.indexOf(item.clockID._id.toString()) === -1) {
                        temporaryArr.push(item.clockID._id.toString())
                        bool = true
                    }
                    return bool
                })
            }
            res.send({
                code: 0,
                data: newArr,
            })
        }).catch(e => {
            console.error(e)
            res.send({
                code: 4,
                msg: "server error"
            })
        })
    }).catch((obj) => {
        let code = obj.code
        console[code === 4 ? 'error' : 'log'](obj.e)
        res.send({
            code,
            msg: code === 4 ? 'server error' : 'Token expired'
        })
    })
})
router.post('/ranking', (req, res) => {
    let {token, date = 'week'} = req.body
    if (!token) return res.send({
        code: 2,
        msg: 'token is null'
    })
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
    } catch {
        return res.send({
            code: 2,
            msg: "Error token"
        })
    }
    utils.jwt2Redis(token).then(async d => {
        if (!d.data || typeof d.data !== 'string') {
            return res.send({
                code: 1,
                msg: 'sid expired',
            })
        }
        let _d = JSON.parse(d.data)
        let opID = utils.AESDecode(_d.opID)

        let userObj = null

        // 由于 await 只支持 Promise 而不支持 find 的回调，所以为了同步查询套一个 Promise
        await new Promise(resolve => {
            user.findOne({openid: opID}, {openid: 0, phone: 0, reqDate: 0, ifClock: 0})
                .lean()
                .exec((error, result) => {
                    if (!error && result) userObj = {
                        clockID: result,
                        duration: 0,
                        ranking: -1
                    }
                    resolve()
                })
        }).then()

        let minLimitTime = new Date(getDateFn()).getTime(),
            maxLimitTime = new Date().getTime()
        let x = date === 'week' ? new Date().getDay() : new Date().getDate()
        if (!x) x = 7
        minLimitTime -= --x * 24 * 60 * 60 * 1000

        clockList.find(
            {sCode: 1, reqDate: {$gte: minLimitTime, $lt: maxLimitTime}},
            {clockID: 1, duration: 1, _id: 0},
            {sort: {clockID: -1}}
        ).exec((err, result) => {
            if (err || !Array.isArray(result)) {
                console.error(err)
                return res.send({
                    code: 4,
                    msg: "server error"
                })
            }
            if (!result.length) return res.send({
                code: -1,
                msg: "ok",
                data: [[], userObj]
            })
            let containerMap = new Map()
            result.forEach(item => {
                let oldValue = containerMap.get(item['clockID'].toString())
                if (oldValue) item.duration += oldValue.duration
                containerMap.set(item['clockID'].toString(), item)
            })
            let newResult = [...containerMap.values()]
            newResult.sort((a, b) => {
                return b.duration - a.duration
            })
            // 获取当前ID月时长排名
            if (userObj) {
                let _id = userObj.clockID._id.toString()
                let valObj = containerMap.get(_id)

                if (valObj) {
                    let front = 0,
                        rear = newResult.length,
                        i = Math.floor(rear / 2)
                    let m = 0

                    do {
                        if (newResult[i].clockID.toString() === _id) {
                            userObj.duration = newResult[i].duration
                            userObj.ranking = i + 1
                            break
                        }
                        if (newResult[i].duration === valObj.duration) {
                            let _i = i
                            let br = {
                                left: true,
                                right: true
                            }
                            let duration = _duration = 0,
                                constant = valObj.duration
                            while (true) {
                                // 左右平移取值
                                _i--
                                i++
                                _duration = newResult[_i].duration
                                duration = newResult[i].duration
                                // 跳出判断
                                if (br.left) {
                                    if (_duration !== constant) br.left = false
                                    else if (newResult[_i].clockID.toString() === _id) {
                                        userObj.duration = _duration
                                        userObj.ranking = _i + 1
                                        break
                                    }
                                }
                                if (br.right) {
                                    if (duration !== constant) br.left = false
                                    else if (newResult[i].clockID.toString() === _id) {
                                        userObj.duration = duration
                                        userObj.ranking = i + 1
                                        break
                                    }
                                }
                                // 跳出内层循环（恶性情况）
                                if (!br.left && !br.right) break
                            }
                            // 跳出外层循环
                            break
                        }
                        if (newResult[i].duration > valObj.duration) front = i
                        else rear = i
                        m = Math.floor((rear - front) / 2)
                        i = front + m
                    } while (true)
                }
            }
            clockList.populate(newResult, [{
                path: 'clockID',
                select: {openid: 0, phone: 0, reqDate: 0, ifClock: 0}
            }], (error, result) => {
                if (err || !Array.isArray(result)) {
                    console.error(err)
                    return res.send({
                        code: 4,
                        msg: "server error"
                    })
                }
                res.send({
                    code: 0,
                    msg: 'ok',
                    data: [result, userObj]
                })
            })
        })
    }).catch((obj) => {
        let code = obj.code
        console[code === 4 ? 'error' : 'log'](obj.e)
        res.send({
            code,
            msg: code === 4 ? 'server error' : 'Token expired'
        })
    })
})

module.exports = router
