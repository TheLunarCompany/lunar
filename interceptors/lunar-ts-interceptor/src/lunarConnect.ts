import https from 'https';
import http from 'http';

import { logger } from './logger';
import { debugInfo, loadConnectionInformation, type ConnectionInformation } from './helper';
import { TrafficFilter } from './trafficFilter';

export class LunarConnect {
  private static _instance: LunarConnect | null = null;
  private ProxyListening: boolean | undefined;
  private readonly connectionInfo: ConnectionInformation
  private readonly connectionValid: Promise<boolean>
  private readonly trafficFilter: TrafficFilter = TrafficFilter.getInstance(); 
  
  private constructor() {
    this.connectionInfo = loadConnectionInformation();
    debugInfo(this.connectionInfo)

    this.connectionValid = new Promise<boolean>((resolve, _reject) => {
      this.makeHandshake().then((connectionIsValid: boolean) => {
        this.ProxyListening = connectionIsValid;
        resolve(connectionIsValid);
      }).catch((_error) => {
        this.ProxyListening = false;
        resolve(false);
      });
    });
  }

  public static getInstance(): LunarConnect {
    if (LunarConnect._instance === null) {
      LunarConnect._instance = new LunarConnect();
    }
    return LunarConnect._instance;
  }

  public async isConnectionValid(): Promise<boolean> {
    return await this.connectionValid;
  }
  
  public isProxyListening(): boolean | undefined {
    return this.ProxyListening;
  } 

  public getConnectionInfo(): ConnectionInformation {
    return this.connectionInfo;
  }

  private async makeHandshake(): Promise<boolean> {
    if (!this.connectionInfo.isInfoValid) {
      return false
    }

    try {
      const connectionResponse = await this.makeConnection()
      this.connectionInfo.managed = (Boolean(JSON.parse(connectionResponse).managed)) || false;
      logger.debug(`Connection to Lunar Proxy successful. Managed: ${this.connectionInfo.managed}`);
      this.trafficFilter.setManaged(this.connectionInfo.managed);
      return true;
    } catch (error) {
      logger.error(`Failed to connect with Lunar Proxy on: ${this.connectionInfo.proxyHost}:${this.connectionInfo.handShakePort}`);
      logger.error(`Error: ${error as string}`);
      return false;
    }
  }

  private async makeConnection(): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const options = {
        hostname: this.connectionInfo.proxyHost,
        port: this.connectionInfo.handShakePort,
        path: '/handshake',
        method: 'GET',
        headers: {
          LUNAR_TENANT_ID_HEADER: this.connectionInfo.tenantID,
          LUNAR_INTERCEPTOR_HEADER: this.connectionInfo.interceptorID,
        },
      };

      const protocol = this.connectionInfo.proxyScheme === 'https' ? https : http;
      const request = protocol.request(options, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          resolve(data);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.end();
    });
  }
}