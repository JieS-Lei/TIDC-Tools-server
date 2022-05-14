const mongoose = require('mongoose')

let userInfo = mongoose.model('user', new mongoose.Schema({
    openid: {type: String, required: true},
    studentID: {type: String, required: true},
    image: {type: String, default: "/images/default.png"},
    name: {type: String, required: true},
    phone: {type: String, required: true},
    sex: {type: Number, default: 0},
    studentClass: {type: String, required: true},
    super: {type: Boolean, default: false},
    ifClock: {type: mongoose.Schema.Types.ObjectId, ref: "clockList", default: null},
    reqDate: {type: String, required: true}
}, {versionKey: false}))

module.exports = userInfo
