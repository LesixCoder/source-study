# Koa2源码学习(一)

### 引言

最近读了一下Koa2的源码；在阅读Koa2 (2.0.0) 的源码的过程中，我的感受是整个代码设计精巧，思路清晰，是一个小而精的 nodejs web服务框架。

### 设计理念

作为web服务框架，都是要围绕核心服务而展开的。那什么是核心服务呢？其实就是接收客户端的一个http的请求，对于这个请求，除了接收以外，还有解析这个请求。所以说会有
> HPPT：接收 -> 解析 -> 响应

在响应客户端的时候，也有很多种方式，比如返回一个html页面，或者json文本。在解析请求和响应请求的中间，会有一些第三方的中间件，比如 日志、表单解析等等来增强 koa 的服务能力，所以 koa 至少要提供 *"请求解析"、"响应数据"、"中间件处理"* 这三种核心能力的封装，同时还需要有一个串联他们执行环境的上下文（context）

* HTTP
* 接收
* 解析
* 响应
* 中间件
* 执行上下文

上下文可以理解为是http的请求周期内的作用域环境来托管请求响应和中间件，方便他们之间互相访问。

以上分析是站在单个http请求的角度来看一个web服务能力。那么站在整个网站，站在整个后端服务的角度来看的话，能够提供 *"请求"、"响应"、"解析"、"中间件"、"http流程全链路"* 这些服务能力的综合体，可以看做是一个应用服务对象。如果把这些全放到 koa 里的话，那么对应的就是：

* Application
* Context
* Request
* Response
* Middlewares
* Session
* Cookie

#### Koa的组成结构
首先看下koa的目录结构

