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
        let minLimitTime = new Date(getDateFn()).getTime()
        maxLimitTime = new Date().getTime()
        clockList.find(
            {reqDate: {$gte: minLimitTime, $lt: maxLimitTime}},
            {sCode: 1, reqDate: 1, _id: 0},
            {sort: {reqDate: -1}}
        ).populate('clockID',{openid:0,phone:0,reqDate:0, ifClock: 0}).then(data => {
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

module.exports = router
