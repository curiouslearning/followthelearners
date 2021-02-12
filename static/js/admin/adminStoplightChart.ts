import { StoplightChart } from './stoplightChart';
import { Config } from '../config';

export class AdminStoplightChart extends StoplightChart {

  constructor(config: Config) {
    super(config);
  }
  public init(): void {
    super.init();
  }
  public activateDeepDive(service: string) {
    super.activateDeepDive(service);
  }
  public async updateStoplightData() {
    const postmanData = await this.getPostmanData();
    this.updateStoplightCell('postman', postmanData.status);
    const stripeData = await this.getStripeData();
    this.updateStoplightCell('stripe', stripeData.status);
    const cloudData = await this.getCloudData();
    this.updateStoplightCell('cloud', cloudData.status);
    const firestoreData = await this.getFirestoreData();
    this.updateStoplightCell('firestore', firestoreData.status);
    const serverData = await this.getServerData();
    this.updateStoplightCell('server', serverData.status);
    const cronData = await this.getCronData();
    this.updateStoplightCell('cron', cronData.status);
  }

  private async getPostmanData(): Promise<any> {

  }

  private async getStripeData(): Promise<any> {

  }

  private async getCloudData(): Promise<any> {

  }

  private async getFirestoreData(): Promise<any> {

  }

  private async getServerData(): Promise<any> {

  }

  private async getCronData(): Promise <any> {

  }

}
