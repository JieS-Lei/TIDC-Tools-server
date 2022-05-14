const express = require('express')
const router = express.Router()
const utils = require('../utils')
const client = require('../db/redis')

const user = require('../db/mongodb/user')
const clockList = require('../db/mongodb/clockList')
const IPInfo = require('../db/mongodb/IPInfo');

const {getDuration} = require('../utils/DBMethod')
const {IPInfo_id, tokenOrRedisTime, redisKeyLength} = require('../config')
const userList = require("../db/mongodb/userList");

// 打卡验证函数
const verify = function verify(wifiInfo, ipInfo) {
    return new Promise((resolve, reject) => {
            let wifiVerify, ipVerify
            IPInfo.findById(IPInfo_id).then(infoObj => {
                if (!infoObj) return reject(new Error('DB IPInfo not found'))
                if (infoObj['startupWifi'] && infoObj['wifiList']['length']) {
                    wifiVerify = false
                    if (typeof wifiInfo !== 'undefined' && typeof wifiInfo['SSID'] === 'string' && typeof wifiInfo['BSSID'] === 'string') {
                        for (const wifiListElement of infoObj['wifiList']) {
                            if (wifiInfo.SSID === wifiListElement.SSID && wifiInfo.BSSID === wifiListElement.BSSID) {
                                wifiVerify = true
                                break
                            }
                        }
                    }
                }
                if (infoObj['startupIP'] && infoObj['ips']['length']) {
                    ipVerify = false
                    if (typeof ipInfo !== 'undefined' && typeof ipInfo['ip'] === 'string') {
                        for (const ipsElement of infoObj['ips']) {
                            if (ipInfo.ip === ipsElement.ip) {
                                ipVerify = true
                                break
                            }
                        }
                    }
                }
                let sendObj = {
                    ipVerify: true,
                    wifiVerify: true
                }
                if (typeof ipVerify === 'boolean') sendObj.ipVerify = ipVerify
                if (typeof wifiVerify === 'boolean') sendObj.wifiVerify = wifiVerify
                resolve(sendObj)
            }).catch(e => reject(e))
        }
    )
}

