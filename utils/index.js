const NodeRSA = require('node-rsa')
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const client = require("../db/redis");

const publicKey = '-----BEGIN PUBLIC KEY-----MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvynf8gpD6lD1+mTp2OTrTNOLRF/q9a9cRYyWBeoXSjmcFQUIC+a0pwSUvv2Gb2DgrX8wIuve7GkRsbGYvddXkUcWimJbFO20+/anBvkxyXHKeFwQpPow9hO0dvC2/9tXFqTBkmVdttYzqd07Y05IVCxG6O85LzZMEeb13w4osBflZCaxcSN6qLCURpf+3cnf9PeawhlJPGYu+5d1Pct1pl5hjYdYu9dEphmlsYb2Md6G0dk6ZgBe0x4hJgRhFJwozEAwQVl4BCQ9f902ZcxW7JO/gbibbQ2Mdz8VwBn2A8tSrRjuxwgS9C9jq0nnVN2kvPFY+ibH3wWJzGhM3KGAiZcO/n7IB3s6CKdjCyt4DRZHL3SHdZQ6WRYeNtdWuL0F8nlFCFAgHIv3vwD9oxCLRj/8WH4PNJxqTcmBApWl5QxGAButn9tAeM5DOaNd6dmgkqI3IBR/DLE7U2L7dK/C2ic5EkqopGTv5RhzQ4h1Aml/8O4Uqbls3NujjQA23xFaomPwBK52VFvLnemzZVaEOG2b1JzkYculhGHz19EAzT860ZfLkHGrw8xOeKCWvpyshLFe5PGynnwT/NfitRLsCCQ6pLmTvg9Q6l0rLL3W5G55D/va4DImUPY9gDLstim69on363sXTsFqz3jknGsXORbJnwIIGN54q97zPnXO6ysCAwEAAQ==-----END PUBLIC KEY-----'
const privateKey = '-----BEGIN PRIVATE KEY-----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-----END PRIVATE KEY-----'

const AES_conf = {
    key: "JieS@TIDC\0\0\0\0\0\0\0",
    iv: "1758512329502017",
    padding: "PKCS7Padding"
}

const keys = ["JieS", "2022", "Ang&8023"]
const tokenKey = "Angelos&0423"

class Utils {
    // RSA 解密: 密文，私钥
    RsaPrivateKeyDecrypt(encryptedData, parameterKey) {
        let key
        if (parameterKey) key = new NodeRSA(parameterKey)
        else key = new NodeRSA(privateKey)
        key.setOptions({encryptionScheme: 'pkcs1'})
        return key.decrypt(encryptedData, "utf8")
    }

    /*
    * AES_128_CBC 加密
    * return hex
    * */
    AESEncryption(data, option) {
        let key, iv
        if (option) {
            key = option.key
            iv = option.iv
        } else {
            key = AES_conf.key
            iv = AES_conf.iv
        }
        let cipherChunks = ""
        let cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
        cipher.setAutoPadding(true)
        cipherChunks += cipher.update(data, 'utf8', 'hex')
        cipherChunks += cipher.final('hex')
        return cipherChunks
    }

    // AES_128_CBC 解密
    AESDecode(sign, option) {
        let key, iv
        if (option) {
            key = option.key
            iv = option.iv
        } else {
            key = AES_conf.key
            iv = AES_conf.iv
        }
        let src = "";
        const cipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
        src += cipher.update(sign, "hex", "utf8");
        src += cipher.final("utf8");
        return src;
    }

    // 格式判断
    variableTypeExamining(val, exp) {
        if (typeof exp == 'string') return typeof val === exp
        return new Error("'exp' is not a String")
    }

    // base64 转 base64url
    toBase64Escape(base64) {
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    }

    // base64url 转回 base64
    base64urlUnescape(str) {
        str += new Array(5 - str.length % 4).join('=')
        // noinspection RegExpRedundantEscape
        return str.replace(/\-/g, '+').replace(/_/g, '/')
    }

