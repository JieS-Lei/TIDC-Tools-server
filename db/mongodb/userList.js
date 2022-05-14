const mongoose = require('mongoose')

let userListInfo = mongoose.model('userList', new mongoose.Schema({
    state: {type: Boolean, default: false},
    token: {type: String, default: null},
    openid: {type: String, required: true},
    image: {type: String, default: "/images/default.png"},
    studentID: {type: String, required: true},
    name: {type: String, required: true},
    phone: {type: String, required: true},
    sex: {type: Number, default: 0},
    studentClass: {type: String, required: true},
    reqDate: {type: String}
}, {
    versionKey: false,
    timestamps: {
        createdAt: 'reqDate',
        updatedAt: false,
        currentTime: () => new Date().toLocaleString()
    }
}))

module.exports = userListInfo
