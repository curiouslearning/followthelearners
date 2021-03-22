const fs = require('fs');
exports.getCalculatedDateMin = (date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

exports.getCalculatedDateMax = (date) => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

exports.writeFile = async (filename, data) => {
  await fs.writeFileSync(`./${filename}`, data, (res, err)=> {
    if (err) throw err;
  });
  return;
};

exports.deleteFile = async (filename) => {
  return await fs.unlinkSync(`./${filename}`, (res, err) => {
    if (err) {
      console.error(err);
    }
  });
  return;
};

exports.stringifyRows = (rows) => {
  let dataString = '';
  rows.forEach((row) => {
    dataString += JSON.stringify(row) + '\n';
  });
  return dataString;
};
