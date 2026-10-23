/**
 * Error carrying an HTTP status so controllers can answer 400/403/404/409 instead of a blanket 500.
 */
const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

/** Send a JSON error response honouring err.status (defaults to 500) */
httpError.send = (res, error) =>
  res.status(error && error.status ? error.status : 500).json({ success: false, message: error.message });

module.exports = httpError;
