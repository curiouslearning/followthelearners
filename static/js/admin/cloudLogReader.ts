import { Helpers } from '../helpers';
import { AdminConfig } from './adminConfig';

interface CloudLogOptions {
  resources: Array<string>,
  filter: string,
  orderBy: string,
  pageSize: number,
  pageToken: string,
}

export enum TimestampFormat {
  'RSC',
  'ISO',
}

/**
* A class for interfacing with the Google Cloud Logging API to
* retrieve data on Cloud Functions health
*/
export class CloudLogReader {
  private DAYINMILLIS = 86400000;
  private resourceNames: Array<string>;
  private nextPageToken: string;
  private entriesURL: string;
  
  constructor(config: AdminConfig) {
    this.resourceNames = config.gcloudResourceNames;
    this.entriesURL = config.gcloudEntriesURL;
    this.nextPageToken = '';
    this.init();
  }

  private init(): void {

  }

  public async getLatestLogs(): Promise<any> {
    const options = this.formatOptionsObject(this.resourceNames);
    const data = await Helpers.post(this.entriesURL, options);
    if (!data.ok || data.error) {
      const errorString = 'could not fetch data from CloudLogging API';
      console.error(errorString);
      return {data: null, error: errorString};
    } else if (data.json.length === 0) {
      console.log('no data!');
      return {data: 'no-data', error: null};
    } else {
      return {data: data.json, error: null};
    }
    return data;
  }

  public async getLatestErrors(): Promise<{data: any, error: string | null}> {
    const cutoff = this.getCutoff(TimestampFormat.RSC, 1);
    const filter = `severity >= "ERROR" AND timestamp >= ${cutoff}`;
    const options = this.formatOptionsObject(this.resourceNames, filter);
    const data = await Helpers.post(this.entriesURL, options);
    if (!data.ok || data.error) {
      const errorString = 'could not fetch data from CloudLogging API'
      console.error (errorString);
      return {data: null, error: errorString};
    } else if (data.json.length === 0) {
      console.log('no data!');
      return {data: 'no-data', error: null};
    } else {
      return {data: data.json, error: null};
    }
  }

  private getCutoff(
    format: TimestampFormat,
    dayInterval: number
  ): string {
    const date = new Date(Date.now() - (this.DAYINMILLIS * dayInterval));
    let dateString = date.toISOString();
    switch (format) {
      case TimestampFormat.RSC: //full ISO 861 (YYYY-MM-DDTHH:mm:ss.mlsZ)
        return dateString;
      case TimestampFormat.ISO: //equivalent to YYYY-MM-DD
        return dateString.slice(0, 10);
    }
  }

  private formatOptionsObject(
    resources: Array<string>,
    filter: string = '',
    orderBy: string = '',
    pageSize: number = 50,
    pageToken:string = '',
  ): CloudLogOptions {
    let res: CloudLogOptions = {
      resources: [],
      filter: '',
      orderBy: '',
      pageSize: pageSize,
      pageToken: pageToken,
    };
    if (resources.length === 0) {
      throw new Error('no resource provided');
    };
    res.resources = resources;
    if (filter !== '') {
      res.filter = filter
    };
    if (orderBy !== '') {
      res.orderBy = orderBy
    };
    res.pageSize = pageSize;
    if (pageToken !== '') {
      res.pageToken = pageToken
    };
    return res;
  }
}