![](https://blog.liusixin.cn/content/images/2018/04/WX20180425-000053-2x.png)

* application.js：框架入口；负责管理中间件，以及处理请求
* context.js：context对象的原型，代理request与response对象上的方法和属性
* request.js：request对象的原型，提供请求相关的方法和属性
* response.js：response对象的原型，提供响应相关的方法和属性
```
// application.js

const isGeneratorFunction = require('is-generator-function'); // 判断当前传入的function是否是标准的generator function
const debug = require('debug')('koa:application'); // js调试工具
const onFinished = require('on-finished'); // 事件监听，当http请求关闭，完成或者出错的时候调用注册好的回调
const response = require('./response'); // 响应请求
const compose = require('koa-compose'); // 中间件的函数数组
const isJSON = require('koa-is-json'); // 判断是否为json数据
const context = require('./context'); // 运行服务上下文
const request = require('./request'); // 客户端的请求
const statuses = require('statuses'); // 请求状态码
const Cookies = require('cookies');
const accepts = require('accepts'); // 约定可被服务端接收的数据，主要是协议和资源的控制
const Emitter = require('events'); // 事件循环
const assert = require('assert'); // 断言
const Stream = require('stream');
const http = require('http');
const only = require('only'); // 白名单选择
const convert = require('koa-convert'); // 兼容旧版本koa中间件
const deprecate = require('depd')('koa'); // 判断当前在运行koa的某些接口或者方法是否过期，如果过期，会给出一个升级的提示
```
以上是koa入口文件的依赖分析。接下来我们进行源码分析，首先我们利用删减法来筛出代码的核心实现即可，不用上来就盯细节！
我们只保留constructor
```
// application.js

module.exports = class Application extends Emitter {
  constructor() {
    super();

    this.proxy = false; // 是否信任 proxy header 参数，默认为 false
    this.middleware = []; //保存通过app.use(middleware)注册的中间件
    this.subdomainOffset = 2; // 子域默认偏移量，默认为 2
    this.env = process.env.NODE_ENV || 'development'; // 环境参数，默认为 NODE_ENV 或 ‘development’
    this.context = Object.create(context); //context模块，通过context.js创建
    this.request = Object.create(request); //request模块，通过request.js创建
    this.response = Object.create(response); //response模块，通过response.js创建
  }

  // ...
}
```
我们可以看到，这段代码暴露出一个类，构造函数内预先声明了一些属性，该类继承了Emitter，也就是说这个类可以直接为自定义事件注册回调函数和触发事件，同时可以捕捉到其他地方触发的事件。

除了这些基本属性之外，还有一些公用的api，最重要的两个一个是==listen==，一个是==use==。koa的每个实例上都会有这些属性和方法。
```
// application.js

module.exports = class Application extends Emitter {
  constructor() {
    super();

    this.proxy = false;
    this.middleware = [];
    this.subdomainOffset = 2;
    this.env = process.env.NODE_ENV || 'development';
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
  }

  listen() {
    const server = http.createServer(this.callback());
    return server.listen.apply(server, arguments);
  }

  use(fn) {
    this.middleware.push(fn);
    return this;
  }
}
```
listen 方法内部通过 http.createServer 创建了一个http服务的实例，通过这个实例去 listen 要监听的端口号，http.createServer 的参数传入了 this.callback 回调
```
// application.js

module.exports = class Application extends Emitter {
  ...
  callback() {
    const fn = compose(this.middleware); // 把所有middleware进行了组合，使用了koa-compose

    const handleRequest = (req, res) => {
      const ctx = this.createContext(req, res);
      return this.handleRequest(ctx, fn); // 返回了本身的回调函数
    };

    return handleRequest;
  }
}
```
可以看到，handleRequest 返回了本身的回调，接下来看 handleRequest 。

handleRequest 方法直接作为监听成功的调用方法。已经拿到了 包含 req res 的 ctx 和可以执行所有中间件函数的 fn。
首先一进来默认设置状态码为==404== . 然后分别声明了 成功函数执行完成以后的成功 失败回调方法。这两个方法实际上就是再将 ctx 分化成 req  res。 分别调这两个对象去客户端执行内容返回。
==context.js  request.js response.js==  分别是封装了一些对 ctx req res 操作相关的属性，我们以后再说。
```
// application.js

module.exports = class Application extends Emitter {
  ...
  handleRequest(ctx, fnMiddleware) {
    const res = ctx.res; // 拿到context.res
    res.statusCode = 404; // 设置默认状态吗404
    const onerror = err => ctx.onerror(err); // 设置onerror触发事件
    const handleResponse = () => respond(ctx); // 向客户端返回数据
    onFinished(res, onerror);
    return fnMiddleware(ctx).then(handleResponse).catch(onerror);
  }
}
```
**失败执行的回调**
```
onerror(err) {
  assert(err instanceof Error, `non-error thrown: ${err}`);

  if (404 == err.status || err.expose) return;
  if (this.silent) return;

  const msg = err.stack || err.toString();
  console.error();
  console.error(msg.replace(/^/gm, '  '));
  console.error();
}
```
**成功执行的回调**
```
function respond(ctx) {
  ...
}
```
`return fnMiddleware(ctx).then(handleResponse).catch(onerror);` 我们拆分理解，首先 return fnMiddleware(ctx) 返回了一个中间件数组处理链路，then(handleResponse) 等到整个中间件数组全部完成之后把返回结果通过 then 传递到 handleResponse。

```
// application.js

module.exports = class Application extends Emitter {
  ...
  createContext(req, res) {
    const context = Object.create(this.context);
    const request = context.request = Object.create(this.request);
    const response = context.response = Object.create(this.response);
    context.app = request.app = response.app = this;
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
这里我们不用去太深入去抠代码，理解原理就行。createContext 创建 context 的时候，还会将 req 和 res 分别挂载到context 对象上，并对req 上一些关键的属性进行处理和简化 挂载到该对象本身，简化了对这些属性的调用。我们通过一张图来直观地看到所有这些对象之间的关系。

![](https://blog.liusixin.cn/content/images/2018/04/1352261008-594a32c87b693_articlex.png)

* 最左边一列表示每个文件的导出对象
* 中间一列表示每个Koa应用及其维护的属性
* 右边两列表示对应每个请求所维护的一些列对象
* 黑色的线表示实例化
* 红色的线表示原型链
* 蓝色的线表示属性


createContext 简单理解就是挂载上面的对象，方便整个上下游http能及时访问到进出请求及特定的行为。
```
// application.js

module.exports = class Application extends Emitter {
  ...
}
function respond(ctx) {
  // allow bypassing koa
  if (false === ctx.respond) return;

  const res = ctx.res;
  if (!ctx.writable) return;

  let body = ctx.body;
  const code = ctx.status; // 赋值服务状态码

  if ('HEAD' == ctx.method) { // 请求头方法判断
    if (!res.headersSent && isJSON(body)) {
      ctx.length = Buffer.byteLength(JSON.stringify(body));
    }
    return res.end();
  }

  // status body
  if (null == body) {
    body = ctx.message || String(code);
    if (!res.headersSent) {
      ctx.type = 'text';
      ctx.length = Buffer.byteLength(body);
    }
    return res.end(body);
  }

  // 通过判断body类型来调用，这里的res.end就是最终向客户端返回数据的动作
  if (Buffer.isBuffer(body)) return res.end(body);
  if ('string' == typeof body) return res.end(body);
  if (body instanceof Stream) return body.pipe(res);

  // 返回为json数据
  body = JSON.stringify(body);
  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body);
  }
  res.end(body);
}
```
respond 函数是 handleRequest 成功处理的回调，内部做了合理性校验，诸如状态码，内容的类型判断，最后向客户端返回数据。
### 结语

以上就是我们对application.js文件的分析，通过上面的分析，我们已经可以大概得知Koa处理请求的过程：当请求到来的时候，会通过 req 和 res 来创建一个 context (ctx) ，然后执行中间件。
