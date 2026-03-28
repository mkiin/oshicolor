const greet = (name: string): string => {
  return `Hello, ${name}!`;
};
const nums = [1, 2, 3, 4, 5];
const doubled = nums.map((n) => n * 2);
console.log(greet("world"));
console.log(doubled);
