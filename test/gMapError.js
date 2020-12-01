class GMAPError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    this.response={
      data: {
        error_message: message,
      },
    };
    Error.captureStackTrace(this, this.constructor);
  }
}
module.exports = {GMAPError};
