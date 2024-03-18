class WebSQLDBService {
  DB

  constructor() {
    this.DB = openDatabase("pages", "1.0", "Monitored Pages", 51380224);
  }

  initializeDB() {
    this.executeSql(
      DATABASE_STRUCTURE,
      () => null,
      () => null
    );
  }

  executeSql(sql, _args, resultCallback, transactionCallback) {
    let args = typeof _args === 'function' ? [] : _args;
    const noop = () => null;
    let resultFunc = (_, result) =>
      resultCallback ? resultCallback(result) : noop();
    let transactionFuncCallback = transactionCallback || noop;
    let errorFunc = (tx, error) => {
      console.log(error.message);
    };
    let transactionFunc = (transaction) => {
      transaction.executeSql(sql, args, resultFunc, errorFunc);
    };

    this.DB.transaction(
      transactionFunc,
      () => null,
      transactionFuncCallback
    );
  }
}