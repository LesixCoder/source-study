/**
 * 首页IndexController
 */
const Index = require('../models/Index');
const FormData = require('form-data');
class IndexController {
  constructor() {}
  actionIndex() {
    return async (ctx, next) => {
      // ctx.body = 'hello world'
      const index = new Index();
      const result = await index.getData();
      // ctx.body = result.data;
      // const data = "测试项目SSR";
      const data = result.data;
      ctx.body = await ctx.render('index', {
        data
      });
    };
  }
  actionAdd() {
    return async (ctx, next) => {
      const params = new FormData();
      params.append('Books[name]', '测试');
      params.append('Books[author]', '数据');
      const index = new Index();
      const result = await index.saveData({
        params
      });
      ctx.body = result;
    };
  }
}
module.exports = IndexController;
