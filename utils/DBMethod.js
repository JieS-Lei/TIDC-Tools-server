const clockList = require('../db/mongodb/clockList')

const getDateFn = function getDateFn() {
    let date = new Date()
    let y = date.getFullYear()
    let m = date.getMonth() + 1
    let d = date.getDate()
    return `${y}/${m}/${d}`
}

/*
* 方法说明
* @method getDuration
* @for Function
* @param ObjectId _id 用户的id，String op 获取时长及次数 取值{默认: 返回一周的数据，'month': 返回一个月的数据，'day': 返回一天的数据}
* @return 时长及次数数据 {'time': Number, 'frequency': Number}
* */
const getDuration = function getDuration(_id, op) {
    return new Promise((resolve, reject) => {
        let date
        if (op === 'month') {
            date = new Date().getDate()
        } else if (op === 'day') {
            date = 1
        } else {
            date = new Date().getDay()
            if (!date) date = 7

        }
        date -= 1
        let minLimitTime = new Date(getDateFn()).getTime() - (date * 24 * 60 * 60 * 1000),
            maxLimitTime = new Date().getTime()
        clockList.find({
            clockID: _id,
            sCode: 1,
            reqDate: {$gte: minLimitTime, $lt: maxLimitTime}
        }, {_id: 0}).then(arr => {
            if (!arr.length) return resolve({
                time: 0,
                frequency: 0
            })
            let totalTime = 0
            arr.forEach(value => totalTime += value.duration)
            resolve({
                time: totalTime,
                frequency: arr.length
            })
        }).catch(e => reject(e))
    })
}
const getLastClockTime = function getLastClockTime(_id) {
    return new Promise((resolve, reject) => {
        clockList.findOne({clockID: _id}, {_id: 0}, {sort: {'reqDate': -1}}).then(obj => {
            if (!obj) return resolve({time: 0})
            resolve({time: obj.reqDate})
        }).catch(e => reject(e))
    })
}


module.exports = {getDateFn, getDuration, getLastClockTime}
