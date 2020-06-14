/**
 * @fileoverview 实现Index的数据模型
 * @author yuanzhijia@yidengxuetang.com
 */
const SafeRequest = require('../utils/SafeRequest');

/**
 * 📚Index类 获取数据关于图书数据相关的类
 * @class
 */
class Index {
  /**
   * @constructor
   * @param {string} app KOA2的上下文
   */
  constructor(app) {}
  /**
   * 获取后台数据全部图书列表的方法
   * @param {*} options 配置项
   * @example
   * return new Promise
   * getData(options)
   */
  getData(options) {
    const safeRequest = new SafeRequest('books/index');
    return safeRequest.fetch({});
  }
  /**
   * 把用户传过来的数据保存进入借口
   * @param {*} options 配置项
   * @example
   * return new Promise
   * saveData(options)
   */
  saveData(options) {
    const safeRequest = new SafeRequest('books/create');
    return safeRequest.fetch({
      method: 'POST',
      params: options.params
    });
  }
}
module.exports = Index;
