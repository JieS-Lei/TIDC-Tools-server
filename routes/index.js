const express = require('express')
const router = express.Router()

const aboutUsInfo = require('../db/mongodb/aboutUs')

/* GET home page. */
router.get('/', function (req, res) {
    let getClientIp = function (req) {
        return req.headers['x-forwarded-for'] ||
            req.connection['remoteAddress'] ||
            req.socket['remoteAddress'] ||
            req.connection.socket.remoteAddress || '';
    };
    // let ip = getClientIp(req).match(/\d+.\d+.\d+.\d+/);
    // ip = ip ? ip.join('.') : null;
    res.send({
        code: 0,
        ip: getClientIp(req)
    })
})
router.get('/TIDC/about', function (req, res) {
    aboutUsInfo.find({}).then(d => {
        res.send({
            code: 0,
            msg: 'ok',
            data: d
        })
    }).catch(e => {
        console.error(e)
        res.send({
            code: 4,
            msg: 'server error'
        })
    })
})
const _u = 'https://e8b1-117-188-63-221.jp.ngrok.io'
router.get('/url_proxy', function (req, res) {
    let keyword = req.query['keyword']
    if (keyword === 'apply') {
        res.redirect(301, _u + '/apply')
    } else if (keyword === 'DonwloadExcel') {
        res.redirect(301, _u + '/personnel.html')
    } else {
        res.send('访问错误！')
    }
})

module.exports = router;
