const router = require('koa-simple-router');
const IndexController = require('./IndexController');
const indexController = new IndexController();
module.exports = (app) => {
  app.use(
    router((_) => {
      _.get('/index.html', indexController.actionIndex());
      _.get('/', indexController.actionIndex());
      _.get('/add', indexController.actionAdd());
    })
  );
};
