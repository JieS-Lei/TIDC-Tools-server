const mongoose = require('mongoose')

let ipInfo = mongoose.model('IPInfo', new mongoose.Schema({
    startupWifi: {type: Boolean, default: false},
    startupIP: {type: Boolean, default: false},
    ips: [{
        ip: {type: String, require: true},
        region: {type: String, require: true}
    }],
    wifiList: [{
        SSID: {type: String, require: true},
        BSSID: {type: String, require: true}
    }],
    reqDate: {type: String},
    upDate: {type: String}
}, {
    versionKey: false,
    timestamps: {
        createdAt: 'reqDate',
        updatedAt: 'upDate',
        currentTime: () => new Date().toLocaleString()
    }
}))

module.exports = ipInfo
