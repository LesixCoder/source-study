function tail(i) {
  if(i > 3) return i
  console.log('修改前', i);

  return arguments.callee(i + 1)
}
tail(0)
