const createError = require('http-errors')
const express = require('express')
const path = require('path')
const fs = require('fs')
const cookieParser = require('cookie-parser')
const logger = require('morgan')
const FileStreamRotator = require('file-stream-rotator')
const {connect} = require('mongoose')

let indexRouter = require('./routes/index')
let usersRouter = require('./routes/users')
let listRouter = require('./routes/list')
let restrictRouter = require('./routes/restrict')
let clockingRouter = require('./routes/clocking')

let app = express();

//连接数据库
connect("mongodb://localhost:27017/Tool", {useNewUrlParser: true, useUnifiedTopology: true})
    .then(() => {
        console.log("mongoDB 连接成功")
    })
    .catch(() => {
        console.log("mongoDB 连接失败")
    })

let logDirectory = path.join(__dirname, 'log')
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)
let accessLogStream = FileStreamRotator.getStream({
    date_format: 'YYYYMMDD',
    filename: path.join(logDirectory, 'access-%DATE%.log'),
    frequency: 'daily',
    verbose: false
})
// setup the logger
app.use(logger('combined', {stream: accessLogStream}))
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/lists', listRouter);
app.use('/restrict', restrictRouter);
app.use('/clocking', clockingRouter);

app.all('*', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "X-Requested-With")
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS")
    res.header("Content-Type", "application/json;charset=utf-8")
    if (req.methods === "OPTIONS") {
        res.sendStatus(200);
    } else {
        next();
    }
})

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
