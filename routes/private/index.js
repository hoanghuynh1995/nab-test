const express = require('express')
const router = express.Router()
const fs = require("fs");

module.exports = () => {
  fs.readdirSync(__dirname).forEach(function (file) {
    if (file == "index.js") return;
    require("./" + file)(router);
  });
  return router
};
