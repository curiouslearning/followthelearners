const {BigQuery} = require('@google-cloud/bigquery');

exports.loadIntoBigQuery = async (filename) => {
  const bigQueryClient = new BigQuery();
  const dataset = bigQueryClient.dataset('ftl_dataset');
  const table = dataset.table('assigned_learners');
  const metadata = {
    encoding: 'UTF-8',
    createDisposition: 'CREATE_IF_NEEDED',
    writeDisposition: 'WRITE_APPEND',
    sourceFormat: 'NEWLINE_DELIMITED_JSON',
    schemaUpdateOption: 'ALLOW_FIELD_ADDITION',
    destinationTable: table,
  };
  await table.load('./' + filename, metadata, (err, res) => {
    if (err) throw err;
    console.log('Successfully uploaded to BigQuery');
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
