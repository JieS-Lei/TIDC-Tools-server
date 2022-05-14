// noinspection SpellCheckingInspection

const express = require('express')
const router = express.Router()
const axios = require('axios')
const utils = require('../utils')

const client = require('../db/redis')
const user = require('../db/mongodb/user')
const userList = require('../db/mongodb/userList')

const {getDuration, getLastClockTime} = require('../utils/DBMethod');
const {appID, appSecret, tokenOrRedisTime, tokenUpdateTime, redisKeyLength} = require('../config')

// 验证是否需要更新时长数据
const ifUpdate = function ifUpdate(updataTime) {
    let updateRemarks = {
        monthUpdate: false,
        weekUpdate: false
    }
    let date = new Date()
    let nowYear = date.getFullYear(),
        nowMonth = date.getMonth() + 1,
        nowDay = date.getDay(),
        nowWeek = date.getDay()
    let {year, month, day, week} = updataTime
    if (year !== nowYear) {
        updateRemarks = {
            monthUpdate: true,
            weekUpdate: true
        }
    } else {
        if (month === nowMonth) {
            if (nowDay - day >= 7 || nowWeek - week < 0) updateRemarks.weekUpdate = true
        } else {
            updateRemarks.monthUpdate = true
            if (nowMonth - month > 1 || nowDay - 1 >= 7 || day <= 21) updateRemarks.weekUpdate = true
            else {
                let timestamp = new Date(`${year}/${month}/${day}`).getTime() + 7 * 24 * 3600 * 1000,
                    changeedDay = new Date(timestamp).getDate()
                if (changeedDay > 22 || nowDay - changeedDay >= 0) updateRemarks.weekUpdate = true
            }
        }
    }
    return updateRemarks
}
const getTimeFn = () => {
    let date = new Date()
    let year = date.getFullYear()
    let month = date.getMonth() + 1
    let week = date.getDay()
    let day = date.getDate()
    week = week || 7
    return {year, month, day, week}
}

