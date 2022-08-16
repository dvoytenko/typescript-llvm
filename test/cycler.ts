import { cycle } from "./data/six";

const numberOfCycles = 10_000;

function run() {
  const buffer: any[] = [];
  console.log("START TIME: ", new Date());
  const startTime = performance.now();
  for (let i = 0; i < numberOfCycles; i++) {
    buffer.push(cycle(i));
  }
  const endTime = performance.now();
  console.log("Cycler completed: ", endTime - startTime, "millis");
  console.log(buffer.length);
  console.log("END TIME: ", new Date());
}

run();