router.get('/getVerify', async (req, res) => {
    let verifyInfo = await client.get('verifyInfo')
    let msg = ''
    if (!verifyInfo) {
        await IPInfo.findById(IPInfo_id).then(infoObj => {
            if (!infoObj) return msg = 'DB IPInfo not found'
            verifyInfo = {
                startupWifi: infoObj['startupWifi'],
                startupIP: infoObj['startupIP']
            }
        }).catch(e => {
            console.error(e)
            msg = 'server error'
        })
    } else verifyInfo = JSON.parse(verifyInfo)
    if (!msg) {
        res.send({
            code: 0,
            msg: 'ok',
            data: verifyInfo
        })
    } else {
        res.send({
            code: 4,
            msg
        })
    }

})
router.post('/getDayDuration', (req, res) => {
    let token = req.body.token
    if (!token) {
        return res.send({
            code: 2,
            msg: "token is null"
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
                msg: "sid expired",
            })
        }
        let _d = JSON.parse(d.data)
        if (!_d.member) {
            return res.send({
                code: 0,
                data: utils.AESEncryption(JSON.stringify({
                    time: 0,
                    frequency: 0
                }))
            })
        }
        user.findOne({openid: utils.AESDecode(_d.opID)}).then(userObj => {
            if (!userObj) return res.send({
                code: 2,
                msg: 'user not found'
            })
            getDuration(userObj._id, 'day').then(timeObj => {
                res.send({
                    code: 0,
                    msg: 'ok',
                    data: utils.AESEncryption(JSON.stringify(timeObj))
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
router.post('/clock', (req, res) => {
    let {token, wifiInfo, ipInfo} = req.body
    if (!token) return res.send({
        code: 2,
        msg: 'token is null'
    })
    if (typeof wifiInfo !== 'undefined' && typeof wifiInfo !== 'string') return res.send({
        code: 2,
        msg: 'wifiInfo error'
    })
    if (typeof ipInfo !== 'undefined' && typeof ipInfo !== 'string') return res.send({
        code: 2,
        msg: 'ipInfo error'
    })
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
        wifiInfo && (wifiInfo = JSON.parse(utils.RsaPrivateKeyDecrypt(wifiInfo)))
        ipInfo && (ipInfo = JSON.parse(utils.RsaPrivateKeyDecrypt(ipInfo)))
    } catch {
        return res.send({
            code: 2,
            msg: "Error token"
        })
    }
    const errFn = function errFn(e) {
        console.error(e)
        res.send({
            code: 4,
            msg: 'server error'
        })
    }
    utils.jwt2Redis(token).then(d => {
        if (!d.data || typeof d.data !== 'string') {
            return res.send({
                code: 1,
                msg: 'sid expired',
            })
        }

        let _d = JSON.parse(d.data),
            sid = d.sid

        verify(wifiInfo, ipInfo).then(obj => {
            if (!obj.wifiVerify) return res.send({
                code: -1,
                msg: 'wifi 验证不通过'
            })
            if (!obj.ipVerify) return res.send({
                code: -1,
                msg: 'ip 验证不通过'
            })
            user.findOne({openid: utils.AESDecode(_d.opID)}, {openid: 0,}).then(userObj => {
                if (!userObj) return res.send({
                    code: 1,
                    msg: '用户不存在'
                })
                if (userObj.ifClock) return res.send({
                    code: 1,
                    msg: '您已打卡，请勿重复操作'
                })
                clockList.create({clockID: userObj._id}).then(clockInfo => {
                    if (!clockInfo) return res.send({
                        code: 3,
                        msg: 'clockList create fail'
                    })
                    user.findOneAndUpdate({_id: userObj._id}, {ifClock: clockInfo._id}, {new: true})
                        .then(updateInfo => {
                            if (!updateInfo || !updateInfo.ifClock) {
                                clockList.deleteOne({_id: clockInfo._id}).then()
                                return res.send({
                                    code: 1,
                                    msg: '操作失败，未知错误！'
                                })
                            }
                            _d.clockList.ifclock = true
                            _d.clockList.lastClock = new Date().getTime()
                            client.del(sid).then()
                            let newSid = utils.randomStr(redisKeyLength)
                            let newToken = utils.addToken({sid: newSid}, tokenOrRedisTime)
                            client.setEx(newSid, tokenOrRedisTime, JSON.stringify(_d)).then()
                            userList.updateOne({openid: _d.opID}, {token: sid}).then()
                            res.send({
                                code: 0,
                                msg: 'ok',
                                data: {
                                    time: clockInfo.reqDate,
                                    token: utils.AESEncryption(newToken),
                                    info: utils.AESEncryption(JSON.stringify({
                                        _id: userObj._id,
                                        studentID: userObj.studentID,
                                        studentClass: userObj.studentClass
                                    }))
                                }
                            })
                        })
                        .catch(e => {
                            user.updateOne({_id: userObj._id}, {ifClock: null}).then()
                            clockList.deleteOne({_id: clockInfo._id}).then()
                            errFn(e)
                        })
                }).catch(e => errFn(e))
            }).catch(e => errFn(e))
        }).catch(e => errFn(e))
    }).catch((obj) => {
        if (obj.code === 4) return errFn(obj.e)
        res.send({
            code: 1,
            msg: 'Token expired'
        })
    })
})
router.post('/quitClock', (req, res) => {
    let {token, wifiInfo, ipInfo} = req.body

    if (!token) return res.send({
        code: 2,
        msg: 'token is null'
    })
    if (typeof wifiInfo !== 'undefined' && typeof wifiInfo !== 'string') return res.send({
        code: 2,
        msg: 'wifiInfo error'
    })
    if (typeof ipInfo !== 'undefined' && typeof ipInfo !== 'string') return res.send({
        code: 2,
        msg: 'ipInfo error'
    })
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
        wifiInfo && (wifiInfo = JSON.parse(utils.RsaPrivateKeyDecrypt(wifiInfo)))
        ipInfo && (ipInfo = JSON.parse(utils.RsaPrivateKeyDecrypt(ipInfo)))
    } catch {
        return res.send({
            code: 2,
            msg: "Error token"
        })
    }
    const errFn = function errFn(e) {
        console.error(e)
        res.send({
            code: 4,
            msg: 'server error'
        })
    }
    utils.jwt2Redis(token).then(d => {
        if (!d.data || typeof d.data !== 'string') {
            return res.send({
                code: 1,
                msg: 'sid expired',
            })
        }
        let _d = JSON.parse(d.data),
            sid = d.sid

        verify(wifiInfo, ipInfo).then(async obj => {
            if (!obj.wifiVerify) return res.send({
                code: -1,
                msg: 'wifi 验证不通过'
            })
            if (!obj.ipVerify) return res.send({
                code: -1,
                msg: 'ip 验证不通过'
            })
            let userData, userErr
            await user.findOne({openid: utils.AESDecode(_d.opID)}, {openid: 0,})
                .populate('ifClock')
                .then(userObj => userData = userObj)
                .catch(e => userErr = e)
            if (userErr) return errFn()
            if (!userData) return res.send({
                code: 1,
                msg: '用户不存在'
            })
            if (!userData.ifClock) return res.send({
                code: 1,
                msg: '您还未打卡！'
            })
            let reqDate = utils.getTime(userData.ifClock.reqDate, {result: 'date'}),
                dayDate = utils.getTime({result: 'date'})
            let sCode = 1
            let updateOption = {
                endDate: new Date().getTime(),
            }

            if (reqDate !== dayDate) sCode = 0
            else updateOption['duration'] = updateOption.endDate - userData.ifClock.reqDate

            updateOption['sCode'] = sCode

            let clockData, clockErr
            await clockList.findOneAndUpdate({_id: userData.ifClock._id}, updateOption, {new: true})
                .then(clockInfo => clockData = clockInfo)
                .catch(e => clockErr = e)
            if (clockErr) return errFn()
            if (!clockData) return res.send({
                code: 3,
                msg: '操作失败，本次打卡数据未记录在库'
            })
            //
            user.updateOne({_id: userData._id}, {ifClock: null})
                .then(updateInfo => {
                    if (!updateInfo.matchedCount) return res.send({
                        code: 4,
                        msg: 'unknown error: user database update failed'
                    })

                    _d.clockList.ifclock = false
                    _d.clockList.monthFrequency += 1
                    if (sCode) {
                        _d.clockList.weekDuration += clockData.duration
                        _d.clockList.monthDuration += clockData.duration
                    }

                    client.del(sid).then()
                    let newSid = utils.randomStr(redisKeyLength)
                    let newToken = utils.addToken({sid: newSid}, tokenOrRedisTime)
                    client.setEx(newSid, tokenOrRedisTime, JSON.stringify(_d)).then()
                    userList.updateOne({openid: _d.opID}, {token: sid}).then()
                    let sendData = {
                        token: utils.AESEncryption(newToken),
                        _id: utils.AESEncryption(userData._id.toString())
                    }
                    let sendMsg = '当天未退卡，本次打卡无效'
                    if (sCode) {
                        sendMsg = 'ok'
                        sendData['duration'] = utils.AESEncryption(clockData.duration.toString())
                    }
                    res.send({
                        code: sCode ? 0 : -2,
                        msg: sendMsg,
                        data: sendData
                    })
                })
                .catch(e => {
                    user.updateOne({_id: userData._id}, {ifClock: null}).then()
                    errFn(e)
                })
        }).catch(e => errFn(e))
    }).catch((obj) => {
        if (obj.code === 4) return errFn(obj.e)
        res.send({
            code: 1,
            msg: 'Token expired'
        })
    })
})

module.exports = router
