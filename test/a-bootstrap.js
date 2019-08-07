import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import mysql from 'mysql';
import logger from 'saylo';

import MysqlReq from '../src/MysqlReq';
import MysqlDump from '../src/MysqlDump';
import { expect } from 'chai';

const injectDependencies = function () {
  logger.log('injectingDependencies');
  MysqlReq.inject({ adapter: mysql, logger, env: process.env });
  MysqlDump.inject({ requestor: MysqlReq, logger, readFileSync, existsSync });
}

let bootstrapped = false;
describe('Global Bootstrapping', function() {

  before(async () => {
    injectDependencies();
    bootstrapped = true;
  });

  it('bootstraps properly', function () {
    expect(bootstrapped).to.be.equal(true);
  });

});