/* GET users listing. */
// 登录接口
router.post('/login', function (req, res) {
    let code = req.body.code

    if (!code) return res.send({
        code: 2,
        msg: 'code is null'
    })

    try {
        code = utils.RsaPrivateKeyDecrypt(code)
    } catch {
        res.send({
            code: 2,
            msg: "Wrong encrypted Data"
        })
    }

    if (code.length !== 32) return res.send({
        code: 2,
        msg: 'code does not exist'
    });

    axios({
        method: "get", url: 'https://api.weixin.qq.com/sns/jscode2session',
        params: {
            grant_type: 'authorization_code',
            js_code: code,
            appid: appID,
            secret: appSecret
        }
    }).then(async d => {
        if (d.data['errcode']) return res.send({
            code: 3,
            msg: "Failed to obtain 'openID'",
            errCode: d.data['errcode']
        })
        let {openid} = d.data
        let opID = ''
        await utils.pbkdf2Async(openid).then(str => opID = str).catch(e => console.error(e))
        if (!opID) return res.send({
            code: 4,
            msg: "server error"
        })

        user.findOne({openid: opID})
            .then(async d => {
                let sid = utils.randomStr(redisKeyLength)
                let token = utils.addToken({sid}, tokenOrRedisTime)
                userList.updateOne({openid: opID}, {token: sid}).then()
                let option = {
                    updataTime: getTimeFn()
                }
                if (!d) {
                    option['clockList'] = {
                        ifclock: false,
                        weekDuration: 0,  // 周时长
                        monthDuration: 0, // 月时长
                        monthFrequency: 0,  // 月打卡次数
                        lastClock: 0  // 最后一次打卡时间
                    }
                    option['super'] = false
                    client.setEx(sid, tokenOrRedisTime, JSON.stringify({
                        opID: utils.AESEncryption(opID),
                        member: false,
                        ...option
                    })).then()
                    res.send({
                        code: 0, msg: "ok", data: utils.AESEncryption(JSON.stringify({
                            token,
                            Certification: '',
                            ...option
                        }))
                    })
                } else {
                    let weekDuration = 0, monthDuration = 0, monthFrequency = 0, lastClock = 0
                    await getDuration(d._id).then(d => weekDuration = d.time)
                    await getDuration(d._id, 'month').then(d => {
                        monthDuration = d.time
                        monthFrequency = d.frequency
                    })
                    await getLastClockTime(d._id).then(d => lastClock = d.time)
                    option['clockList'] = {
                        ifclock: !!d['ifClock'],
                        weekDuration,
                        monthDuration,
                        monthFrequency,
                        lastClock
                    }
                    option['super'] = d['super']
                    client.setEx(sid, tokenOrRedisTime, JSON.stringify({
                        opID: utils.AESEncryption(opID),
                        member: true,
                        ...option
                    })).then()
                    res.send({
                        code: 0, msg: "ok", data: utils.AESEncryption(JSON.stringify({
                            token,
                            Certification: d['name'],
                            ...option
                        }))
                    })
                }
            })
            .catch(e => {
                // 错误信息写入log文件
                // ....
                console.log(e)
                res.send({
                    code: 4,
                    msg: "server error"
                })
            })
    }).catch(e => {
        res.send({
            code: 4,
            msg: "'jscode2session' request failed",
            errMsg: e
        })
    })
});
// 验证token接口
router.post('/token', async function (req, res) {
    let token = req.body.token
    console.log(token)
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

    let token_error = ''
    await utils.verifyToken(token)
        .then(d => token = d)
        .catch(e => token_error = e.message)
    if (token_error) {
        let errMsg
        if (token_error === "jwt expired") errMsg = "token expired"
        else errMsg = "invalid token"
        return res.send({
            code: 1,
            msg: errMsg
        })
    }

    let _time = token.exp - parseInt(Date.now() / 1000)
    console.log('sid',token.sid)
    client.get(token.sid).then(async d => {
        if (typeof d !== 'string' || !d) {
            return res.send({
                code: 1,
                msg: "token expired",
            })
        }
        let _d = JSON.parse(d)
        let opID = utils.AESDecode(_d.opID)
        let updateRemarks = ifUpdate(_d.updataTime)
        let _id = null
        let updateMsg = ''
        let updateBool = false // 判断token是否更新
        let option = null
        if (updateRemarks.weekUpdate || updateRemarks.monthUpdate) {
            // 更新记录前先查询用户id
            updateBool = true
            option = {
                clockList: _d.clockList,
                updataTime: _d.updataTime
            }
            await user.findOne({openid: opID}, {_id: 1}).then(d => {
                if (!d) return updateMsg = '时长数据更新失败！未查询到用户~'
                _id = d._id
            }).catch(e => {
                console.error(e)
                updateMsg = '时长数据更新失败！服务器错误~'
            })
        }
        if (updateRemarks.weekUpdate && _id) {
            // 更新周记录
            await getDuration(_id).then(obj => {
                _d.clockList.weekDuration = option.clockList.weekDuration = obj.time
                _d.updataTime = option.updataTime = getTimeFn()
            }).catch(e => {
                console.log(e)
                updateMsg = '时长数据更新失败！服务器错误~'
            })
        }
        if (updateRemarks.monthUpdate && _id) {
            // 更新月记录
            await getDuration(_id, 'month').then(obj => {
                _d.clockList.monthDuration = option.clockList.monthDuration = obj.time
                _d.clockList.monthFrequency = option.clockList.monthFrequency = obj.frequency
                _d.updataTime = option.updataTime = getTimeFn()
            }).catch(e => {
                console.log(e)
                updateMsg = '时长数据更新失败！服务器错误~'
            })
        }
        if (_time < tokenUpdateTime) {
            updateBool = true
            option = {
                clockList: _d.clockList,
                updataTime: _d.updataTime
            }
        }

        if (updateMsg) option = updateMsg

        if (updateBool && !updateMsg) {
            client.del(token.sid).then()
            let sid = utils.randomStr(redisKeyLength)
            let newToken = utils.addToken({sid}, tokenOrRedisTime)
            client.setEx(sid, tokenOrRedisTime, JSON.stringify(_d)).then()
            userList.updateOne({openid: opID}, {token: sid}).then()
            // 更新token
            res.send({
                code: 0,
                msg: "Token update",
                data: utils.AESEncryption(JSON.stringify({
                    token: newToken,
                    ...option
                }))
            })
        } else {
            // 不更新token
            res.send({
                code: 0,
                msg: "Token exists",
                updateMsg: option
            })
        }

    }).catch(e => {
        // 将错误打印到日志文件
        // …………
        console.error(e)
        res.send({
            code: 4,
            msg: "server error"
        })
    })
})
// 验证超级用户权限
router.post('/super', function (req, res) {
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
        res.send({
            code: 0,
            msg: "ok",
            data: utils.AESEncryption(JSON.stringify({
                super: JSON.parse(d.data).super
            }))
        })
    }).catch((obj) => {
        let code = obj.code
        console[code === 4 ? 'error' : 'log'](obj.e)
        res.send({
            code,
            msg: code === 4 ? "server error" : 'Token expired'
        })
    })
})
// 申请加入接口
router.post('/join', function (req, res) {
    let token = req.body.token, details = req.body.details
    let RegStudentID = /^[c|C]?[2-5]\d{9}$/, RegName = /^[\u4e00-\u9fa5]{2,20}(·[\u4e00-\u9fa5]+)*$/,
        RegClass = /^[2-5]\d[\u4e00-\u9fa5]{2}(\d{1,2}|[\u4e00-\u9fa5]{2}\d?)班$/,
        RegPhone = /^(?:(?:\+|00)86)?1(?:3\d|4[5-7|9]|5[0-3|5-9]|6[2|5-7]|7[0-8]|8\d|9[1|89])\d{8}$/,
        RegUrl = /^(((ht|f)tps?):\/\/)?[\w-]+(.[\w-]+)+([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?$/
    if (!token || !details) return res.send({
        code: 2,
        msg: "missing required arguments"
    })
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
        details = JSON.parse(utils.RsaPrivateKeyDecrypt(details))
    } catch (e) {
        return res.send({
            code: 2,
            msg: "arguments error"
        })
    }
    let {studentID, name, _class, phone, sex, image} = details
    if (!studentID || !name || !_class || !phone || typeof sex !== 'number' || typeof image !== 'string') return res.send({
        code: 2,
        msg: "arguments lack"
    })
    let errMsg = ''
    {
        if (!RegStudentID.test(studentID)) errMsg = 'studentID error'
        if (!RegName.test(name)) errMsg = 'name error'
        if (!RegClass.test(_class)) errMsg = '_class error'
        if (!RegPhone.test(phone)) errMsg = 'phone error'
        if (sex !== 0 && sex !== 1) errMsg = 'sex error'
        if (!RegUrl.test(image)) errMsg = 'image error'
    }
    if (errMsg) return res.send({
        code: 2,
        msg: errMsg
    })
    utils.jwt2Redis(token).then(d => {
        if (!d.data || typeof d.data !== 'string') {
            return res.send({
                code: 1,
                msg: "sid expired",
            })
        }
        let _d = JSON.parse(d.data)
        let sid = d.sid
        let opID = utils.AESDecode(_d.opID)
        userList.findOne({openid: opID}).then(d => {
            if (d) {
                return res.send({
                    code: 1,
                    msg: d['state'] ? '已是正式成员' : '请勿重复操作'
                })
            }
            userList.create({
                openid: opID,
                token: sid,
                studentClass: _class,
                studentID,
                name,
                phone,
                sex,
                image
            }).then(() => {
                res.send({
                    code: 0,
                    msg: 'ok'
                })
            }).catch(e => {
                console.error(e)
                res.send({
                    code: 4,
                    msg: e.name
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
            msg: code === 4 ? "server error" : 'Token expired'
        })
    })
})
// 通过申请接口
router.post('/pass', function (req, res) {
    let {token, _id} = req.body
    if (!token || !_id) return res.send({
        code: 2,
        msg: "missing required arguments"
    })
    try {
        token = utils.RsaPrivateKeyDecrypt(token)
        _id = utils.RsaPrivateKeyDecrypt(_id)
    } catch (e) {
        return res.send({
            code: 2,
            msg: "arguments error"
        })
    }
    utils.jwt2Redis(token).then(d => {
        if (!d.data || typeof d.data !== 'string') {
            return res.send({
                code: 1,
                msg: "sid expired",
            })
        }
        let _d = JSON.parse(d.data)
        if (!_d.super) return res.send({
            code: -1,
            msg: 'Not the superuser',
        })
        userList.findById(_id, {_id: 0}).then(uObj => {
            if (!uObj) {
                return res.send({
                    code: 1,
                    msg: 'user was not found'
                })
            }
            if (uObj['state']) {
                return res.send({
                    code: 1,
                    msg: '已是正式成员'
                })
            }
            let {openid, image, studentID, name, phone, sex, studentClass, reqDate} = uObj
            user.create({
                openid, image, studentID, name, phone, sex, studentClass, reqDate
            }).then(() => {
                res.send({
                    code: 0,
                    msg: 'ok'
                })
                userList.updateOne({_id}, {state: true, token: null}).then(obj => {
                    if (!obj.matchedCount) console.log('state状态修改失败，_id：' + _id)
                }).catch(e => console.error(e))
                client.del(uObj['token']).then()
            }).catch(e => {
                console.error(e)
                res.send({
                    code: 4, msg: 'server error'
                })
            })
        }).catch(e => {
            console.error(e)
            res.send({
                code: 4, msg: 'server error'
            })
        })
    }).catch((obj) => {
        let code = obj.code
        console[code === 4 ? 'error' : 'log'](obj.e)
        res.send({
            code, msg: code === 4 ? "server error" : 'Token expired'
        })
    })
})

module.exports = router
