const PostmanKey = require( '../../../keys/postman.json');
import { Helpers } from '../helpers';
import { AdminConfig } from './adminConfig';

// Interfaces with Postman to programatically run collections and monitors that
// watch FtL front end health
export class PostmanApi {
  private config: AdminConfig;
  private monitorIds: Array<{name: string, id: string}>;
  constructor(config: AdminConfig) {
    this.config = config;
    this.monitorIds = config.monitorIds;
  }
  public async runMonitor(monitor: string): Promise<any> {
    let id = this.getMonitorId(monitor);
    if (id === '')  {
      throw new Error(`bad monitor name '${monitor}'`);
    }
    const url = `https://api.getpostman.com/monitors/${id}/run`;
    const response = await Helpers.post(url, {}, [{
      key: PostmanKey.header,
      val: PostmanKey.key,
    }]);
    console.log('postman callback reached');
    if(!response.ok || response.error) {
      const errString = 'Postman returned a server error!';
      console.error(errString);
      return {data: {}, error: errString};
    } else if(!response.json.run) {
      return {data: 'no-data', error: null}
    } else {
      console.log(`response: ${response}`);
      return {data: response.json, error: null};
    }
    return response;
  }

  private getMonitorId(name: string): string {
    const obj = this.monitorIds.find(x => x.name === name);
    if(obj === undefined) return '';
    return obj.id;
  }
}
