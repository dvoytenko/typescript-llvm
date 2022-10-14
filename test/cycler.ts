/*
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
