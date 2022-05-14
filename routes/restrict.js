const express = require('express')
const router = express.Router()
const client = require('../db/redis')
const utils = require('../utils')

const IPInfo = require('../db/mongodb/IPInfo')

const {IPInfo_id} = require('../config')

router.post('/', (req, res) => {
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

        IPInfo.findById(IPInfo_id, {_id: 0}).then(info => {
            if (!info) return res.send({
                code: 4,
                msg: "DB not data"
            })
            res.send({
                code: 0,
                msg: 'ok',
                data: info
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
});
router.post('/switch', (req, res) => {
    let {token, option} = req.body
    if (!token || !option) {
        return res.send({
            code: 2,
            msg: 'arguments is null'
        })
    }
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
        option = JSON.parse(utils.RsaPrivateKeyDecrypt(option))
    } catch {
        return res.send({
            code: 2,
            msg: "token Error"
        })
    }
    if (typeof option[0] !== 'string' || typeof option[1] !== 'boolean') {
        return res.send({
            code: 2,
            msg: 'arguments error'
        })
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
        let updateOption = {}
        if (option[0] === 'wifi') {
            updateOption['startupWifi'] = option[1]
        } else if (option[0] === 'ip') {
            updateOption['startupIP'] = option[1]
        } else {
            return res.send({
                code: 2,
                msg: 'arguments error'
            })
        }
        IPInfo.findOneAndUpdate({_id: IPInfo_id}, updateOption, {new: true, ips: 0}).then(async obj => {
            if (!obj) return res.send({
                code: 1,
                msg: '操作失败，未知错误！'
            })
            let startupWifi = obj.startupWifi,
                startupIP = obj.startupIP
            await client.set('verifyInfo', JSON.stringify({startupWifi, startupIP}))
            res.send({
                code: 0,
                msg: 'ok'
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
router.post('/addWifi', (req, res) => {
    let {token, option} = req.body
    let macReg = /^[\d|a-zA-Z]{2}(?::[\d|a-zA-Z]{2}){5}$/
    if (!token || !option) {
        return res.send({
            code: 2,
            msg: 'arguments is null'
        })
    } else {
        try {
            token = utils.RsaPrivateKeyDecrypt(token)
            option = JSON.parse(utils.RsaPrivateKeyDecrypt(option))
        } catch {
            return res.send({
                code: 2,
                msg: "token Error"
            })
        }
    }
    if (typeof option['SSID'] !== 'string' || typeof option['BSSID'] !== 'string' || !option['SSID'] || !macReg.test(option['BSSID'])) {
        return res.send({
            code: 2,
            msg: 'arguments error'
        })
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

        IPInfo.findById(IPInfo_id, {_id: 0, wifiList: 1}).then(wifiListObj => {
            if (!wifiListObj) return res.send({
                code: 4,
                msg: "DB not data"
            })
            let list = wifiListObj['wifiList']
            let repetitive = false
            let updateOption = {
                SSID: option.SSID,
                BSSID: option.BSSID
            }
            for (const listElement of list) {
                if (updateOption.BSSID === listElement.BSSID) {
                    repetitive = true
                    break
                }
            }
            if (repetitive) return res.send({
                code: 1,
                msg: 'mac地址已存在，请勿重复添加'
            })
            IPInfo.updateOne({_id: IPInfo_id}, {$push: {'wifiList': updateOption}}).then(obj => {
                if (!obj.matchedCount) return res.send({
                    code: 1,
                    msg: '操作失败，未知错误！'
                })
                res.send({
                    code: 0,
                    msg: 'ok'
                })
            }).catch(e => {
                console.error(e)
                res.send({
                    code: 4,
                    msg: 'server error'
                })
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
router.post('/addIP', (req, res) => {
    let {token, option} = req.body
    let ipReg = /^\d{1,3}(?:\.\d{1,3}){2}\.\*\*$/
    if (!token || !option) return res.send({
        code: 2,
        msg: 'arguments is null'
    })
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
        option = JSON.parse(utils.RsaPrivateKeyDecrypt(option))
    } catch {
        return res.send({
            code: 2,
            msg: "token Error"
        })
    }
    if (typeof option['ip'] !== 'string' || typeof option['region'] !== 'string' || !option['region'] || !ipReg.test(option['ip'])) {
        return res.send({
            code: 2,
            msg: 'arguments error'
        })
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

        IPInfo.findById(IPInfo_id, {_id: 0, ips: 1}).then(ipsObj => {
            if (!ipsObj) return res.send({
                code: 4,
                msg: "DB not data"
            })
            let list = ipsObj['ips']
            let repetitive = false
            let updateOption = {
                ip: option.ip,
                region: option.region
            }
            for (const listElement of list) {
                if (updateOption.ip === listElement.ip) {
                    repetitive = true
                    break
                }
            }
            if (repetitive) return res.send({
                code: 1,
                msg: 'ip地址已存在，请勿重复添加'
            })
            IPInfo.updateOne({_id: IPInfo_id}, {$push: {'ips': updateOption}}).then(obj => {
                if (!obj.matchedCount) return res.send({
                    code: 1,
                    msg: '操作失败，未知错误！'
                })
                res.send({
                    code: 0,
                    msg: 'ok'
                })
            }).catch(e => {
                console.error(e)
                res.send({
                    code: 4,
                    msg: 'server error'
                })
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
router.post('/delWifiOrIP', (req, res) => {
    let {token, _id, BSSID, ip, type = 'wifi'} = req.body
    if (!token) return res.send({
        code: 2,
        msg: 'token is null'
    })

    if (!_id && !BSSID && !ip) return res.send({
        code: 2,
        msg: 'arguments is null'
    })
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
        _id && (_id = utils.RsaPrivateKeyDecrypt(_id))
    } catch {
        return res.send({
            code: 2,
            msg: "token Error"
        })
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
            msg: 'Not the superuser'
        })

        let updateOption = {}
        let result
        if (_id) result = {_id}
        else if (type === 'ip') result = {ip}
        else result = {BSSID}

        if (type === 'ip') updateOption['ips'] = result
        else updateOption['wifiList'] = result

        IPInfo.updateOne({_id: IPInfo_id}, {$pull: updateOption}).then(info => {
            if (!info.matchedCount) return res.send({
                code: 1,
                msg: '操作失败，未知错误！'
            })
            res.send({
                code: 0,
                nsg: 'ok'
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

module.exports = router
