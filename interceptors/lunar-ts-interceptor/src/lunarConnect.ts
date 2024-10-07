import https from 'https';
import http from 'http';

import { logger } from './logger';
import { debugInfo } from './helper';
import { TrafficFilter } from './trafficFilter';
import { type EnvironmentInfo, type ProxyConnectionInfo, loadEnvironmentProxyInfo } from './environment';

export class LunarConnect {
  private static _instance: LunarConnect | null = null;
  private ProxyListening: boolean | undefined;
  private readonly environmentInfo: EnvironmentInfo
  private readonly connectionValid: Promise<boolean>
  private readonly trafficFilter: TrafficFilter = TrafficFilter.getInstance(); 
  
  private constructor() {
    this.environmentInfo = loadEnvironmentProxyInfo();
    debugInfo(this.environmentInfo)

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
    if (this.environmentInfo.proxyConnectionInfo === undefined) {
      // This case is for when the Proxy info is not available
      return false;
    }
    return this.ProxyListening;
  } 

  public getProxyConnectionInfo(): ProxyConnectionInfo | undefined {
    return this.environmentInfo.proxyConnectionInfo;
  }

  public getEnvironmentInfo(): EnvironmentInfo {
    return this.environmentInfo;
  }

  private async makeHandshake(): Promise<boolean> {
    if (this.environmentInfo.proxyConnectionInfo === undefined) {
      return false
    }

    try {
      const connectionResponse = await this.makeConnection()
      this.environmentInfo.managed = (Boolean(JSON.parse(connectionResponse).managed)) || false;
      logger.debug(`Connection to Lunar Proxy successful. Managed: ${this.environmentInfo.managed}`);
      this.trafficFilter.setManaged(this.environmentInfo.managed);
      return true;
    } catch (error) {
      logger.error(`
        Failed to connect with Lunar Proxy on:
        ${this.environmentInfo.proxyConnectionInfo.proxyHost}:${this.environmentInfo.proxyConnectionInfo.proxyHandshakePort}
      `);
      logger.error(`Error: ${error as string}`);
      return false;
    }
  }

  private async makeConnection(): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const options = { // @ts-expect-error: TS2532
        hostname: this.environmentInfo.proxyConnectionInfo.proxyHost, // @ts-expect-error: TS2532
        port: this.environmentInfo.proxyConnectionInfo.proxyHandshakePort,
        path: '/handshake',
        method: 'GET',
        headers: {
          LUNAR_TENANT_ID_HEADER: this.environmentInfo.tenantID,
          LUNAR_INTERCEPTOR_HEADER: this.environmentInfo.interceptorID,
        },
      };
       // @ts-expect-error: TS2532
      const protocol = this.environmentInfo.proxyConnectionInfo.proxyScheme === 'https' ? https : http;
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