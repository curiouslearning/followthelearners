const {BigQuery} = require('@google-cloud/bigquery');

exports.loadIntoBigQuery = async (filename, tableName) => {
  const bigQueryClient = new BigQuery();
  const dataset = bigQueryClient.dataset('ftl_dataset');
  const table = dataset.table(tableName);
  if (!await dataset.exists) {
    console.error(`missing dataset: ${dataset}`);
  } else if (!await table.exists) {
    console.error(`missing table: ${table}`);
  }
  const metadata = {
    encoding: 'UTF-8',
    createDisposition: 'CREATE_IF_NEEDED',
    writeDisposition: 'WRITE_APPEND',
    sourceFormat: 'NEWLINE_DELIMITED_JSON',
    schemaUpdateOption: 'ALLOW_FIELD_ADDITION',
  };
  return await table.load('./' + filename, metadata).then((res) => {
    console.log('Successfully uploaded to BigQuery');
    return true;
  }).catch((err) => {
    console.error(`could not successfully upload ${filename} to ${tableName}. Encountered error:`);
    console.error(err);
    return false;
  });
};

exports.runQuery = async (options) => {
  const client = new BigQuery();
  return await client.createQueryJob(options).then((data) => {
    const job = data[0];
    return job.getQueryResults();
  }).then((res) => {
    return res[0];
  }).catch((err) => {
    throw err;
  });
};
