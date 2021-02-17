import { StoplightChart } from './stoplightChart';
import { AdminConfig } from './adminConfig';
import { PostmanApi } from './postmanApi';
import { CloudLogReader } from './cloudLogReader';

export class AdminStoplightChart extends StoplightChart {
  private config: AdminConfig; //to pass to data handling classes
  constructor(config: AdminConfig) {
    super(config);
    this.config = config;
  }
  public init(): void {
    super.init();
    this.updateStoplightData();
  }
  public activateDeepDive(service: string) {
    super.activateDeepDive(service);
  }
  public async updateStoplightData() {
    const postmanData = await this.getPostmanData();
    this.updateStoplightCell('postman', postmanData.status);
    // const stripeData = await this.getStripeData();
    // this.updateStoplightCell('stripe', stripeData.status);
    const cloudData = await this.getCloudData();
    this.updateStoplightCell('cloud', cloudData.status);
    // const firestoreData = await this.getFirestoreData();
    // this.updateStoplightCell('firestore', firestoreData.status);
    // const serverData = await this.getServerData();
    // this.updateStoplightCell('server', serverData.status);
    // const cronData = await this.getCronData();
    // this.updateStoplightCell('cron', cronData.status);
  }

  private async getPostmanData(): Promise<any> {
    const postman = new PostmanApi(this.config);
    let status: string;
    const data = await postman.runMonitor('frontEnd');
    if (!data || data.error) {
      status = 'outage';
    } else if (data.data === 'no-data' ||
        data.data.run.info.status === 'failed') {
          status = 'error';
    } else {
      status = 'good';
    }
    console.log(`postman: ${status}`)
    return {status: status, data: data.data};
  }

  private async getStripeData(): Promise<any> {

  }

  private async getCloudData(): Promise<any> {
    const gcloud = new CloudLogReader(this.config);
    let status: string;
    const data = await gcloud.getLatestErrors();
    if (data.error) {
      status = 'outage'
    } else if (data.data === 'no-data' || data.data.length > 0) {
      status = 'error';
    } else {
      status = 'good';
    }
    console.log(`cloud: ${status}`)
    return ({status: status, data: data});
  }

  private async getFirestoreData(): Promise<any> {

  }

  private async getServerData(): Promise<any> {

  }

  private async getCronData(): Promise <any> {

  }

}
