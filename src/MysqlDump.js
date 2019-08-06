import { readFileSync, existsSync } from 'fs';
import MysqlReq from './MysqlReq';
import logger from 'saylo';

class MysqlDump {
  static async executeSqlFileOnExistingConnection(filePath) {
    if (!existsSync(filePath)) {
      throw new Error('File path does not exists ');
    }
    logger.log('executeSchemaOntoExistingConnection');
    await MysqlReq.query({
      sql: readFileSync(filePath, 'utf-8'),
    });
  }

  static async executeSqlFile({ filePath, connectionConfig, disconnectOnFinish }) {
    logger.log(`MysqlDump:executeSqlFile(${filePath})`);
    if (!connectionConfig) {
      let letMysqlReqLoadDefaultEnvConfig = true;
      connectionConfig = letMysqlReqLoadDefaultEnvConfig && {};
    }

    let { multipleStatements, ...connectionConfigWithoutMS } = connectionConfig;

    MysqlReq.setConnectionConfig({
      multipleStatements: true,
      ...connectionConfigWithoutMS
    });

    await MysqlDump.executeSqlFileOnExistingConnection(filePath);

    if (typeof disconnectOnFinish === 'undefined') {
      disconnectOnFinish = true;
    }

    if (disconnectOnFinish) {
      await MysqlReq.disconnect();
    }
  }
}

export default MysqlDump;
