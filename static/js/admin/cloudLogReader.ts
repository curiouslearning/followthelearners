import { Helpers } from '../helpers';
import { AdminConfig } from './adminConfig';
import { Logging } from '@google-cloud/logging';

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
  private logReader: Logging;
  
  constructor(config: AdminConfig) {
    this.resourceNames = config.gcloudResourceNames;
    this.entriesURL = config.gcloudEntriesURL;
    this.nextPageToken = '';
    this.logReader = new Logging();
    this.init();
  }

  private init(): void {

  }

  public async listAllLogs(): Promise<Array<string>>{
    const [logs] = await this.logReader.getLogs();
    let logNames: Array<string> = [];
    console.log('Logs: ');
    logs.forEach((log) => {
      console.log(`\t${log.name}`);
      logNames.push(log.name);
    });
    return logNames;
  }

  public async getLatestLogs(): Promise<{data: any|null, error: string|null}> {
    const cutoff = this.getCutoff(TimestampFormat.RSC, 1);
    const filter = `timestamp >= ${cutoff}`;
    return await this.getData(this.resourceNames[0], filter);
  }

  public async getLatestErrors(): Promise<{data:any|null, error:string|null}> {
    const cutoff = this.getCutoff(TimestampFormat.RSC, 1);
    const filter = `severity >= "ERROR" AND timestamp >= ${cutoff}`;
    return await this.getData(this.resourceNames[0], filter);
  }

  private async getData(
    resourceName: string,
    filter: string
  ): Promise<{data: any | null, error: string | null}> {
    const options = this.formatOptionsObject(this.resourceNames, filter);
    const log = await this.logReader.log(resourceName);
    const entries = await log.getEntries({filter: filter});
    if (!entries[0]) {
      const errorString = 'could not fetch data from CloudLogging API'
      console.error(errorString);
      return {data: null, error: errorString};
    } else if (entries[0].length === 0) {
      console.log('no data!');
      return {data: 'no-data', error: null};
    }
    return {data: entries[0], error: null};
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
