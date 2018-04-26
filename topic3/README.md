# Koa2源码学习(三)

这一章节我们来分析中间件，首先我们要先理解什么是**中间件**，先来看段代码：
```
const Koa = require('koa')
const app = new Koa()

app.use(async (ctx, next) => {
  ctx.type = 'text/html; charset=utf-8'
  ctx.body = 'hello world'
})

app.listen(8081)

```
在 koa 中，要应用一个中间件，我们使用 app.use()，我们要理解一个概念，就是在koa中，一切皆是中间件。再来一段代码：
```
const Koa = require('koa')
const app = new Koa()

const mid1 = async(ctx, next) => {
  ctx.body = 'Hello '
  await next()
  ctx.body = ctx.body + 'OK'
}

const mid2 = async(ctx, next) => {
  ctx.type = 'text/html; charset=utf-8'
  await next()
}

const mid3 = async(ctx, next) => {
  ctx.body = ctx.body + 'World '
  await next()
}

app.use(mid1)
app.use(mid2)
app.use(mid3)

app.listen(8085)

```
打印出==Hello World OK==，从执行结果来看，首先执行mid1中的代码，在遇到await next()之后会把控制权交给下一个中间件处理，直到所有的中间件都执行完毕，然后再回来继续执行剩下的业务代码。到这里我们就对koa的中间件执行特点有所了解了。

```
// application

use(fn) {
  ...
  this.middleware.push(fn);
  return this;
}
```

在前面的代码中，我们看到中间件在使用过程中会不断加到堆栈中，执行顺序也会按照先进先出的原则执行。但是koa中间件为什么可以依次执行？并在执行过程中可以暂停下来走后面的流程然后再回来继续执行？这里我们就要用到koa-compose了。

compose这里用到了纯函数，关于纯函数可以去看下函数式编程相关概念，首先纯函数无副作用，既不依赖，也不会改变全局状态。这样函数之间可以达到自由组合的效果。

我们先用一段js代码来模拟下这个执行原理
```
function tail(i) {
  if(i > 3) return i
  console.log('修改前', i);

  return arguments.callee(i + 1)
}
tail(0)
// 修改前 0
// 修改前 1
// 修改前 2
// 修改前 3
```
通过这种方式在每次调用的时候把这个函数的执行返回，它执行后的结果就是下一次调用的入参，这个返回的函数负责执行下一个流程，一直执行到边界条件为止。

然后再看compose核心代码
```
// koa-compose

module.exports = compose

function compose (middleware) { // 接收中间件函数数组
  if (!Array.isArray(middleware)) throw new TypeError('Middleware stack must be an array!') // 判断入参middleware是否为数组
  for (const fn of middleware) { // 判断数组内每一项是否是function
    if (typeof fn !== 'function') throw new TypeError('Middleware must be composed of functions!')
  }

  return function (context, next) { // next可以看成是一个钩子回调函数，能串联到下一个中间件
    // last called middleware #
    let index = -1 // 注册初始下标
    return dispatch(0) // 直接执行
    function dispatch (i) {
      if (i <= index) return Promise.reject(new Error('next() called multiple times')) // 判断next是否多次调用
      index = i
      let fn = middleware[i] // 下表为0，默认第一个中间件
      if (i === middleware.length) fn = next // 说明已调用到最后一个中间件，这里next为undified
      if (!fn) return Promise.resolve() // next取反为true，直接返回一个代码执行完毕的resolve
      try {
        return Promise.resolve(fn(context, function next () {
          return dispatch(i + 1) //递归调用，next将结果传递给下一个中间件
        }))
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}

```

可以看到compose是一个闭包函数，返回匿名函数再执行的最终结果返回的是一个promise对象。
> compose内部存储了所有的中间件，通过递归的方式不断的运行中间件。

再回到application来看
```
// application.js

callback() {
  const fn = compose(this.middleware);
  const handleRequest = (req, res) => {
    const ctx = this.createContext(req, res); // 生成上下文对象
    return this.handleRequest(ctx, fn);
  };
  return handleRequest;
}

handleRequest(ctx, fnMiddleware) {
  const res = ctx.res;
  res.statusCode = 404;
  const onerror = err => ctx.onerror(err);
  const handleResponse = () => respond(ctx);
  onFinished(res, onerror);
  return fnMiddleware(ctx).then(handleResponse).catch(onerror);
}
```
fnMiddleware 是通过 handleResponse 传入下来的，然后在callback回调执行的时候生成上下文对象ctx，然后把ctx传给了handleRequest，另一个参数fn就是compose处理之后返回的匿名函数，对应就是compose里`return Promise.resolve(fn(context, function next (){}` 这里的context和next。

fnMiddleware第一次执行的时只传入了ctx，next为undified，对应的就是compose里直接`return dispatch(0)`，这时候还没有执行第一个中间件，在它内部才传入了next。

compose的作用其实就是把每个不相干的中间件串在一起，然后来组合函数，把这些函数串联起来依次执行，上一个函数的输出结果就是下一个函数的入参。

######总结
Compose 是一种基于 Promise 的流程控制方式，可以通过这种方式对异步流程同步化，解决之前的嵌套回调和 Promise 链式耦合。

**至此koa2的源码学习就全部完成了，大家有问题的请给我提issue**
