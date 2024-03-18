class SQLiteDatabaseService {
  promiser;

  constructor() {
    this.promiser = new Promise((resolve) => {
      const _promiser = sqlite3Worker1Promiser({
        onready: () => {
          resolve(_promiser);
        },
      });
    })
  }

  getDbId = async () => {
    const { dbId } = (await this.promiser)('open', {
      filename: 'file:worker-promiser.sqlite3?vfs=opfs',
    });

    return dbId
  }

  executeSql = async (sql, args, callback) => {
    const dbId = await this.getDbId();

    try {
      return (await this.promiser)('exec', {
        bind: args,
        dbId,
        returnValue: 'resultRows',
        rowMode: 'object',
        sql,
        callback
      });
    } catch (error) {
      if (!(err instanceof Error)) {
        err = new Error(err.result.message);
      }
      console.error(err.name, err.message, sql, args);
    } finally {
      (await this.promiser)('close', { dbId });
    }
  }
}

const SQLITE_DB = new SQLiteDatabaseService();