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
