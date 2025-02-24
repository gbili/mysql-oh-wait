import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';
import { MysqlReq } from '../../src/MysqlReq';
import { chattyLogger as logger } from 'saylo';
import { extractConfigFromEnv } from '../../src/config';
import { isActionResultError, SimpleResultSetHeader } from '../../src/ActionResult';

const testConfig = {
  ...extractConfigFromEnv(process.env),
  multipleStatements: false,
};

describe('MysqlReq', function () {
  // Turn debug logging on/off as needed.
  let req: MysqlReq;

  before(async function () {
    logger.log('🔄 Checking database connection...');
    req = new MysqlReq({ connectionConfig: testConfig });

    const connectionTest = await req.query<{ result: number }[]>({
      sql: 'SELECT 1 AS result;',
    });

    if (isActionResultError(connectionTest)) {
      logger.error(`❌ Database connection failed: ${connectionTest.error?.message}`);
      throw new Error('Database connection could not be established. Check your connection settings.');
    } else {
      logger.log('✅ Database connection established.');
    }
  });

  // In your test file
  after(async function () {
    logger.log('🔄 Cleaning up after tests...');
    if (req) {
      await req.closePool();
      logger.log('✅ MySQL connection pool closed.');
    }
  });


  describe('Constructor and query()', function () {
    it('should create an instance and perform a simple query', async function () {
      const actionResult = await req.query<{ Tables_in_db: string }[]>({
        sql: 'SHOW TABLES',
      });

      if (isActionResultError(actionResult)) {
        logger.error(`❌ Query failed: ${actionResult.error?.message}`);
        throw new Error(`Database query failed: ${actionResult.error?.message}`);
      }

      expect(actionResult.value).to.be.an('array');
      logger.log('✅ Simple query executed successfully.');
    });

    it('should transform the result using the "after" callback', async function () {
      const actionResult = await req.query({
        sql: 'SHOW TABLES',
        after: () => 'transformed',
      });

      if (isActionResultError(actionResult)) {
        logger.error(`❌ Transformation failed: ${actionResult.error?.message}`);
        throw new Error(`Transformation failed: ${actionResult.error?.message}`);
      }

      expect(actionResult.value).to.equal('transformed');
      logger.log('✅ Transformation succeeded.');
    });

    it('should return an error in ActionResult for bad SQL', async function () {
      const actionResult = await req.query({
        sql: 'BAD SQL',
      });

      expect(isActionResultError(actionResult)).to.be.true;
      logger.log(`✅ Bad SQL correctly returned an error: ${actionResult.error?.message}`);
    });

    it('should support named placeholders in query formatting', async function () {
      const uniqueID = uuidv4().substring(0, 14);

      const actionResult = await req.query<SimpleResultSetHeader>({
        sql: 'INSERT INTO BookRepeated (title, author) VALUES (:title, :author)',
        values: { title: uniqueID, author: 'Test Author' },
      });

      if (isActionResultError(actionResult)) {
        logger.error(`❌ Insert failed: ${actionResult.error?.message}`);
        throw new Error(`Failed to insert record: ${actionResult.error?.message}`);
      }

      expect(actionResult.value).to.have.property('insertId');
      logger.log(`✅ Record inserted with ID: ${actionResult.value.insertId}`);
    });

    it('should support sequential placeholders (:?) in query formatting', async function () {
      const uniqueID = uuidv4().substring(0, 14);

      const actionResult = await req.query<SimpleResultSetHeader>({
        sql: 'INSERT INTO BookRepeated (title, author) VALUES :?',
        values: [[`Title ${uniqueID}`, 'Author 1']],
      });

      if (isActionResultError(actionResult)) {
        logger.error(`❌ Sequential placeholder insert failed: ${actionResult.error?.message}`);
        throw new Error(`Failed to insert record: ${actionResult.error?.message}`);
      }

      expect(actionResult.value).to.have.property('insertId');
      logger.log(`✅ Record inserted with ID: ${actionResult.value.insertId}`);
    });

    it('should support sequential placeholders with mixed depth', async function () {
      const actionResult = await req.query<[{ title: string }[], any]>({
        sql: 'SELECT * FROM BookRepeated WHERE title IN :? OR title = :?',
        values: [['NonExistingTitle', 'AnotherNonExistingTitle'], 'SomeTitle'],
      });

      if (isActionResultError(actionResult)) {
        logger.error(`❌ Query with mixed depth placeholders failed: ${actionResult.error?.message}`);
        throw new Error(`Query failed: ${actionResult.error?.message}`);
      }

      expect(actionResult.value).to.be.an('array');
      logger.log('✅ Mixed depth placeholder query executed successfully.');
    });
  });

  describe('Multiple Statements', function () {
    it('should support multiple statements when enabled', async function () {
      const configWithMultiple = { ...testConfig, multipleStatements: true };
      const req = new MysqlReq({ connectionConfig: configWithMultiple });

      const actionResult = await req.query<[{ one: string }[], { two: string }[]]>({
        sql: 'SELECT 1 AS one; SELECT 2 AS two;',
      });

      if (req) {
        await req.closePool();
        logger.log('✅ MySQL connection pool closed.');
      }

      if (isActionResultError(actionResult)) {
        logger.error(`❌ Multiple statements query failed: ${actionResult.error?.message}`);
        throw new Error(`Failed to execute multiple statements: ${actionResult.error?.message}`);
      }

      expect(actionResult.value).to.be.an('array');
      logger.log('✅ Multiple statements executed successfully.');
    });
  });
});
