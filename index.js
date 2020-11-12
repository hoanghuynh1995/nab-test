//simple express setup
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const app = express();

const config = require('./config')
const port = config.port

//fetch db update object 
require('./db');

app.use(
  morgan((tokens, req, res) => {
    return [
      tokens.method(req, res),
      tokens.url(req, res),
      tokens.status(req, res),
      tokens.res(req, res, 'content-length'),
      '-',
      tokens['response-time'](req, res),
      'ms',
    ].join(' ');
  })
);

//use body parser
var bodyParser = require('body-parser');
app.use((req, res, next) => {
  if (req.originalUrl === '/private/payments/hook') {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});
app.use(bodyParser.urlencoded({ extended: true }));

// setup cors
app.use(cors())

// add context object to every requests
const responseUtil = require('./utils/response')
app.use('/', (req, res, next) => {
  req.state = {}
  res.error = responseUtil.error.bind(res)
  res.success = responseUtil.success.bind(res)
  next()
})
//fetch and add routes
var publicRoutes = require('./routes/public')
app.use('/', publicRoutes())
var privateRoutes = require('./routes/private')
app.use('/priv', privateRoutes())
app.use((err, req, res, next) => {
  res.status(500)
  res.render('error', { error: err })
})


app.listen(port, () => console.log('Started server at port: ' + port));



