const mongoose = require('mongoose')

let clockListInfo = mongoose.model('clockList', new mongoose.Schema({
    clockID: {type: mongoose.Schema.Types.ObjectId, ref: "user", required: true},
    sCode: {type: Number, default: 2}, // 0-无效  1-有效  2-打卡中
    reqDate: {type: Number, default: Date.now},
    endDate: {type: Number, default: null},
    duration: {type: Number, default: 0}
}, {versionKey: false}))


module.exports = clockListInfo
