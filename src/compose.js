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
