const assigned = require('./assigned-users');
const donation = require('./donation-metrics');

(async () => {await main();})();

async function main() {
  try {
    const interval = 0;
    await assigned.exportAssignedUsersToBigQuery(interval);
    await donation.exportDonationMetrics(interval);
    await donation.exportUnfilledDonations(interval);
  } catch (e) {
    console.error('unable to complete metric exports. Encountered error: ');
    console.error(e);
  }
}
