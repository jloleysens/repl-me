function one() {
  console.log('one and done and donest');
}

function two(arg) {
  console.log(arg);
}

const external = 1;

function three() {
  console.log(external);
}

function four(arg) {
  return arg;
}

function five(arg) {
  return (arg2 ) => {
    console.log(arg + arg2);
    return null;
  }
}

module.exports = {
  one,
  two,
  three,
  four,
  five: five('hello')
};