# Koa2源码学习(二)

上文我们读了koa源码中的application模块，了解其核心实现原理，其中在
```
// application.js

module.exports = class Application extends Emitter{
  ...
  createContext(req, res) {
    const context = Object.create(this.context);
    const request = context.request = Object.create(this.request);
    const response = context.response = Object.create(this.response);
  }
}
```
这段代码就引出了我们接下来分析的 ==context== 模块，同样利用删减法。

######context.js

```
const proto = module.exports = {
  const createError = require('http-errors');
  const httpAssert = require('http-assert');
  const delegate = require('delegates');
  const statuses = require('statuses');
  ...
}
delegate(proto, 'response')
  .method('attachment')
  .method('redirect')
  .method('remove')
  ...

delegate(proto, 'request')
  .method('acceptsLanguages')
  .method('acceptsEncodings')
  .method('acceptsCharsets')
  ...
```
[delegate](https://github.com/tj/node-delegates) 把 response 和 request 下面的方法和属性都挂载到proto上，然后把它暴露给application，这里的proto就是context。

```
// delegator

function Delegator(proto, target) {
  if (!(this instanceof Delegator)) return new Delegator(proto, target);
  this.proto = proto;
  this.target = target;
  this.methods = [];
  this.getters = [];
  this.setters = [];
  this.fluents = [];
}

Delegator.prototype.method = function(name){
  var proto = this.proto;
  var target = this.target;
  this.methods.push(name);

  proto[name] = function(){
    return this[target][name].apply(this[target], arguments);
  };

  return this;
};
```
Delegator 函数传入proto和target并分别缓存，然后调用method方法，把所有的方法名push到methods数组里，同时对proto下每一个传入的方法名配置成一个函数，函数内部是具体目标对象的方法。详细源码请看[node-delegates](https://github.com/tj/node-delegates)

```
// application.js

module.exports = class Application extends Emitter{
  ...
  createContext(req, res) {
    const context = Object.create(this.context);
    const request = context.request = Object.create(this.request);
    const response = context.response = Object.create(this.response);
    context.app = request.app = response.app = this; // 把当前实例挂载
    context.req = request.req = response.req = req;
    context.res = request.res = response.res = res;
    request.ctx = response.ctx = context;
    request.response = response;
    response.request = request;
    context.originalUrl = request.originalUrl = req.url;
    context.cookies = new Cookies(req, res, {
      keys: this.keys,
      secure: request.secure
    });
    request.ip = request.ips[0] || req.socket.remoteAddress || '';
    context.accept = request.accept = accepts(req);
    context.state = {};
    return context;
  }
}
```
Object.create 传入了context暴露出的proto，proto作为指定的原型对象在它的原有基础上生成新的对象（context），同时request和response也利用Object.create创建一个新的对象并把它挂载到context上。这样，在context不仅能访问到request response内部的方法属性外还能访问它们自身。

然后context，req，res互相挂载，这样就能很便利的去访问他们内部的方法和属性。

> Object.create 解释看这里[Object.create](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/create)

**总结：** content.js 主要就是提供了对request和response对象的方法与属性便捷访问能力。

######request.js

```
// request.js

module.exports = {

  get header() {...},

  set header(val) {...},

  get headers() {...},

  set headers(val) {...},

  get url() {...},

  set url(val) {...},

  get origin() {...},

  get href() {...}

  ...
};
```

从代码我们可以看到，request.js 封装了请求相关的属性以及方法，再把对象暴露给application，通过 application.js 中的createContext方法，代理对应的 request 对象。

> 具体源代码看这里 [request.js](https://github.com/koajs/koa/blob/master/lib/request.js)

######response.js

和request.js一样，封装了响应相关的属性以及方法，这里就不贴代码了。

> 具体源代码看这里 [response.js](https://github.com/koajs/koa/blob/master/lib/response.js)