    // base64特殊字符转义
    Base64Encode(base64) {
        return base64.replace(/\+/g, '%2B').replace(/\//g, '%2F').replace(/=/g, '&3D')
    }

    // sha1加密签名
    sign(value) {
        return crypto.createHmac('sha1', keys.join('')).update(value).digest('hex')
    }

    // 数据库存储的加密数据
    pbkdf2Async(openId) {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(
                openId,
                keys.join('_'),
                700,
                128,
                'sha512',
                (err, derivedKey) => {
                    if (err) reject(err)
                    resolve(derivedKey.toString('hex'))
                }
            )
        })
    }

    // 生成token
    addToken(data, time) {
        return jwt.sign(data, tokenKey, {
            algorithm: 'HS256',
            expiresIn: time
        });
    }

    // 验证token
    verifyToken(token) {
        return new Promise((resolve, reject) => {
            jwt.verify(token, tokenKey, {algorithm: 'HS256'}, function (err, decoded) {
                if (err) {
                    reject(err)
                } else {
                    resolve(decoded)
                }
            })
        })
    }

    // 获取时分秒
    getTime(timestamp, connect) {
        if (typeof timestamp !== 'number') {
            connect = timestamp
            timestamp = undefined
        }
        if (!connect) {
            connect = {
                date: '/',  // 日期连接符
                time: ':',  // 时间连接符
                interval: ' ',  // 日期与时间之间的间隔符
                result: 'all',  // 返回的数据，默认日期时间都返回，参数：'date': 只返回日期, 'time': 只返回时间
                suppl: true  // 是否需要补零，默认补零
            }
        } else {
            connect['date'] = typeof connect['date'] === 'string' ? connect['date'] : '/'
            connect['time'] = typeof connect['time'] === 'string' ? connect['time'] : ':'
            connect['interval'] = typeof connect['interval'] === 'string' ? connect['interval'] : ' '
            connect['result'] = connect['result'] || 'all'
            connect['suppl'] = typeof connect['suppl'] === 'boolean' ? connect['suppl'] : true
        }
        let date = timestamp ? new Date(timestamp) : new Date(),
            y = date.getFullYear(),
            m = date.getMonth() + 1,
            d = date.getDate(),
            h = date.getHours(),
            min = date.getMinutes(),
            s = date.getSeconds()
        if (connect.suppl) {
            m = m < 10 ? `0${m}` : m
            d = d < 10 ? `0${d}` : d
            h = h < 10 ? `0${h}` : h
            min = min < 10 ? `0${min}` : min
            s = s < 10 ? `0${s}` : s
        }
        if (connect.result === 'date') return `${y}${connect['date']}${m}${connect['date']}${d}`
        else if (connect.result === 'time') return `${h}${connect['time']}${min}${connect['time']}${s}`
        return `${y}${connect['date']}${m}${connect['date']}${d}${connect['interval']}${h}${connect['time']}${min}${connect['time']}${s}`
    }

    // 生成随机数
    randomStr(len) {
        let part1 = this.getTime({
            date: '',
            time: '',
            interval: ''
        })
        len = len || 32
        if (len < 14) len = 32
        let t = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_/-.0123456789abcdefghijklmnopqrstuvwxyz"
        let a = t.length
        let n = ""
        for (let i = 0; i < len - part1.length; i++) {
            n += t.charAt(Math.floor(Math.random() * a))
        }
        return n + part1
    }

    // 仅此项目可用方法 由token获取redis数据
    jwt2Redis(token) {
        return new Promise((resolve, reject) => {
            this.verifyToken(token).then(obj => {
                console.log(obj)
                client.get(obj.sid).then(d => resolve({
                    data: d,
                    sid: obj.sid
                })).catch(e => reject({
                    e,
                    code: 4
                }))
            }).catch(e => reject({
                e: e.message,
                code: 1
            }))
        })
    }
}


module.exports = new Utils();
