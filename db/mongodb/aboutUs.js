const mongoose = require('mongoose')

let aboutUsInfo = mongoose.model('about', new mongoose.Schema({
    title: {type: String, require: true},
    content: [{
        text: {type: String, require: true}
    }],
    image: [{
        url: {type: String, require: true}
    }],
}, {versionKey: false}))

module.exports = aboutUsInfo
