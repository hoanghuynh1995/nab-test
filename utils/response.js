module.exports = {
  error: function (err, status = 200) {
    this.status(status).send({
      result: 'failure',
      err: err instanceof Error ? {
        code: err.code,
        message: err.message
      } : err,
    })
  },
  success: function (data, status = 200) {
    this.status(status).send({
      result: 'success',
      data,
    })
  },
}